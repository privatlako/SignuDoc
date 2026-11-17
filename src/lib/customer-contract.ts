import { z } from "zod";

// Customer contracts (ügyfélszerződés): the customer accepts an offer by
// signing it, gives their billing details while signing, and once everyone
// signed, the contract waits to be invoiced. Partner contracts (tervezői /
// partnerszerződés) work as every contract did before.
//
// Customer contracts collect billing details from one person: the first
// signer. Anyone signing after them signs as on a partner contract.
//
// Used in the browser and on the server, so nothing here reads the
// database or the environment.

export const contractTypes = ["partner", "customer"] as const;
export type ContractType = (typeof contractTypes)[number];
export const contractTypeSchema = z.enum(contractTypes);

export const billingStatuses = ["pending", "invoiced"] as const;
export type BillingStatus = (typeof billingStatuses)[number];
export const billingStatusSchema = z.enum(billingStatuses);

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  customer: "Ügyfélszerződés",
  partner: "Tervezői / partnerszerződés",
};

export const BILLING_STATUS_LABELS: Record<BillingStatus, string> = {
  invoiced: "Kiszámlázva",
  pending: "Számlázásra vár",
};

export const DEFAULT_TRANSFER_DEADLINE_DAYS = 8;
export const MAX_TRANSFER_DEADLINE_DAYS = 365;
/**
 * The currencies an offer can be made in. Amounts are stored as whole
 * numbers of the currency's smallest unit used here: forints for HUF (no
 * fillér) and cents for EUR, so no amount ever goes through a float.
 * Offers saved before the currency choice have no `currency` and are HUF.
 */
export const offerCurrencies = ["HUF", "EUR"] as const;
export type OfferCurrency = (typeof offerCurrencies)[number];
export const offerCurrencySchema = z.enum(offerCurrencies);
export const DEFAULT_OFFER_CURRENCY: OfferCurrency = "HUF";

export const OFFER_CURRENCY_LABELS: Record<OfferCurrency, string> = {
  EUR: "Euró (€)",
  HUF: "Forint (Ft)",
};

/** The unit printed after an amount. */
export const OFFER_CURRENCY_UNITS: Record<OfferCurrency, string> = {
  EUR: "€",
  HUF: "Ft",
};

/** How many stored units make one forint or one euro. */
const MINOR_UNITS_PER_MAJOR: Record<OfferCurrency, number> = {
  EUR: 100,
  HUF: 1,
};

/**
 * The largest stored amount, in either currency's stored unit: ten billion
 * forints or a hundred million euros. Far above any offer, and exact.
 */
export const MAX_OFFER_AMOUNT = 10_000_000_000;

export function readOfferCurrency(value: unknown): OfferCurrency | null {
  const parsed = offerCurrencySchema.safeParse(value);

  return parsed.success ? parsed.data : null;
}
export const DEFAULT_BILLING_COUNTRY = "Magyarország";

/** The rule shown to the sender beside the contract type. */
export const CUSTOMER_CONTRACT_SIGNER_RULE =
  "Ügyfélszerződésnél a számlázási adatokat az 1. aláíró adja meg aláíráskor. Ha több aláíró van, a többiek a szokásos módon írnak alá.";

const BUDAPEST_TIME_ZONE = "Europe/Budapest";

function trimmedText(max: number, requiredMessage: string, tooLong: string) {
  return z
    .string({ error: requiredMessage })
    .trim()
    .min(1, requiredMessage)
    .max(max, tooLong);
}

function optionalText(max: number, tooLong: string) {
  return z.preprocess(
    (value) =>
      typeof value === "string" && value.trim().length === 0
        ? undefined
        : value,
    z.string().trim().max(max, tooLong).optional(),
  );
}

const OFFER_AMOUNT_LABELS = {
  depositAmount: "Az előleg",
  totalAmount: "Az árajánlat összege",
} as const;

/**
 * Checks one stored amount against its currency: a whole number of stored
 * units (forints or cents), at least the smallest step, at most the limit.
 */
