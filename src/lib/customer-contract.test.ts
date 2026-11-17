import assert from "node:assert/strict";
import { test } from "node:test";

import {
  billingFullName,
  buildDepositNote,
  buildDepositNoteInDays,
  customerOfferSchema,
  describeBillingProblem,
  emptyBillingForm,
  formatBillingAddress,
  formatForint,
  formatMoney,
  formatOfferAmounts,
  parseEuroInput,
  parseForintInput,
  parseOfferAmountInput,
  readStoredOffer,
  transferDeadlineDate,
  validateBillingForm,
} from "./customer-contract.ts";

const validBilling = {
  ...emptyBillingForm({
    phone: "+36 30 123 4567",
    projectAddress: "Budapest, Tervező utca 2.",
  }),
  acceptedPaymentObligation: true,
  acceptedPrivacy: true,
  acceptedTerms: true,
  city: "Budapest",
  firstName: "Anna",
  lastName: "Kovács",
  postalCode: "1051",
  street: "Fő utca 1.",
};

test("amounts read as whole forints grouped by thousands", () => {
  assert.equal(formatForint(1_250_000), "1 250 000 Ft");
  assert.equal(formatForint(500), "500 Ft");
  assert.equal(formatForint(0), "0 Ft");
  assert.equal(parseForintInput("1 250 000"), 1_250_000);
  assert.equal(parseForintInput("1.250.000 Ft"), 1_250_000);
  assert.equal(parseForintInput("12,5"), null);
  assert.equal(parseForintInput(""), null);
});

test("euro amounts are cents, shown with two decimals and a comma", () => {
  assert.equal(formatMoney(125_050, "EUR"), "1 250,50 €");
  assert.equal(formatMoney(125_000_000, "EUR"), "1 250 000,00 €");
  assert.equal(formatMoney(1, "EUR"), "0,01 €");
  assert.equal(formatMoney(30, "EUR"), "0,30 €");
  assert.equal(formatMoney(0, "EUR"), "0,00 €");
  assert.equal(formatMoney(1_250_000, "HUF"), "1 250 000 Ft");
  assert.equal(formatMoney(1_250_000), "1 250 000 Ft");
  // No float drift: 0.1 + 0.2 euros typed and shown back.
  assert.equal(
    formatMoney(
      (parseEuroInput("0,1") ?? 0) + (parseEuroInput("0,2") ?? 0),
      "EUR",
    ),
    "0,30 €",
  );
});

test("typed euro amounts accept a decimal comma or point, up to two decimals", () => {
  assert.equal(parseEuroInput("1 250,50"), 125_050);
  assert.equal(parseEuroInput("1250.5"), 125_050);
  assert.equal(parseEuroInput("1250"), 125_000);
  assert.equal(parseEuroInput("1 250 €"), 125_000);
  assert.equal(parseEuroInput("1\u00a0250,05 EUR"), 125_005);
  assert.equal(parseEuroInput("0,07"), 7);
  assert.equal(parseEuroInput("12,345"), null);
  assert.equal(parseEuroInput("1.250.000"), null);
  assert.equal(parseEuroInput("1,250.50"), null);
  assert.equal(parseEuroInput("-5"), null);
  assert.equal(parseEuroInput(""), null);
  assert.equal(parseOfferAmountInput("1 250,50", "EUR"), 125_050);
  // Forints stay whole: a decimal comma is not a forint amount.
  assert.equal(parseOfferAmountInput("1 250,50", "HUF"), null);
  assert.equal(parseOfferAmountInput("1 250 000", "HUF"), 1_250_000);
});

test("an offer without a currency is a forint offer, as before", () => {
  const legacy = {
    depositAmount: 300_000,
    offerNumber: "2025/112",
    totalAmount: 1_250_000,
    transferDeadlineDays: 8,
  };
  const read = readStoredOffer(legacy);

  assert.equal(read?.currency, "HUF");
  assert.equal(read?.totalAmount, 1_250_000);
  assert.deepEqual(formatOfferAmounts(legacy), {
    deposit: "300 000 Ft",
    total: "1 250 000 Ft",
  });
  assert.equal(readStoredOffer({ ...legacy, currency: null })?.currency, "HUF");
  assert.equal(readStoredOffer({ ...legacy, currency: "USD" }), null);
});

test("offer amounts are checked in their own currency", () => {
  const euro = {
    currency: "EUR",
    depositAmount: 30_000,
    offerNumber: "2026/050",
    totalAmount: 125_050,
    transferDeadlineDays: 8,
  };
  const parsed = customerOfferSchema.safeParse(euro);

  assert.equal(parsed.success, true);
  assert.equal(parsed.data?.currency, "EUR");
  assert.deepEqual(formatOfferAmounts(parsed.data!), {
    deposit: "300,00 €",
    total: "1 250,50 €",
  });

  const depositTooBig = customerOfferSchema.safeParse({
    ...euro,
    depositAmount: 125_051,
  });

  assert.equal(
    depositTooBig.error?.issues[0]?.message,
    "Az előleg nem lehet nagyobb az árajánlat összegénél.",
  );
  assert.equal(
    customerOfferSchema.safeParse({ ...euro, totalAmount: 0 }).error?.issues[0]
      ?.message,
    "Az árajánlat összege legalább 0,01 € legyen.",
  );
  // Stored euro amounts are whole cents; a fraction of a cent is refused.
  assert.equal(
    customerOfferSchema.safeParse({ ...euro, totalAmount: 125_050.5 }).error
      ?.issues[0]?.message,
    "Az árajánlat összege legfeljebb két tizedesjegyű euróösszeg legyen.",
  );
  assert.equal(
    customerOfferSchema.safeParse({
      ...euro,
      currency: "HUF",
      totalAmount: 0,
    }).error?.issues[0]?.message,
    "Az árajánlat összege legalább 1 Ft legyen.",
  );
  assert.equal(
    customerOfferSchema.safeParse({ ...euro, currency: "USD" }).success,
    false,
  );
});

