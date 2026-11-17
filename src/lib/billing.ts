import {
  type DbExecutor,
  type DbPool,
  getDb,
  queryOne,
  withTransaction,
} from "./db/connection.ts";
import {
  BILLING_STATUS_LABELS,
  type BillingStatus,
  billingFullName,
  formatBillingAddress,
  formatBudapestDateTime,
  formatForint,
  readStoredBilling,
  readStoredOffer,
  transferDeadlineDate,
} from "./customer-contract.ts";
import { getBranding } from "./settings.ts";
import { recordEmailSent } from "./services/audit.ts";
import {
  createEmailService,
  type EmailService,
  type TransactionalEmailMessage,
} from "./services/email.ts";
import { withUserEmailLegalFooter } from "./services/email-legal-footer.ts";
import {
  emailButton,
  emailHeading,
  emailNote,
} from "./services/email-layout.ts";
import { requireConfigValue } from "./services/service-config.ts";
import { quoteTitle } from "./services/signing-invitation-email.ts";
import { type Branding } from "./branding.ts";
import { getEnv } from "./utils/env.ts";
import { escapeHtml } from "./utils/html.ts";

// What happens once a customer contract is signed by everyone: the
// contract waits to be invoiced, and the organization hears about it.
// Invoicing itself is done by hand for now; whoever does it marks the
// contract as invoiced on its page.

export class BillingStatusError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "BillingStatusError";
    this.statusCode = statusCode;
  }
}

type BillingReadyRow = {
  billing: unknown;
  completedAt: number | null;
  contractType: string;
  offer: unknown;
  signerEmail: string | null;
  signerName: string | null;
  title: string;
};

export type BillingReadyResult =
  | { reason: "no_support_address" | "not_ready"; sent: false }
  | { messageId?: string; sent: true; to: string };

/** The internal "invoicing can start" email. */
export function buildBillingReadyEmail(input: {
  billing: NonNullable<ReturnType<typeof readStoredBilling>>;
  branding: Branding;
  completedAt: number;
  customerEmail: string;
  envelopeTitle: string;
  envelopeUrl: string;
  offer: NonNullable<ReturnType<typeof readStoredOffer>>;
  to: string;
}): TransactionalEmailMessage {
  const title = quoteTitle(input.envelopeTitle);
  const dueDate = transferDeadlineDate(
    input.completedAt,
    input.offer.transferDeadlineDays,
  );
  const rows: Array<[label: string, value: string]> = [
    ["Ügyfél", billingFullName(input.billing)],
    ["E-mail", input.customerEmail],
    ["Telefonszám", input.billing.phone],
    ["Ajánlat sorszáma", input.offer.offerNumber],
    ["Árajánlat összege", formatForint(input.offer.totalAmount)],
    ["Esedékes előleg", formatForint(input.offer.depositAmount)],
    [
      "Utalási határidő",
      `${dueDate.label} (aláírástól számított ${input.offer.transferDeadlineDays} nap)`,
    ],
    ["Számlázási cím", formatBillingAddress(input.billing)],
    ["Tervezési cím", input.billing.projectAddress],
    ["Aláírva", formatBudapestDateTime(input.completedAt)],
  ];
  const subject = `Mehet a számlázás: ${title}`;
  const introLine = `Az ügyfél aláírta ezt a szerződést: ${title}. Kiállíthatod az előlegszámlát.`;
  const textBody = [
    introLine,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    "Ha kiállítottad a számlát, jelöld a szerződés adatlapján „Kiszámlázva” állapotúra:",
    input.envelopeUrl,
  ].join("\n");
  const htmlBody = [
    emailHeading("Mehet a számlázás"),
    `<p>${escapeHtml(introLine)}</p>`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 16px;border-collapse:collapse;">`,
    ...rows.map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;vertical-align:top;font-size:14px;color:#7a6f66;white-space:nowrap;">${escapeHtml(label)}</td><td style="padding:6px 0;vertical-align:top;font-size:15px;color:#2e2621;font-weight:600;">${escapeHtml(value)}</td></tr>`,
    ),
    "</table>",
    emailButton("Szerződés megnyitása", input.envelopeUrl),
    emailNote(
      "Ha kiállítottad a számlát, jelöld a szerződés adatlapján „Kiszámlázva” állapotúra.",
    ),
  ].join("");
  const withFooter = withUserEmailLegalFooter(
    { htmlBody, preheader: introLine, textBody },
    input.branding,
  );

  return {
    htmlBody: withFooter.htmlBody,
    subject,
    template: "billing_ready",
    textBody: withFooter.textBody,
    to: input.to,
  };
}

