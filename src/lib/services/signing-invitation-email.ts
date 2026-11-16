import { type Branding } from "../branding.ts";
import { escapeHtml } from "../utils/html.ts";
import { withUserEmailLegalFooter } from "./email-legal-footer.ts";
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
  timeZone: "UTC",
  year: "numeric",
});

/** A deadline as emails write it: "2027. január 15. 08:00 (UTC)". */
export function formatEmailDeadline(unixTimestamp: number): string {
  return `${emailDeadlineFormatter
    .format(new Date(unixTimestamp * 1000))
    .replace(/[  ]/g, " ")} (UTC)`;
}

/** "Az aláírási kérés lejár: …", or nothing for an envelope with no deadline. */
export function buildDeadlineLine(
  expiresAt: number | null | undefined,
): string | null {
  return typeof expiresAt === "number"
    ? `Az aláírási kérés lejár: ${formatEmailDeadline(expiresAt)}.`
    : null;
}

/** The greeting every email to a person opens with. */
export function buildGreeting(name: string | null | undefined): string {
  const trimmed = name?.trim();

  return trimmed ? `Szia ${trimmed}!` : "Szia!";
}

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
  const introLine = `${input.senderName} aláírásra küldte neked ezt a dokumentumot: ${title}.`;
  const noAccountLine = "Az aláíráshoz nem kell fiókot létrehoznod.";
  const newestLinkLine =
    "Ha közben újabb meghívót vagy emlékeztetőt kapsz, mindig a legfrissebb linket használd.";
  const textBody = [
    buildGreeting(input.signerName),
    "",
    introLine,
    "",
    "Itt tudod megnézni és aláírni:",
    input.signingUrl,
    ...(deadlineLine ? ["", deadlineLine] : []),
    "",
    noAccountLine,
    newestLinkLine,
  ].join("\n");
  const htmlBody = [
    `<p>${escapeHtml(buildGreeting(input.signerName))}</p>`,
    `<p>${escapeHtml(introLine)}</p>`,
    `<p><a href="${escapeHtml(input.signingUrl)}">Megnézem és aláírom</a></p>`,
    deadlineLine ? `<p>${escapeHtml(deadlineLine)}</p>` : "",
    `<p>${noAccountLine}</p>`,
    `<p>${newestLinkLine}</p>`,
  ].join("");
  const legalFooter = withUserEmailLegalFooter(
    {
      htmlBody,
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