test("the transfer deadline counts calendar days from the signing day in Budapest", () => {
  // 2026-11-17 10:00 UTC is 11:00 in Budapest.
  const signedAt = Date.UTC(2026, 10, 17, 10) / 1000;

  assert.deepEqual(transferDeadlineDate(signedAt, 8), {
    iso: "2026-11-25",
    label: "2026. november 25.",
  });

  // 23:30 UTC on 31 December is already 1 January in Budapest.
  const lateNight = Date.UTC(2026, 11, 31, 23, 30) / 1000;

  assert.equal(transferDeadlineDate(lateNight, 1).iso, "2027-01-02");

  // Across the spring change to summer time the day still counts once.
  const beforeDst = Date.UTC(2027, 2, 27, 22, 30) / 1000; // 23:30 in Budapest

  assert.equal(transferDeadlineDate(beforeDst, 1).iso, "2027-03-28");
});

test("an offer needs a number, a total and a deposit no larger than it", () => {
  const offer = {
    depositAmount: 300_000,
    offerNumber: "2026/041",
    totalAmount: 1_250_000,
    transferDeadlineDays: 8,
  };

  assert.equal(customerOfferSchema.safeParse(offer).success, true);

  const tooBig = customerOfferSchema.safeParse({
    ...offer,
    depositAmount: 2_000_000,
  });

  assert.equal(tooBig.success, false);
  assert.equal(
    tooBig.error?.issues[0]?.message,
    "Az előleg nem lehet nagyobb az árajánlat összegénél.",
  );
  assert.equal(
    customerOfferSchema.safeParse({ ...offer, offerNumber: " " }).error
      ?.issues[0]?.message,
    "Add meg az ajánlat sorszámát.",
  );
  assert.equal(
    customerOfferSchema.safeParse({ ...offer, totalAmount: 10.5 }).success,
    false,
  );
  assert.equal(
    customerOfferSchema.safeParse({ ...offer, phone: "hívj fel" }).success,
    false,
  );
});

test("billing details are checked with Hungarian messages", () => {
  const ok = validateBillingForm(validBilling);

  assert.equal(ok.ok, true);

  const empty = validateBillingForm(emptyBillingForm());

  assert.equal(empty.ok, false);
  assert.ok(!empty.ok);
  assert.equal(empty.errors.lastName, "Add meg a vezetékneved.");
  assert.equal(empty.errors.postalCode, "Add meg az irányítószámot.");
  assert.equal(empty.errors.county, undefined, "the county is optional");
  assert.equal(
    empty.errors.acceptedTerms,
    "Fogadd el az Általános Szerződési Feltételeket.",
  );
  assert.equal(
    empty.errors.acceptedPaymentObligation,
    "Erősítsd meg, hogy tudomásul veszed a fizetési kötelezettséget.",
  );
});

test("a Hungarian postal code has four digits; other countries are free", () => {
  const partial = validateBillingForm({
    ...emptyBillingForm(),
    postalCode: "105",
  });

  assert.ok(!partial.ok);
  assert.equal(
    partial.errors.postalCode,
    "Magyar irányítószám 4 számjegyből áll.",
    "shown while the rest of the form is still empty",
  );

  assert.equal(
    describeBillingProblem({ ...validBilling, postalCode: "105" }),
    "Magyar irányítószám 4 számjegyből áll.",
  );
  assert.equal(
    describeBillingProblem({
      ...validBilling,
      country: "Ausztria",
      postalCode: "A-1010",
    }),
    null,
  );
  assert.equal(
    describeBillingProblem({ ...validBilling, acceptedPrivacy: false }),
    "Fogadd el az Adatvédelmi Nyilatkozatot.",
  );
});

test("names and addresses read the Hungarian way", () => {
  assert.equal(billingFullName(validBilling), "Kovács Anna");
  assert.equal(formatBillingAddress(validBilling), "1051 Budapest, Fő utca 1.");
  assert.equal(
    formatBillingAddress({
      ...validBilling,
      country: "Ausztria",
      county: "Bécs",
      postalCode: "1010",
      city: "Wien",
    }),
    "1010 Wien, Fő utca 1., Bécs, Ausztria",
  );
  assert.equal(
    buildDepositNote({
      depositAmount: 300_000,
      dueDateLabel: "2026. november 25.",
    }),
    "Fizetendő előleg: 300 000 Ft. Az előlegszámlát e-mailben küldjük; az utalás határideje: 2026. november 25.",
  );
  assert.equal(
    buildDepositNote({
      currency: "EUR",
      depositAmount: 30_050,
      dueDateLabel: "2026. november 25.",
    }),
    "Fizetendő előleg: 300,50 €. Az előlegszámlát e-mailben küldjük; az utalás határideje: 2026. november 25.",
  );
  assert.equal(
    buildDepositNoteInDays({ currency: "EUR", days: 8, depositAmount: 30_000 }),
    "Fizetendő előleg: 300,00 €. Az előlegszámlát e-mailben küldjük; az utalás határideje a szerződés lezárásától számított 8 nap.",
  );
});
