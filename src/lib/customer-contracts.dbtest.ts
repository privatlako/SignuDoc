import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import { PDFDocument } from "pdf-lib";
import type pg from "pg";

import { BillingStatusError, setBillingStatusForUser } from "./billing.ts";
import { openTestDatabase } from "./db/test-database.ts";
import { ELECTRONIC_RECORDS_DISCLOSURE_VERSION } from "./electronic-records-disclosure.ts";
import { getEnvelopeDetailDataForUser } from "./envelopes.ts";
import type {
  EmailService,
  TransactionalEmailMessage,
} from "./services/email.ts";
import { issueSigningLink } from "./services/signing-links.ts";
import {
  createStorageService,
  type StorageService,
} from "./services/storage.ts";
import {
  getSigningPayloadForToken,
  recordSignerConsent,
  SigningMutationError,
  submitSigningForToken,
} from "./signing.ts";

// Customer contracts against a real Postgres: the first signer's billing
// details, the "ready for invoicing" signal once everyone signed, and who
// may mark a contract as invoiced. Run with `npm run test:db`.

process.env.APP_URL ??= "https://sign.example.test";

const SUPPORT_ADDRESS = "szamlazas@example.test";
const DRAWN_SIGNATURE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const OFFER = {
  depositAmount: 300_000,
  offerNumber: "2026/041",
  phone: "+36 30 123 4567",
  projectAddress: "1052 Budapest, Tervező utca 2.",
  totalAmount: 1_250_000,
  transferDeadlineDays: 8,
};
const BILLING = {
  acceptedPaymentObligation: true,
  acceptedPrivacy: true,
  acceptedTerms: true,
  city: "Budapest",
  country: "Magyarország",
  county: "",
  firstName: "Anna",
  lastName: "Kovács",
  phone: "+36 30 123 4567",
  postalCode: "1051",
  projectAddress: "1052 Budapest, Tervező utca 2.",
  street: "Fő utca 1.",
};

let database: pg.Pool;
const createdUsers: string[] = [];
const storageDirs: string[] = [];
let previousSupportEmail: string | undefined;

before(async () => {
  database = await openTestDatabase();
  globalThis.__signudocPgPool = database;
  previousSupportEmail = process.env.SUPPORT_EMAIL;
  process.env.SUPPORT_EMAIL = SUPPORT_ADDRESS;
});

after(async () => {
  if (previousSupportEmail === undefined) {
    delete process.env.SUPPORT_EMAIL;
  } else {
    process.env.SUPPORT_EMAIL = previousSupportEmail;
  }

  await database.query(`delete from public."user" where id = any($1)`, [
    createdUsers,
  ]);
  await Promise.all(
    storageDirs.map((dir) => rm(dir, { force: true, recursive: true })),
  );
  await database.end();
});

function unixNow() {
  return Math.floor(Date.now() / 1000);
}

function recordingEmailService() {
  const sent: Array<{ key?: string; message: TransactionalEmailMessage }> = [];
  const service: EmailService = {
    async send(message, options) {
      sent.push({ key: options?.idempotencyKey, message });

      return {
        accepted: [message.to],
        messageId: `m-${sent.length}`,
        rejected: [],
      };
    },
    async sendBatch() {
      throw new Error("not used");
    },
  };

  return { sent, service };
}