/**
 * Tells the organization that a finished customer contract can be
 * invoiced: one email to the support address. Retries send nothing twice.
 *
 * Everything that should happen when a contract is ready for invoicing
 * belongs here (a webhook to an automation, later, goes beside the email).
 */
export async function notifyBillingReady(
  envelopeId: string,
  {
    database = getDb(),
    emailService,
  }: { database?: DbExecutor; emailService?: EmailService } = {},
): Promise<BillingReadyResult> {
  const row = await queryOne<BillingReadyRow>(
    database,
    `
      SELECT
        envelopes.title,
        envelopes.contract_type AS "contractType",
        envelopes.offer,
        envelopes.billing,
        envelopes.completed_at AS "completedAt",
        first_signer.name AS "signerName",
        first_signer.email AS "signerEmail"
      FROM envelopes
      LEFT JOIN LATERAL (
        SELECT name, email
        FROM signers
        WHERE signers.envelope_id = envelopes.id
          AND signers.role = 'signer'
        ORDER BY sign_order
        LIMIT 1
      ) AS first_signer ON true
      WHERE envelopes.id = $1
        AND envelopes.status = 'completed'
    `,
    [envelopeId],
  );
  const offer = readStoredOffer(row?.offer);
  const billing = readStoredBilling(row?.billing);

  if (
    !row ||
    row.contractType !== "customer" ||
    !offer ||
    !billing ||
    row.completedAt === null
  ) {
    return { reason: "not_ready", sent: false };
  }

  const branding = await getBranding();

  if (!branding.supportAddress) {
    console.warn(
      `Envelope ${envelopeId} is ready for invoicing, but no support address is set to tell.`,
    );
    return { reason: "no_support_address", sent: false };
  }

  const appUrl = requireConfigValue("app", "APP_URL", getEnv().appUrl);
  const message = buildBillingReadyEmail({
    billing,
    branding,
    completedAt: row.completedAt,
    customerEmail: billing.signerEmail || row.signerEmail || "",
    envelopeTitle: row.title,
    envelopeUrl: new URL(`/envelopes/${envelopeId}`, appUrl).toString(),
    offer,
    to: branding.supportAddress,
  });
  const delivery = await (emailService ?? createEmailService()).send(message, {
    idempotencyKey: `billing-ready/${envelopeId}`,
  });

  await recordEmailSent(
    {
      envelopeId,
      messageId: delivery.messageId,
      recipient: message.to,
      template: "billing_ready",
    },
    database,
  );

  return { messageId: delivery.messageId, sent: true, to: message.to };
}

/**
 * Marks a finished customer contract as invoiced, or back to waiting.
 * Only the sender who owns the envelope may.
 */
export async function setBillingStatusForUser(
  userId: string,
  envelopeId: string,
  status: BillingStatus,
  database: DbPool = getDb(),
): Promise<{
  billingStatus: BillingStatus;
  billingStatusChangedAt: number;
  label: string;
}> {
  return withTransaction(async (tx) => {
    const envelope = await queryOne<{
      billingStatus: string | null;
      contractType: string;
      status: string;
    }>(
      tx,
      `
        SELECT
          status,
          contract_type AS "contractType",
          billing_status AS "billingStatus"
        FROM envelopes
        WHERE id = $1 AND user_id = $2
        FOR UPDATE
      `,
      [envelopeId, userId],
    );

    if (!envelope) {
      throw new BillingStatusError("A szerződés nem található.", 404);
    }

    if (
      envelope.contractType !== "customer" ||
      envelope.status !== "completed" ||
      envelope.billingStatus === null
    ) {
      throw new BillingStatusError(
        "Számlázási állapota csak aláírt ügyfélszerződésnek van.",
        409,
      );
    }

    const changedAt = Math.floor(Date.now() / 1000);

    await tx.query(
      `
        UPDATE envelopes
        SET billing_status = $1, billing_status_changed_at = $2
        WHERE id = $3 AND user_id = $4
      `,
      [status, changedAt, envelopeId, userId],
    );

    return {
      billingStatus: status,
      billingStatusChangedAt: changedAt,
      label: BILLING_STATUS_LABELS[status],
    };
  }, database);
}
