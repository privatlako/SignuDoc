import { signatureMeanings, type SignatureMeaning } from "./types/domain.ts";

// What a Part 11 signature means (21 CFR 11.50(a)(3)), in words for the
// signer, the signed document and the certificate. No database or server
// code here, so the PDF and the browser can use it too.

export const SIGNATURE_MEANING_DETAILS: Record<
  SignatureMeaning,
  { label: string; statement: string }
> = {
  approval: {
    label: "Jóváhagyás",
    statement: "Jóváhagyom ezt a dokumentumot.",
  },
  authorship: {
    label: "Szerzőség",
    statement: "Én vagyok ennek a dokumentumnak a szerzője.",
  },
  responsibility: {
    label: "Felelősségvállalás",
    statement: "Felelősséget vállalok ezért a dokumentumért.",
  },
  review: {
    label: "Felülvizsgálat",
    statement: "Átnéztem ezt a dokumentumot.",
  },
};

export function parseSignatureMeaning(value: unknown): SignatureMeaning | null {
  return typeof value === "string" &&
    (signatureMeanings as readonly string[]).includes(value)
    ? (value as SignatureMeaning)
    : null;
}

export function signatureMeaningLabel(
  meaning: SignatureMeaning | null | undefined,
): string | null {
  return meaning ? SIGNATURE_MEANING_DETAILS[meaning].label : null;
}

/**
 * The words printed beside a Part 11 signature: the signer's printed name,
 * the date and time in UTC, and the meaning (21 CFR 11.50(a)). Null when
 * the signer has not signed or the signature has no meaning.
 */
export function buildSignatureManifestation(signer: {
  name: string;
  signatureMeaning?: SignatureMeaning | null;
  signedAt?: number | null;
}): string | null {
  if (!signer.signatureMeaning || typeof signer.signedAt !== "number") {
    return null;
  }

  const signedAt = new Date(signer.signedAt * 1000)
    .toISOString()
    .replace(/\.\d{3}Z$/, " UTC")
    .replace("T", " ");

  return `Aláírta: ${signer.name} | ${signedAt} | Jelentés: ${SIGNATURE_MEANING_DETAILS[signer.signatureMeaning].label}`;
}