/** A sent envelope with a real PDF, one signature field per signer. */
async function createEnvelope({
  contractType,
  signerCount = 1,
}: {
  contractType: "customer" | "partner";
  signerCount?: number;
}) {
  const now = unixNow();
  const userId = randomUUID();
  const envelopeId = randomUUID();
  const storageDir = await mkdtemp(path.join(tmpdir(), "signudoc-customer-"));
  const storageService: StorageService = createStorageService({
    env: { STORAGE_DRIVER: "local", STORAGE_LOCAL_DIR: storageDir },
  });
  const sourcePdf = await PDFDocument.create();

  sourcePdf.addPage([612, 792]);

  const sourcePdfBytes = await sourcePdf.save();

  storageDirs.push(storageDir);
  createdUsers.push(userId);
  await storageService.putObject({
    body: sourcePdfBytes,
    contentType: "application/pdf",
    key: `test/${envelopeId}.pdf`,
  });
  await database.query(
    `insert into public."user" (id, name, email, role) values ($1, 'Sam Sender', $2, 'user')`,
    [userId, `${userId}@example.test`],
  );
  await database.query(
    `
      insert into envelopes (
        id, user_id, title, status, source_pdf_key, source_pdf_filename,
        source_pdf_size_bytes, page_count, source_pdf_hash, sent_at,
        expires_at, contract_type, offer
      ) values ($1, $2, 'Tervezési szerződés', 'sent', $3, 'szerzodes.pdf',
        $4, 1, $5, $6, $7, $8, $9::jsonb)
    `,
    [
      envelopeId,
      userId,
      `test/${envelopeId}.pdf`,
      sourcePdfBytes.length,
      createHash("sha256").update(sourcePdfBytes).digest("hex"),
      now,
      now + 86_400,
      contractType,
      contractType === "customer" ? JSON.stringify(OFFER) : null,
    ],
  );
  await database.query(
    `
      insert into envelope_pages (id, envelope_id, page_number, width_pt, height_pt)
      values ($1, $2, 1, 612, 792)
    `,
    [randomUUID(), envelopeId],
  );

  const signers: Array<{
    email: string;
    fieldId: string;
    id: string;
    token: string;
  }> = [];

  for (let index = 0; index < signerCount; index += 1) {
    const signerId = randomUUID();
    const fieldId = randomUUID();
    const first = index === 0;
    const link = await issueSigningLink({
      expiresInSeconds: 3600,
      issuedAt: now,
    });
    const email = `${signerId}@example.test`;

    await database.query(
      `
        insert into signers (
          id, envelope_id, name, email, sign_order, status,
          signing_token_hash, signing_token_expires_at, last_notified_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        signerId,
        envelopeId,
        first ? "Kovács Anna" : "Második Aláíró",
        email,
        index + 1,
        first ? "notified" : "pending",
        first ? link.tokenHash : null,
        first ? link.exp : null,
        first ? now : null,
      ],
    );
    await database.query(
      `
        insert into fields (
          id, envelope_id, signer_id, type, page, x, y, width, height
        ) values ($1, $2, $3, 'signature', 1, 0.1, 0.1, 0.2, 0.1)
      `,
      [fieldId, envelopeId, signerId],
    );
    signers.push({ email, fieldId, id: signerId, token: link.token });
  }

  await recordSignerConsent(
    signers[0]!.token,
    { disclosureVersion: ELECTRONIC_RECORDS_DISCLOSURE_VERSION },
    { database },
  );

  return { envelopeId, signers, storageService, userId };
}

function submission(fieldId: string, billing?: unknown) {
  return {
    clientTimezoneOffsetMinutes: -60,
    fields: [
      {
        fieldId,
        imageDataUrl: DRAWN_SIGNATURE,
        inputMethod: "drawn" as const,
        type: "signature" as const,
      },
    ],
    ...(billing === undefined ? {} : { billing }),
  };
}

async function readEnvelope(envelopeId: string) {
  const result = await database.query<{
    billing: Record<string, unknown> | null;
    billing_status: string | null;
    billing_status_changed_at: number | null;
    status: string;
  }>(
    `select status, billing, billing_status, billing_status_changed_at from envelopes where id = $1`,
    [envelopeId],
  );

  return result.rows[0]!;
}

test("the first signer of a customer contract sees the offer and must give billing details", async () => {
  const envelope = await createEnvelope({ contractType: "customer" });
  const signer = envelope.signers[0]!;
  const payload = await getSigningPayloadForToken(signer.token, { database });

  assert.equal(payload.customerContract?.offer.offerNumber, OFFER.offerNumber);
  assert.equal(payload.customerContract?.offer.depositAmount, 300_000);

  const { sent, service } = recordingEmailService();

  await assert.rejects(
    submitSigningForToken(signer.token, submission(signer.fieldId), {
      database,
      emailService: service,
      storageService: envelope.storageService,
    }),
    (error: unknown) => {
      assert.ok(error instanceof SigningMutationError);
      assert.equal(error.statusCode, 400);
      assert.equal(
        error.message,
        "Mielőtt befejeznéd, add meg a számlázási adataidat.",
      );
      return true;
    },
  );

  await assert.rejects(
    submitSigningForToken(
      signer.token,
      submission(signer.fieldId, { ...BILLING, postalCode: "105" }),
      {
        database,
        emailService: service,
        storageService: envelope.storageService,
      },
    ),
    (error: unknown) => {
      assert.ok(error instanceof SigningMutationError);
      assert.equal(error.message, "Magyar irányítószám 4 számjegyből áll.");
      return true;
    },
  );

  await assert.rejects(
    submitSigningForToken(
      signer.token,
      submission(signer.fieldId, { ...BILLING, acceptedTerms: false }),
      {
        database,
        emailService: service,
        storageService: envelope.storageService,
      },
    ),
    SigningMutationError,
  );

  const stored = await readEnvelope(envelope.envelopeId);

  assert.equal(stored.status, "sent");
  assert.equal(stored.billing, null);
  assert.equal(stored.billing_status, null);
  assert.equal(sent.length, 0);
});

test("a signed customer contract stores the billing details, waits for invoicing and tells the organization once", async () => {
  const envelope = await createEnvelope({ contractType: "customer" });
  const signer = envelope.signers[0]!;
  const { sent, service } = recordingEmailService();
  const response = await submitSigningForToken(
    signer.token,
    submission(signer.fieldId, BILLING),
    {
      database,
      emailService: service,
      storageService: envelope.storageService,
    },
  );
  const stored = await readEnvelope(envelope.envelopeId);

  assert.equal(stored.status, "completed");
  assert.equal(stored.billing_status, "pending");
  assert.ok(typeof stored.billing_status_changed_at === "number");
  assert.equal(stored.billing?.lastName, "Kovács");
  assert.equal(stored.billing?.postalCode, "1051");
  assert.equal(stored.billing?.acceptedTerms, true);
  assert.equal(stored.billing?.acceptedPaymentObligation, true);
  assert.equal(stored.billing?.signerEmail, signer.email);
  assert.match(response.redirectPath, /deposit=300000/);
  assert.match(response.redirectPath, /due=\d{4}-\d{2}-\d{2}/);

  const internal = sent.filter(
    (entry) => entry.message.template === "billing_ready",
  );

  assert.equal(internal.length, 1);
  assert.equal(internal[0]!.message.to, SUPPORT_ADDRESS);
  assert.equal(internal[0]!.key, `billing-ready/${envelope.envelopeId}`);
  assert.equal(
    internal[0]!.message.subject,
    "Mehet a számlázás: „Tervezési szerződés”",
  );

  for (const expected of [
    "Kovács Anna",
    signer.email,
    "2026/041",
    "1 250 000 Ft",
    "300 000 Ft",
    "1051 Budapest, Fő utca 1.",
    "1052 Budapest, Tervező utca 2.",
    "+36 30 123 4567",
    `/envelopes/${envelope.envelopeId}`,
  ]) {
    assert.ok(
      internal[0]!.message.textBody.includes(expected),
      `the internal email names ${expected}`,
    );
  }

  const signerCopy = sent.find(
    (entry) =>
      entry.message.template === "completion_notification" &&
      entry.message.to === signer.email,
  );

  assert.match(
    signerCopy?.message.textBody ?? "",
    /Fizetendő előleg: 300 000 Ft\. Az előlegszámlát e-mailben küldjük; az utalás határideje: \d{4}\. \S+ \d{1,2}\./,
  );

  const signed = await database.query<{ metadata: Record<string, unknown> }>(
    `select metadata from audit_events where envelope_id = $1 and event = 'signed'`,
    [envelope.envelopeId],
  );
  const billingAudit = signed.rows[0]?.metadata.billing as
    Record<string, unknown> | undefined;

  assert.equal(billingAudit?.offerNumber, "2026/041");
  assert.equal(billingAudit?.acceptedTerms, true);
  assert.equal(billingAudit?.acceptedPrivacy, true);
  assert.equal(billingAudit?.billingName, "Kovács Anna");

  const detail = await getEnvelopeDetailDataForUser(
    envelope.userId,
    envelope.envelopeId,
    database,
  );

  assert.equal(detail?.customerContract?.billingStatus, "pending");
  assert.equal(detail?.customerContract?.offer?.depositLabel, "300 000 Ft");
  assert.equal(detail?.customerContract?.billing?.name, "Kovács Anna");
});

test("on a customer contract with two signers the first gives the billing details and the last finishes", async () => {
  const envelope = await createEnvelope({
    contractType: "customer",
    signerCount: 2,
  });
  const [first, second] = envelope.signers as [
    (typeof envelope.signers)[number],
    (typeof envelope.signers)[number],
  ];
  const { sent, service } = recordingEmailService();
  const options = {
    database,
    emailService: service,
    storageService: envelope.storageService,
  };
  const firstResponse = await submitSigningForToken(
    first.token,
    submission(first.fieldId, BILLING),
    options,
  );

  assert.match(firstResponse.redirectPath, /days=8/);
  assert.equal((await readEnvelope(envelope.envelopeId)).billing_status, null);
  assert.equal(
    (await readEnvelope(envelope.envelopeId)).billing?.firstName,
    "Anna",
  );

  // The second signer's token comes with the invitation; issue our own.
  const link = await issueSigningLink({ expiresInSeconds: 3600 });

  await database.query(
    `update signers set signing_token_hash = $1, signing_token_expires_at = $2 where id = $3`,
    [link.tokenHash, link.exp, second.id],
  );
  await recordSignerConsent(
    link.token,
    { disclosureVersion: ELECTRONIC_RECORDS_DISCLOSURE_VERSION },
    { database },
  );

  // No billing is asked of them, and none they send is kept.
  await submitSigningForToken(
    link.token,
    submission(second.fieldId, { lastName: "Más" }),
    options,
  );

  const stored = await readEnvelope(envelope.envelopeId);

  assert.equal(stored.status, "completed");
  assert.equal(stored.billing_status, "pending");
  assert.equal(stored.billing?.lastName, "Kovács");
  assert.equal(
    sent.filter((entry) => entry.message.template === "billing_ready").length,
    1,
  );
  assert.match(
    sent.find(
      (entry) =>
        entry.message.template === "completion_notification" &&
        entry.message.to === first.email,
    )?.message.textBody ?? "",
    /Fizetendő előleg: 300 000 Ft/,
  );
  assert.doesNotMatch(
    sent.find(
      (entry) =>
        entry.message.template === "completion_notification" &&
        entry.message.to === second.email,
    )?.message.textBody ?? "",
    /Fizetendő előleg/,
  );
});

test("a partner contract signs as before: no billing, no invoicing signal", async () => {
  const envelope = await createEnvelope({ contractType: "partner" });
  const signer = envelope.signers[0]!;
  const payload = await getSigningPayloadForToken(signer.token, { database });

  assert.equal(payload.customerContract ?? null, null);

  const { sent, service } = recordingEmailService();
  const response = await submitSigningForToken(
    signer.token,
    submission(signer.fieldId, BILLING),
    {
      database,
      emailService: service,
      storageService: envelope.storageService,
    },
  );
  const stored = await readEnvelope(envelope.envelopeId);

  assert.equal(stored.status, "completed");
  assert.equal(stored.billing, null);
  assert.equal(stored.billing_status, null);
  assert.doesNotMatch(response.redirectPath, /deposit=/);
  assert.equal(
    sent.some((entry) => entry.message.template === "billing_ready"),
    false,
  );
  assert.equal(
    sent.some((entry) => entry.message.textBody.includes("Fizetendő előleg")),
    false,
  );

  await assert.rejects(
    setBillingStatusForUser(
      envelope.userId,
      envelope.envelopeId,
      "invoiced",
      database,
    ),
    (error: unknown) => {
      assert.ok(error instanceof BillingStatusError);
      assert.equal(error.statusCode, 409);
      return true;
    },
  );
});

test("only the sender who owns a signed customer contract can mark it invoiced or back", async () => {
  const envelope = await createEnvelope({ contractType: "customer" });
  const signer = envelope.signers[0]!;
  const { service } = recordingEmailService();

  await submitSigningForToken(
    signer.token,
    submission(signer.fieldId, BILLING),
    {
      database,
      emailService: service,
      storageService: envelope.storageService,
    },
  );

  const stranger = randomUUID();

  createdUsers.push(stranger);
  await database.query(
    `insert into public."user" (id, name, email, role) values ($1, 'Other Sender', $2, 'user')`,
    [stranger, `${stranger}@example.test`],
  );
  await assert.rejects(
    setBillingStatusForUser(
      stranger,
      envelope.envelopeId,
      "invoiced",
      database,
    ),
    (error: unknown) => {
      assert.ok(error instanceof BillingStatusError);
      assert.equal(error.statusCode, 404);
      return true;
    },
  );
  assert.equal(
    (await readEnvelope(envelope.envelopeId)).billing_status,
    "pending",
  );

  const invoiced = await setBillingStatusForUser(
    envelope.userId,
    envelope.envelopeId,
    "invoiced",
    database,
  );

  assert.equal(invoiced.billingStatus, "invoiced");
  assert.equal(invoiced.label, "Kiszámlázva");
  assert.equal(
    (await readEnvelope(envelope.envelopeId)).billing_status,
    "invoiced",
  );

  await setBillingStatusForUser(
    envelope.userId,
    envelope.envelopeId,
    "pending",
    database,
  );
  assert.equal(
    (await readEnvelope(envelope.envelopeId)).billing_status,
    "pending",
  );
});