function checkOfferAmount(
  amount: number,
  currency: OfferCurrency,
  key: keyof typeof OFFER_AMOUNT_LABELS,
  context: z.RefinementCtx,
) {
  const label = OFFER_AMOUNT_LABELS[key];
  const fail = (message: string) =>
    context.addIssue({ code: "custom", message, path: [key] });

  if (!Number.isSafeInteger(amount)) {
    fail(
      currency === "EUR"
        ? `${label} legfeljebb két tizedesjegyű euróösszeg legyen.`
        : `${label} egész forintösszeg legyen.`,
    );
  } else if (amount < 1) {
    fail(`${label} legalább ${formatMoney(1, currency)} legyen.`);
  } else if (amount > MAX_OFFER_AMOUNT) {
    fail(`${label} túl nagy.`);
  }
}

const PHONE_PATTERN = /^\+?[0-9 ()/-]{6,24}$/;
const phoneMessage =
  "Adj meg egy érvényes telefonszámot, például +36 30 123 4567.";

/** What the sender enters for a customer contract on the review step. */
export const customerOfferSchema = z
  .object({
    offerNumber: trimmedText(
      60,
      "Add meg az ajánlat sorszámát.",
      "Az ajánlat sorszáma legfeljebb 60 karakter lehet.",
    ),
    /** Missing on offers saved before the currency choice: those are HUF. */
    currency: z.preprocess(
      (value) => (value === undefined || value === null ? undefined : value),
      offerCurrencySchema.default(DEFAULT_OFFER_CURRENCY),
    ),
    /** In the currency's stored unit: forints (HUF) or cents (EUR). */
    totalAmount: z.number({ error: "Add meg az árajánlat összegét." }),
    /** In the currency's stored unit: forints (HUF) or cents (EUR). */
    depositAmount: z.number({ error: "Add meg az esedékes előleget." }),
    transferDeadlineDays: z
      .number({ error: "Add meg az utalási határidőt napokban." })
      .int("Az utalási határidő egész számú nap legyen.")
      .min(1, "Az utalási határidő legalább 1 nap legyen.")
      .max(
        MAX_TRANSFER_DEADLINE_DAYS,
        `Az utalási határidő legfeljebb ${MAX_TRANSFER_DEADLINE_DAYS} nap lehet.`,
      ),
    projectAddress: optionalText(
      300,
      "A tervezési cím legfeljebb 300 karakter lehet.",
    ),
    phone: optionalText(
      40,
      "A telefonszám legfeljebb 40 karakter lehet.",
    ).refine(
      (value) => value === undefined || PHONE_PATTERN.test(value),
      phoneMessage,
    ),
  })
  .superRefine((offer, context) => {
    // Zod still runs this when another field failed; check only what parsed.
    if (
      readOfferCurrency(offer.currency) === null ||
      typeof offer.totalAmount !== "number" ||
      typeof offer.depositAmount !== "number"
    ) {
      return;
    }

    checkOfferAmount(offer.totalAmount, offer.currency, "totalAmount", context);
    checkOfferAmount(
      offer.depositAmount,
      offer.currency,
      "depositAmount",
      context,
    );

    if (offer.depositAmount > offer.totalAmount) {
      context.addIssue({
        code: "custom",
        message: "Az előleg nem lehet nagyobb az árajánlat összegénél.",
        path: ["depositAmount"],
      });
    }
  });

/** A checked offer; `currency` is always set (HUF when it was missing). */
export type CustomerOffer = z.infer<typeof customerOfferSchema>;

function isHungary(country: string): boolean {
  return country.trim().toLocaleLowerCase("hu-HU") === "magyarország";
}

