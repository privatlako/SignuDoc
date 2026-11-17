import { type DbExecutor, getDb } from "./db/connection.ts";
import {
  renewRecipientDownloadLinks,
  type RenewedDownloadLinks,
} from "./downloads.ts";
import { getBranding } from "./settings.ts";
import { recordEmailSent } from "./services/audit.ts";
import { createEmailService, type EmailService } from "./services/email.ts";
import {
  emailButton,
  emailHeading,
  emailNote,
  emailSecondaryButton,
} from "./services/email-layout.ts";
import { withUserEmailLegalFooter } from "./services/email-legal-footer.ts";
import {
  buildGreeting,
  quoteTitle,
} from "./services/signing-invitation-email.ts";
import { RECIPIENT_DOWNLOAD_LINK_TTL_SECONDS } from "./types/domain.ts";
import { escapeHtml } from "./utils/html.ts";

const TTL_DAYS = RECIPIENT_DOWNLOAD_LINK_TTL_SECONDS / (24 * 60 * 60);

/** Sends fresh download links to the signer an expired link belonged to. */
export async function sendFreshDownloadLinks(
  token: string,
  {
    database = getDb(),
    emailService = createEmailService(),
  }: { database?: DbExecutor; emailService?: EmailService } = {},
): Promise<RenewedDownloadLinks> {
  const branding = await getBranding();

  return renewRecipientDownloadLinks(token, {
    database,
    async sendLinks({ envelope, evidenceUrl, signedUrl, signer }) {
      const title = quoteTitle(envelope.title);
      const subject = `Új letöltési linkek: ${title}`;
      const introLine = `Itt vannak az új letöltési linkek ehhez a szerződéshez: ${title}. ${String(TTL_DAYS)} napig érvényesek.`;
      const keepLine = "Töltsd le és őrizd meg a fájlokat: ez a te példányod.";
      const textBody = [
        buildGreeting(signer.name),
        "",
        introLine,
        "",
        ...(signedUrl ? [`Aláírt PDF: ${signedUrl}`] : []),
        `Hitelesítési igazolás: ${evidenceUrl}`,
        "",
        keepLine,
      ].join("\n");
      const htmlBody = [
        emailHeading("Új letöltési linkek"),
        `<p>${escapeHtml(buildGreeting(signer.name))}</p>`,
        `<p>${escapeHtml(introLine)}</p>`,
        signedUrl ? emailButton("Aláírt szerződés letöltése", signedUrl) : "",
        signedUrl
          ? emailSecondaryButton("Hitelesítési igazolás letöltése", evidenceUrl)
          : emailButton("Hitelesítési igazolás letöltése", evidenceUrl),
        emailNote(escapeHtml(keepLine)),
      ].join("");
      const body = withUserEmailLegalFooter({ htmlBody, textBody }, branding);
      const delivery = await emailService.send({
        htmlBody: body.htmlBody,
        subject,
        template: "download_links",
        textBody: body.textBody,
        to: signer.email,
      });

      await recordEmailSent(
        {
          envelopeId: envelope.id,
          messageId: delivery.messageId,
          recipient: signer.email,
          signerId: signer.id,
          template: "download_links",
        },
        database,
      );
    },
  });
}
