import { type Branding } from "../branding.ts";
import { escapeHtml } from "../utils/html.ts";
import { withUserEmailLegalFooter } from "./email-legal-footer.ts";
import { emailButton, emailHeading, emailNote } from "./email-layout.ts";
import { type TransactionalEmailMessage } from "./email.ts";

type SigningInvitationEmailInput = {
  branding: Branding;
  envelopeTitle: string;
  /** The envelope's deadline, when it has one. */
  expiresAt?: number | null;
  senderName: string;
  signerEmail: string;
  signerName: string;
  signingUrl: string;
};

const emailDeadlineFormatter = new Intl.DateTimeFormat("hu-HU", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "long",
  timeZone: "Europe/Budapest",
  year: "numeric",
});

/** A deadline as emails write it, in Budapest time: "2027. január 15. 09:00". */
export function formatEmailDeadline(unixTimestamp: number): string {
  return emailDeadlineFormatter
    .format(new Date(unixTimestamp * 1000))
    .replace(/[\u00a0\u202f]/g, " ");
}

/** "Az aláírási kérés lejár: …", or nothing for an envelope with no deadline. */
export function buildDeadlineLine(
  expiresAt: number | null | undefined,
): string | null {
  return typeof expiresAt === "number"
    ? `Az aláírási kérés lejár: ${formatEmailDeadline(expiresAt)}.`
    : null;
}

/** The greeting every email to a person opens with: "Kedves Teszt János!". */
export function buildGreeting(name: string | null | undefined): string {
  const trimmed = name?.trim();

  return trimmed ? `Kedves ${trimmed}!` : "Üdvözlünk!";
}

/** What signers are told about confirming and accounts. */
export const SIGNING_CONFIRMATION_LINE =
  "Az aláíráshoz e-mailes megerősítés szükséges, fiókot nem szükséges létrehoznod.";

/** „Title”, with Hungarian quotation marks. */
export function quoteTitle(title: string): string {
  return `„${title}”`;
}

export function buildSigningInvitationEmail(
  input: SigningInvitationEmailInput,
): TransactionalEmailMessage {
  const title = quoteTitle(input.envelopeTitle);
  const subject = `${input.senderName} aláírást kér tőled: ${title}`;
  const deadlineLine = buildDeadlineLine(input.expiresAt);
  const introLine = `${input.senderName} aláírásra küldte neked ezt a szerződést: ${title}.`;
  const confirmationLine = SIGNING_CONFIRMATION_LINE;
  const newestLinkLine =
    "Ha közben újabb meghívót vagy emlékeztetőt kapsz, mindig a legfrissebb linket használd.";
  const textBody = [
    buildGreeting(input.signerName),
    "",
    introLine,
    "",
    "Szerződés aláírása:",
    input.signingUrl,
    ...(deadlineLine ? ["", deadlineLine] : []),
    "",
    confirmationLine,
    newestLinkLine,
  ].join("\n");
  const htmlBody = [
    emailHeading("Aláírásra vár egy szerződés"),
    `<p>${escapeHtml(buildGreeting(input.signerName))}</p>`,
    `<p>${escapeHtml(introLine)}</p>`,
    emailButton("Szerződés aláírása", input.signingUrl),
    deadlineLine ? emailNote(escapeHtml(deadlineLine)) : "",
    emailNote(escapeHtml(confirmationLine)),
    emailNote(escapeHtml(newestLinkLine)),
  ].join("");
  const legalFooter = withUserEmailLegalFooter(
    {
      htmlBody,
      preheader: introLine,
      textBody,
    },
    input.branding,
  );

  return {
    htmlBody: legalFooter.htmlBody,
    subject,
    template: "signing_invitation",
    textBody: legalFooter.textBody,
    to: input.signerEmail,
  };
}