/** The billing details the customer types in, before the checkboxes. */
const billingFieldsSchema = z.object({
  lastName: trimmedText(
    80,
    "Add meg a vezetékneved.",
    "A vezetéknév legfeljebb 80 karakter lehet.",
  ),
  firstName: trimmedText(
    80,
    "Add meg a keresztneved.",
    "A keresztnév legfeljebb 80 karakter lehet.",
  ),
  country: trimmedText(
    80,
    "Add meg az országot.",
    "Az ország neve legfeljebb 80 karakter lehet.",
  ),
  county: optionalText(80, "A megye neve legfeljebb 80 karakter lehet."),
  postalCode: trimmedText(
    12,
    "Add meg az irányítószámot.",
    "Az irányítószám legfeljebb 12 karakter lehet.",
  ),
  city: trimmedText(
    80,
    "Add meg a várost.",
    "A város neve legfeljebb 80 karakter lehet.",
  ),
  street: trimmedText(
    160,
    "Add meg az utcát és a házszámot.",
    "Az utca és házszám legfeljebb 160 karakter lehet.",
  ),
  projectAddress: trimmedText(
    300,
    "Add meg a tervezési címet.",
    "A tervezési cím legfeljebb 300 karakter lehet.",
  ),
  phone: trimmedText(
    40,
    "Add meg a telefonszámod.",
    "A telefonszám legfeljebb 40 karakter lehet.",
  ).refine((value) => PHONE_PATTERN.test(value), phoneMessage),
});

function checkHungarianPostalCode(
  value: { country: string; postalCode: string },
  context: z.RefinementCtx,
) {
  if (isHungary(value.country) && !/^\d{4}$/.test(value.postalCode)) {
    context.addIssue({
      code: "custom",
      message: "Magyar irányítószám 4 számjegyből áll.",
      path: ["postalCode"],
    });
  }
}

const acceptanceSchema = (message: string) =>
  z.literal(true, { error: message });

/** What the signer sends with their submission on a customer contract. */
export const billingSubmissionSchema = billingFieldsSchema
  .extend({
    acceptedTerms: acceptanceSchema(
      "Fogadd el az Általános Szerződési Feltételeket.",
    ),
    acceptedPrivacy: acceptanceSchema(
      "Fogadd el az Adatvédelmi Nyilatkozatot.",
    ),
    acceptedPaymentObligation: acceptanceSchema(
      "Erősítsd meg, hogy tudomásul veszed a fizetési kötelezettséget.",
    ),
  })
  .superRefine(checkHungarianPostalCode);

export type BillingSubmission = z.infer<typeof billingSubmissionSchema>;
export type BillingFieldName = keyof z.infer<typeof billingFieldsSchema>;
export type BillingAcceptanceName =
  "acceptedPaymentObligation" | "acceptedPrivacy" | "acceptedTerms";

/** The billing details as stored on the envelope. */
export const storedBillingSchema = billingFieldsSchema.extend({
  county: z.string().nullable(),
  acceptedTerms: z.literal(true),
  acceptedPrivacy: z.literal(true),
  acceptedPaymentObligation: z.literal(true),
  acceptedAt: z.number().int().nonnegative(),
  signerEmail: z.string(),
  signerId: z.string(),
  termsUrl: z.string().nullable(),
  privacyUrl: z.string().nullable(),
});

export type StoredBilling = z.infer<typeof storedBillingSchema>;

/** Reads the offer column; anything that is not a valid offer is null. */
export function readStoredOffer(value: unknown): CustomerOffer | null {
  const parsed = customerOfferSchema.safeParse(value);

  return parsed.success ? parsed.data : null;
}

/** Reads the billing column; anything that is not valid billing is null. */
export function readStoredBilling(value: unknown): StoredBilling | null {
  const parsed = storedBillingSchema.safeParse(value);

  return parsed.success ? parsed.data : null;
}

export function readBillingStatus(value: unknown): BillingStatus | null {
  const parsed = billingStatusSchema.safeParse(value);

  return parsed.success ? parsed.data : null;
}

export type BillingFormValues = Record<BillingFieldName, string> &
  Record<BillingAcceptanceName, boolean>;

export function emptyBillingForm(
  prefill: { phone?: string | null; projectAddress?: string | null } = {},
): BillingFormValues {
  return {
    acceptedPaymentObligation: false,
    acceptedPrivacy: false,
    acceptedTerms: false,
    city: "",
    country: DEFAULT_BILLING_COUNTRY,
    county: "",
    firstName: "",
    lastName: "",
    phone: prefill.phone ?? "",
    postalCode: "",
    projectAddress: prefill.projectAddress ?? "",
    street: "",
  };
}

