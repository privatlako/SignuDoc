import { SigningDoneShell } from "@/components/signing/signing-done-shell";
import {
  buildDepositNote,
  buildDepositNoteInDays,
  DEFAULT_OFFER_CURRENCY,
  MAX_OFFER_AMOUNT,
  MAX_TRANSFER_DEADLINE_DAYS,
  readOfferCurrency,
} from "@/lib/customer-contract";

type SignDonePageProps = {
  searchParams?: Promise<{
    currency?: string | string[];
    days?: string | string[];
    deposit?: string | string[];
    due?: string | string[];
    title?: string | string[];
  }>;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The deposit note for a customer who accepted an offer. Only numbers, a
 * date and a known currency code are read from the address, so nothing else
 * can be put on the page. The deposit is in the currency's stored unit
 * (forints or euro cents); no currency means HUF, as links sent before the
 * currency choice had none.
 */
function readDepositNote(params: {
  currency?: string;
  days?: string;
  deposit?: string;
  due?: string;
}): string | null {
  const deposit = Number(params.deposit);
  const currency =
    params.currency === undefined
      ? DEFAULT_OFFER_CURRENCY
      : readOfferCurrency(params.currency);

  if (
    !currency ||
    !params.deposit ||
    !/^\d{1,11}$/.test(params.deposit) ||
    deposit < 1 ||
    deposit > MAX_OFFER_AMOUNT
  ) {
    return null;
  }

  if (params.due && /^\d{4}-\d{2}-\d{2}$/.test(params.due)) {
    const dueDate = new Date(`${params.due}T00:00:00Z`);

    if (!Number.isNaN(dueDate.getTime())) {
      return buildDepositNote({
        currency,
        depositAmount: deposit,
        dueDateLabel: new Intl.DateTimeFormat("hu-HU", {
          day: "numeric",
          month: "long",
          timeZone: "UTC",
          year: "numeric",
        }).format(dueDate),
      });
    }
  }

  const days = Number(params.days);

  if (
    params.days &&
    /^\d{1,3}$/.test(params.days) &&
    days >= 1 &&
    days <= MAX_TRANSFER_DEADLINE_DAYS
  ) {
    return buildDepositNoteInDays({ currency, days, depositAmount: deposit });
  }

  return null;
}

export default async function SignDonePage({
  searchParams,
}: SignDonePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const envelopeTitle = first(resolvedSearchParams?.title);
  const depositNote = readDepositNote({
    currency: first(resolvedSearchParams?.currency),
    days: first(resolvedSearchParams?.days),
    deposit: first(resolvedSearchParams?.deposit),
    due: first(resolvedSearchParams?.due),
  });

  return (
    <SigningDoneShell depositNote={depositNote} envelopeTitle={envelopeTitle} />
  );
}
