import { SigningDoneShell } from "@/components/signing/signing-done-shell";
import {
  buildDepositNote,
  formatForint,
  MAX_OFFER_AMOUNT_FT,
  MAX_TRANSFER_DEADLINE_DAYS,
} from "@/lib/customer-contract";

type SignDonePageProps = {
  searchParams?: Promise<{
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
 * The deposit note for a customer who accepted an offer. Only numbers and a
 * date are read from the address, so nothing else can be put on the page.
 */
function readDepositNote(params: {
  days?: string;
  deposit?: string;
  due?: string;
}): string | null {
  const deposit = Number(params.deposit);

  if (
    !params.deposit ||
    !/^\d{1,11}$/.test(params.deposit) ||
    deposit < 1 ||
    deposit > MAX_OFFER_AMOUNT_FT
  ) {
    return null;
  }

  if (params.due && /^\d{4}-\d{2}-\d{2}$/.test(params.due)) {
    const dueDate = new Date(`${params.due}T00:00:00Z`);

    if (!Number.isNaN(dueDate.getTime())) {
      return buildDepositNote({
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
    return `Fizetendő előleg: ${formatForint(deposit)}. Az előlegszámlát e-mailben küldjük; az utalás határideje a szerződés lezárásától számított ${days} nap.`;
  }

  return null;
}

export default async function SignDonePage({
  searchParams,
}: SignDonePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const envelopeTitle = first(resolvedSearchParams?.title);
  const depositNote = readDepositNote({
    days: first(resolvedSearchParams?.days),
    deposit: first(resolvedSearchParams?.deposit),
    due: first(resolvedSearchParams?.due),
  });

  return (
    <SigningDoneShell depositNote={depositNote} envelopeTitle={envelopeTitle} />
  );
}