export type BillingFormErrors = Partial<
  Record<BillingFieldName | BillingAcceptanceName, string>
>;

/**
 * Checks the form the way the server does. Returns the parsed details, or
 * one message for each field that needs fixing.
 */
export function validateBillingForm(
  values: BillingFormValues,
):
  | { data: BillingSubmission; ok: true }
  | { errors: BillingFormErrors; ok: false } {
  const parsed = billingSubmissionSchema.safeParse(values);

  if (parsed.success) {
    return { data: parsed.data, ok: true };
  }

  const errors: BillingFormErrors = {};

  for (const issue of parsed.error.issues) {
    const key = issue.path[0];

    if (typeof key === "string" && !(key in errors)) {
      errors[key as keyof BillingFormErrors] = issue.message;
    }
  }

  // The postal code rule spans two fields, so the schema checks it only
  // once every field is valid. The form shows it as soon as it applies.
  const postalCode = values.postalCode.trim();

  if (
    !errors.postalCode &&
    postalCode.length > 0 &&
    isHungary(values.country) &&
    !/^\d{4}$/.test(postalCode)
  ) {
    errors.postalCode = "Magyar irányítószám 4 számjegyből áll.";
  }

  return { errors, ok: false };
}

/** The first message of a failed check, for a server response. */
export function describeBillingProblem(value: unknown): string | null {
  const parsed = billingSubmissionSchema.safeParse(value);

  return parsed.success
    ? null
    : (parsed.error.issues[0]?.message ?? "Ellenőrizd a számlázási adatokat.");
}

/** Groups whole units by thousands with a plain space: "1 250 000". */
function groupThousands(whole: number): string {
  return (
    new Intl.NumberFormat("hu-HU", {
      maximumFractionDigits: 0,
      useGrouping: true,
    })
      .format(whole)
      // hu-HU groups with a no-break space; a plain one prints everywhere,
      // PDF fonts and plain-text emails included.
      .replace(/[\s\u00a0\u202f]/g, " ")
  );
}

/**
 * An offer amount for people to read, from its stored unit:
 * HUF "1 250 000 Ft" (whole forints), EUR "1 250,50 €" (always two
 * decimals, comma as the decimal sign). The one formatter for every place
 * an amount appears.
 */
export function formatMoney(
  amount: number,
  currency: OfferCurrency = DEFAULT_OFFER_CURRENCY,
): string {
  const unit = OFFER_CURRENCY_UNITS[currency];

  if (currency === "HUF") {
    return `${groupThousands(Math.round(amount))} ${unit}`;
  }

  // Integer arithmetic on cents, so 0.1 + 0.2 never shows up.
  const cents = Math.round(amount);
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const whole = Math.trunc(absolute / MINOR_UNITS_PER_MAJOR.EUR);
  const fraction = String(absolute % MINOR_UNITS_PER_MAJOR.EUR).padStart(
    2,
    "0",
  );

  return `${sign}${groupThousands(whole)},${fraction} ${unit}`;
}

/** "1 250 000 Ft": whole forints, grouped by thousands. */
export function formatForint(amount: number): string {
  return formatMoney(amount, "HUF");
}

/** Both amounts of an offer, in its currency. */
export function formatOfferAmounts(offer: {
  currency?: OfferCurrency;
  depositAmount: number;
  totalAmount: number;
}): { deposit: string; total: string } {
  const currency = offer.currency ?? DEFAULT_OFFER_CURRENCY;

  return {
    deposit: formatMoney(offer.depositAmount, currency),
    total: formatMoney(offer.totalAmount, currency),
  };
}

/**
 * Reads an amount a person typed ("1 250 000", "1.250.000 Ft") as whole
 * forints. Null when it is not one.
 */
export function parseForintInput(value: string): number | null {
  const digits = value.replace(/[\s\u00a0\u202f.]|ft/gi, "");

  if (!/^\d{1,11}$/.test(digits)) {
    return null;
  }

  return Number(digits);
}

/**
 * Reads an amount a person typed as euro cents: spaces group thousands,
 * and a comma or a point starts at most two decimals ("1 250,50",
 * "1250.5", "1 250 €"). Null when it is not one.
 */
export function parseEuroInput(value: string): number | null {
  const compact = value.replace(/[\s\u00a0\u202f€]|eur/gi, "");
  const match = /^(\d{1,9})(?:[.,](\d{1,2}))?$/.exec(compact);

  if (!match) {
    return null;
  }

  const [, whole, fraction = ""] = match;

  return (
    Number(whole) * MINOR_UNITS_PER_MAJOR.EUR + Number(fraction.padEnd(2, "0"))
  );
}

/** Reads a typed amount into the currency's stored unit; null if invalid. */
export function parseOfferAmountInput(
  value: string,
  currency: OfferCurrency,
): number | null {
  return currency === "EUR" ? parseEuroInput(value) : parseForintInput(value);
}

/** Why a typed amount could not be read, for the field under it. */
export function describeOfferAmountInputProblem(
  key: keyof typeof OFFER_AMOUNT_LABELS,
  currency: OfferCurrency,
): string {
  const label = OFFER_AMOUNT_LABELS[key];

  return currency === "EUR"
    ? `${label} euróban, legfeljebb két tizedesjeggyel legyen, például 1 250,50.`
    : `${label} egész forintösszeg legyen, például 1 250 000.`;
}

function budapestDateParts(unixSeconds: number) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: BUDAPEST_TIME_ZONE,
    year: "numeric",
  }).formatToParts(new Date(unixSeconds * 1000));
  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);

  return { day: read("day"), month: read("month"), year: read("year") };
}

/**
 * The day the deposit is due: the signing day in Budapest plus the
 * transfer deadline, counted in calendar days.
 */
export function transferDeadlineDate(
  signedAtUnixSeconds: number,
  days: number,
): { iso: string; label: string } {
  const { day, month, year } = budapestDateParts(signedAtUnixSeconds);
  const due = new Date(Date.UTC(year, month - 1, day + days));
  const iso = due.toISOString().slice(0, 10);
  const label = new Intl.DateTimeFormat("hu-HU", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(due);

  return { iso, label };
}

/** A moment as it reads in Budapest: "2026. november 17. 14:05". */
export function formatBudapestDateTime(unixSeconds: number): string {
  return new Intl.DateTimeFormat("hu-HU", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: BUDAPEST_TIME_ZONE,
  }).format(new Date(unixSeconds * 1000));
}

export function transferDeadlineLabel(days: number): string {
  return `aláírástól számított ${days} nap`;
}

/** Hungarian order: family name first. */
export function billingFullName(billing: {
  firstName: string;
  lastName: string;
}): string {
  return `${billing.lastName} ${billing.firstName}`.trim();
}

/** "1051 Budapest, Fő utca 1." with the county and country when given. */
export function formatBillingAddress(billing: {
  city: string;
  country: string;
  county?: string | null;
  postalCode: string;
  street: string;
}): string {
  const parts = [`${billing.postalCode} ${billing.city}, ${billing.street}`];

  if (billing.county) {
    parts.push(billing.county);
  }

  if (!isHungary(billing.country)) {
    parts.push(billing.country);
  }

  return parts.join(", ");
}

/** The deposit note for the signer: completion email and done screen. */
export function buildDepositNote(input: {
  currency?: OfferCurrency;
  depositAmount: number;
  dueDateLabel: string;
}): string {
  // Hungarian dates end with a period already ("2026. november 25.").
  const due = input.dueDateLabel.replace(/\.$/, "");

  return `Fizetendő előleg: ${formatMoney(input.depositAmount, input.currency)}. Az előlegszámlát e-mailben küldjük; az utalás határideje: ${due}.`;
}

/** The deposit note when the closing day is not known yet. */
export function buildDepositNoteInDays(input: {
  currency?: OfferCurrency;
  days: number;
  depositAmount: number;
}): string {
  return `Fizetendő előleg: ${formatMoney(input.depositAmount, input.currency)}. Az előlegszámlát e-mailben küldjük; az utalás határideje a szerződés lezárásától számított ${input.days} nap.`;
}
