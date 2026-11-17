import { randomUUID } from "node:crypto";

import { PDFDocument, type PDFImage, type PDFPage, rgb } from "pdf-lib";

import {
  billingFullName,
  formatBillingAddress,
  formatForint,
  transferDeadlineLabel,
} from "../customer-contract.ts";
import {
  auditEventRecordSchema,
  type AuditEventRecord,
  type EnvelopeRecord,
} from "../schemas/envelope.ts";
import type { FieldRecord } from "../schemas/field.ts";
import type { SignerRecord } from "../schemas/signer.ts";
import { buildSignatureManifestation } from "../signature-meanings.ts";
import { canonicalJson } from "../utils/canonical-json.ts";
import { normalizedRectToPdfRect } from "../utils/pdf-coords.ts";
import { embedTextFaces, type TextFace } from "./pdf-fonts.ts";
import { sha256Hex } from "./pdf-seal.ts";
import { getBranding } from "../settings.ts";
import {
  finishSignerSignedPdf,
  getSealIdentity,
  saveInstallSealedPdf,
  type SealPurpose,
} from "./seal-identity.ts";
import {
  buildEnvelopeCertificateKey,
  buildEnvelopeSignedPdfKey,
} from "./storage-keys.ts";
import {
  createStorageService,
  type StorageObjectRef,
  type StorageService,
} from "./storage.ts";

const DEFAULT_AUDIT_PAGE_SIZE = {
  height: 792,
  width: 612,
} as const;

export type StoredSealedPdf = StorageObjectRef & {
  body: Uint8Array;
  sha256: string;
};

export type FinalizedEnvelopeArtifacts = {
  certificate: StoredSealedPdf;
  generatedAt: number;
  recipientCertificate: StoredSealedPdf;
  signedPdf: StoredSealedPdf;
};

/** Saves a finished PDF. The default seals it with the install's key. */
export type PdfSealer = (
  pdfDocument: PDFDocument,
  purpose: SealPurpose,
) => Promise<Uint8Array>;

const defaultSealer: PdfSealer = (pdfDocument, purpose) =>
  saveInstallSealedPdf(pdfDocument, purpose);

/**
 * The install's sealer, with what it reads from the database (the seal key
 * and the install's name) read now. Sealing with it then needs no database
 * connection, so a caller can seal while it holds one in a transaction
 * without waiting on a pool that its own concurrent requests have filled.
 */
export async function loadInstallSealer(): Promise<PdfSealer> {
  const identity = await getSealIdentity();
  const branding = await getBranding();

  return (pdfDocument, purpose) =>
    saveInstallSealedPdf(pdfDocument, purpose, { branding, identity });
}

const CERTIFICATE_FINGERPRINT_VERSION = 1;

/**
 * A SHA-256 over every audit event the certificate is built from, in order,
 * unredacted. Printed on both certificates, so the record held by the sender
 * can later be shown to be the one the certificate was made from.
 */
export function computeAuditFingerprint(
  auditEvents: readonly AuditEventRecord[],
): string {
  return sha256Hex(
    new TextEncoder().encode(
      canonicalJson({
        // One fixed order (time, then id by code unit), whatever order the
        // list was built or read back in.
        events: [...auditEvents]
          .sort(
            (left, right) =>
              (left.createdAt ?? 0) - (right.createdAt ?? 0) ||
              (String(left.id) < String(right.id)
                ? -1
                : String(left.id) > String(right.id)
                  ? 1
                  : 0),
          )
          .map((event) => [
            event.id,
            event.createdAt,
            event.event,
            event.actorType,
            event.actorEmail ?? null,
            event.ipAddress ?? null,
            event.userAgent ?? null,
            event.metadata ?? null,
          ]),
        version: CERTIFICATE_FINGERPRINT_VERSION,
      }),
    ),
  );
}

export class PdfFinalizeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfFinalizeError";
  }
}

function redactAuditEventMetadataForRecipients(
  metadata: AuditEventRecord["metadata"],
): AuditEventRecord["metadata"] {
  if (!metadata) {
    return null;
  }

  const nextMetadata = { ...metadata };

  delete nextMetadata.signerEmail;
  // Who an email went to is another party's address.
  delete nextMetadata.recipient;

  return Object.keys(nextMetadata).length > 0 ? nextMetadata : null;
}

function redactAuditEventForRecipients(
  event: AuditEventRecord,
): AuditEventRecord {
  return auditEventRecordSchema.parse({
    ...event,
    actorEmail:
      event.actorType === "signer" ? null : (event.actorEmail ?? null),
    ipAddress: null,
    metadata: redactAuditEventMetadataForRecipients(event.metadata ?? null),
    userAgent: null,
  });
}

type WrappedLine = {
  font: TextFace;
  size: number;
  text: string;
};

function formatAuditTimestamp(timestamp: number | null | undefined): string {
  if (typeof timestamp !== "number") {
    return "—";
  }

  const value = new Date(timestamp * 1000);

  return value.toISOString().replace(".000Z", " UTC");
}

function chunkLongWord(
  font: TextFace,
  size: number,
  maxWidth: number,
  word: string,
): string[] {
  if (font.widthOfTextAtSize(word, size) <= maxWidth) {
    return [word];
  }

  const chunks: string[] = [];
  let buffer = "";

  for (const character of word) {
    const candidate = `${buffer}${character}`;

    if (buffer && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      chunks.push(buffer);
      buffer = character;
      continue;
    }

    buffer = candidate;
  }

  if (buffer) {
    chunks.push(buffer);
  }

  return chunks;
}

function wrapText(
  font: TextFace,
  size: number,
  maxWidth: number,
  text: string,
): WrappedLine[] {
  const normalized = text.trim();

  if (!normalized) {
    return [];
  }

  const rawWords = normalized
    .split(/\s+/)
    .flatMap((word) => chunkLongWord(font, size, maxWidth, word));
  const lines: string[] = [];
  let currentLine = "";

  for (const word of rawWords) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    currentLine = word;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.map((line) => ({
    font,
    size,
    text: line,
  }));
}

function fitTextSize(
  font: TextFace,
  text: string,
  maxWidth: number,
  maxHeight: number,
  preferredSize: number,
): number {
  let size = Math.min(preferredSize, maxHeight);

  while (size > 4 && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.5;
  }

  return Math.max(4, size);
}

function getFieldPadding(widthPt: number, heightPt: number): number {
  return Math.max(2, Math.min(widthPt, heightPt) * 0.12);
}

export function shouldStampField(field: FieldRecord): boolean {
  if (field.type === "checkbox" || field.type === "radio") {
    return typeof field.checked === "boolean";
  }

  return typeof field.submittedAt === "number";
}

function buildCompletedAuditEvent(
  envelopeId: string,
  generatedAt: number,
): AuditEventRecord {
  return {
    actorEmail: null,
    actorType: "system",
    createdAt: generatedAt,
    envelopeId,
    event: "completed",
    id: randomUUID(),
    ipAddress: null,
    metadata: null,
    userAgent: null,
  };
}

async function getEmbeddedPng(
  imageKey: string,
  imageCache: Map<string, PDFImage>,
  pdfDocument: PDFDocument,
  storageService: StorageService,
): Promise<PDFImage> {
  const cachedImage = imageCache.get(imageKey);

  if (cachedImage) {
    return cachedImage;
  }

  const imageObject = await storageService.getObject(imageKey);
  const embeddedImage = await pdfDocument.embedPng(imageObject.body);

  imageCache.set(imageKey, embeddedImage);

  return embeddedImage;
}

function stripCompletedAuditEvents(
  auditEvents: readonly AuditEventRecord[],
): AuditEventRecord[] {
  return auditEvents.filter((event) => event.event !== "completed");
}

function getEnvelopeStatusLabel(status: EnvelopeRecord["status"]): string {
  switch (status) {
    case "completed":
      return "Lezárva";
    case "declined":
      return "Elutasítva";
    case "voided":
      return "Visszavonva";
    case "sent":
      return "Elküldve";
    case "draft":
      return "Piszkozat";
    default:
      return status;
  }
}

/** Hungarian wording for each audit event type, printed in the certificate. */
const AUDIT_EVENT_LABELS: Record<AuditEventRecord["event"], string> = {
  completed: "lezárva",
  consented: "hozzájárulás az elektronikus ügyintézéshez",
  created: "létrehozva",
  deadline_changed: "határidő módosítva",
  declined: "elutasítva",
  email_sent: "e-mail elküldve",
  expired: "lejárt",
  reauthentication_failed: "sikertelen újbóli azonosítás",
  reminded_auto: "automatikus emlékeztető",
  reminded_manual: "kézi emlékeztető",
  sent: "elküldve aláírásra",
  signed: "aláírva",
  verification_failed: "sikertelen ellenőrzés",
  verified: "sikeres ellenőrzés",
  viewed: "megtekintve",
  voided: "visszavonva",
};

const AUDIT_ACTOR_LABELS: Record<string, string> = {
  sender: "küldő",
  signer: "aláíró",
  system: "rendszer",
};

const SIGNATURE_METHOD_LABELS: Record<string, string> = {
  drawn: "rajzolt",
  typed: "gépelt",
};

// Hungarian letters outside Latin-1 (Ő ő Ű ű) and the low opening quote.
// The font subset's certificate baseline covers Latin-1 only, so these are
// added to the text the fonts are cut for whenever the wording is drawn.
const CERTIFICATE_WORDING_EXTRA_CHARACTERS = "ŐőŰű„”";

function getCertificateTitle(envelope: EnvelopeRecord): string {
  return envelope.status === "completed"
    ? "Hitelesítési igazolás"
    : "Hitelesítési igazolás";
}

function getTerminalTimestampLabel(envelope: EnvelopeRecord): string {
  switch (envelope.status) {
    case "completed":
      return "Lezárás időpontja";
    case "declined":
      return "Elutasítás időpontja";
    case "voided":
      return "Visszavonás időpontja";
    default:
      return "Rögzítés időpontja";
  }
}

function resolveTerminalTimestamp(
  envelope: EnvelopeRecord,
  fallbackTimestamp: number,
): number {
  switch (envelope.status) {
    case "completed":
      return envelope.completedAt ?? fallbackTimestamp;
    case "declined":
      return envelope.declinedAt ?? fallbackTimestamp;
    case "voided":
      return envelope.voidedAt ?? fallbackTimestamp;
    default:
      return fallbackTimestamp;
  }
}

function buildCertificateAuditEvents(input: {
  auditEvents: AuditEventRecord[];
  envelope: EnvelopeRecord;
  terminalTimestamp: number;
}): AuditEventRecord[] {
  const baseAuditEvents =
    input.envelope.status === "completed"
      ? stripCompletedAuditEvents(input.auditEvents)
      : input.auditEvents;
  const terminalAuditEvents =
    input.envelope.status === "completed"
      ? [buildCompletedAuditEvent(input.envelope.id, input.terminalTimestamp)]
      : [];

  return [...baseAuditEvents, ...terminalAuditEvents].sort(
    (left, right) =>
      left.createdAt - right.createdAt || left.id.localeCompare(right.id),
  );
}

export async function stampFieldValue(
  field: FieldRecord,
  page: PDFPage,
  fonts: {
    auditRegular: TextFace;
    signature: TextFace;
  },
  imageCache: Map<string, PDFImage>,
  pdfDocument: PDFDocument,
  storageService: StorageService,
): Promise<void> {
  if (!shouldStampField(field)) {
    return;
  }

  const rect = normalizedRectToPdfRect(field, {
    heightPt: page.getHeight(),
    widthPt: page.getWidth(),
  });
  const padding = getFieldPadding(rect.widthPt, rect.heightPt);

  switch (field.type) {
    case "signature":
    case "initials": {
      if (field.inputMethod === "drawn" && field.imageKey) {
        const image = await getEmbeddedPng(
          field.imageKey,
          imageCache,
          pdfDocument,
          storageService,
        );
        const maxWidth = Math.max(4, rect.widthPt - padding * 2);
        const maxHeight = Math.max(4, rect.heightPt - padding * 2);
        const scaled = image.scaleToFit(maxWidth, maxHeight);
        const x = rect.xPt + (rect.widthPt - scaled.width) / 2;
        const y = rect.yPt + (rect.heightPt - scaled.height) / 2;

        page.drawImage(image, {
          height: scaled.height,
          width: scaled.width,
          x,
          y,
        });

        return;
      }

      const signatureValue = field.value?.trim();

      if (!signatureValue) {
        return;
      }

      const maxWidth = Math.max(12, rect.widthPt - padding * 2);
      const maxHeight = Math.max(10, rect.heightPt - padding * 2);
      const fontSize = fitTextSize(
        fonts.signature,
        signatureValue,
        maxWidth,
        maxHeight,
        Math.min(maxHeight, rect.heightPt * 0.9),
      );

      fonts.signature.drawText(page, signatureValue, {
        color: rgb(0.12, 0.12, 0.12),
        size: fontSize,
        x: rect.xPt + padding,
        y: rect.yPt + (rect.heightPt - fontSize) / 2 + fontSize * 0.1,
      });

      return;
    }
    case "date":
    case "text":
    case "number":
    case "dropdown": {
      const textValue = field.value?.trim();

      if (!textValue) {
        return;
      }

      const maxWidth = Math.max(12, rect.widthPt - padding * 2);
      const maxHeight = Math.max(10, rect.heightPt - padding * 2);
      const fontSize = fitTextSize(
        fonts.auditRegular,
        textValue,
        maxWidth,
        maxHeight,
        Math.min(maxHeight, rect.heightPt * 0.64),
      );

      fonts.auditRegular.drawText(page, textValue, {
        color: rgb(0.12, 0.12, 0.12),
        size: fontSize,
        x: rect.xPt + padding,
        y: rect.yPt + (rect.heightPt - fontSize) / 2 + fontSize * 0.2,
      });

      return;
    }
    case "checkbox": {
      const boxSize = Math.min(rect.widthPt, rect.heightPt, 14);
      const x = rect.xPt + padding / 2;
      const y = rect.yPt + (rect.heightPt - boxSize) / 2;

      page.drawRectangle({
        borderColor: rgb(0.18, 0.18, 0.18),
        borderWidth: 1.1,
        height: boxSize,
        width: boxSize,
        x,
        y,
      });

      if (field.checked) {
        page.drawLine({
          color: rgb(0.08, 0.08, 0.08),
          end: { x: x + boxSize * 0.42, y: y + boxSize * 0.2 },
          start: { x: x + boxSize * 0.16, y: y + boxSize * 0.5 },
          thickness: 1.4,
        });
        page.drawLine({
          color: rgb(0.08, 0.08, 0.08),
          end: { x: x + boxSize * 0.84, y: y + boxSize * 0.82 },
          start: { x: x + boxSize * 0.4, y: y + boxSize * 0.18 },
          thickness: 1.4,
        });
      }

      return;
    }
    case "radio": {
      // A ring for every button, and a dot in the one that was chosen.
      const diameter = Math.min(rect.widthPt, rect.heightPt, 14);
      const center = {
        x: rect.xPt + padding / 2 + diameter / 2,
        y: rect.yPt + rect.heightPt / 2,
      };

      page.drawCircle({
        borderColor: rgb(0.18, 0.18, 0.18),
        borderWidth: 1.1,
        size: diameter / 2,
        ...center,
      });

      if (field.checked) {
        page.drawCircle({
          color: rgb(0.08, 0.08, 0.08),
          size: diameter * 0.24,
          ...center,
        });
      }

      return;
    }
    default:
      return;
  }
}

/**
 * Prints a Part 11 signature's manifestation just under the signature, or
 * just above it when the field sits at the foot of the page.
 */
function stampSignatureManifestation(
  field: FieldRecord,
  page: PDFPage,
  font: TextFace,
  text: string,
): void {
  const pageWidth = page.getWidth();
  const rect = normalizedRectToPdfRect(field, {
    heightPt: page.getHeight(),
    widthPt: pageWidth,
  });
  const margin = 2;
  const fullWidth = pageWidth - margin * 2;
  const minimumSize = 5;
  // One line when it fits at a readable size, otherwise one line per part
  // (name, time, meaning), so nothing is shrunk away or runs off the page.
  const oneLineSize = fitTextSize(font, text, fullWidth, 7, 6.5);
  const lines =
    font.widthOfTextAtSize(text, oneLineSize) <= fullWidth &&
    oneLineSize >= minimumSize
      ? [text]
      : text.split(" | ");
  const size = Math.max(
    minimumSize,
    Math.min(
      ...lines.map((line) => fitTextSize(font, line, fullWidth, 7, 6.5)),
    ),
  );
  const lineHeight = size + 1.5;
  const blockHeight = lineHeight * lines.length;
  const below = rect.yPt - blockHeight;
  // The top line's baseline. Below the field when there is room, above it
  // at the foot of the page.
  const top =
    below >= margin
      ? rect.yPt - lineHeight
      : Math.min(
          rect.yPt + rect.heightPt + blockHeight - size,
          page.getHeight() - size - margin,
        );

  lines.forEach((line, index) => {
    const width = font.widthOfTextAtSize(line, size);
    // Starts under the field, moved left if it would run off the page.
    const x = Math.max(margin, Math.min(rect.xPt, pageWidth - width - margin));

    font.drawText(page, line, {
      color: rgb(0.2, 0.2, 0.24),
      size,
      x,
      y: top - index * lineHeight,
    });
  });
}

type AuditLineColor = "ink" | "muted";

type AuditLine = WrappedLine & {
  color?: AuditLineColor;
  gapAfter?: number;
  gapBefore?: number;
  indent?: number;
  /** A thin rule across the page above this line. */
  ruleBefore?: boolean;
};

const AUDIT_COLORS = {
  ink: rgb(0.18, 0.15, 0.13),
  muted: rgb(0.47, 0.43, 0.4),
  rule: rgb(0.87, 0.84, 0.81),
};

function buildAuditLines(input: {
  auditEvents: AuditEventRecord[];
  auditFingerprint?: string | null;
  completedAt: number;
  copyRecipients?: readonly CertificateCopyRecipient[];
  envelope: EnvelopeRecord;
  fonts: {
    bold: TextFace;
    regular: TextFace;
  };
  maxWidth: number;
  redactForRecipients?: boolean;
  signedPdfSha256?: string | null;
  signers: SignerRecord[];
}) {
  const titleFontSize = 20;
  const sectionFontSize = 8.5;
  const bodyFontSize = 9.25;
  const lines: AuditLine[] = [];

  const pushParagraph = (
    text: string,
    font: TextFace,
    size: number,
    options: {
      color?: AuditLineColor;
      gapAfter?: number;
      gapBefore?: number;
      indent?: number;
      ruleBefore?: boolean;
    } = {},
  ) => {
    const indent = options.indent ?? 0;
    const wrapped = wrapText(font, size, input.maxWidth - indent, text);

    if (wrapped.length === 0) {
      return;
    }

    wrapped.forEach((line, index) => {
      lines.push({
        ...line,
        color: options.color,
        gapAfter: index === wrapped.length - 1 ? options.gapAfter : undefined,
        gapBefore: index === 0 ? options.gapBefore : undefined,
        indent,
        ruleBefore: index === 0 ? options.ruleBefore : undefined,
      });
    });
  };
  // A section: a small, spaced, muted heading with a thin rule above it.
  const pushSection = (text: string) =>
    pushParagraph(text.toUpperCase(), input.fonts.bold, sectionFontSize, {
      color: "muted",
      gapAfter: 8,
      gapBefore: 18,
      ruleBefore: true,
    });
  // A "label: value" row, the label muted.
  const pushField = (label: string, value: string) =>
    pushParagraph(`${label}: ${value}`, input.fonts.regular, bodyFontSize, {
      gapAfter: 2,
    });

  const terminalTimestamp = resolveTerminalTimestamp(
    input.envelope,
    input.completedAt,
  );
  const auditEvents = buildCertificateAuditEvents({
    auditEvents: input.auditEvents,
    envelope: input.envelope,
    terminalTimestamp,
  });

  pushParagraph(
    getCertificateTitle(input.envelope),
    input.fonts.bold,
    titleFontSize,
    {
      gapAfter: 4,
    },
  );
  pushParagraph(input.envelope.title, input.fonts.regular, 12, {
    color: "muted",
    gapAfter: 6,
  });

  pushSection("A dokumentum");
  pushField("Állapot", getEnvelopeStatusLabel(input.envelope.status));
  pushField(
    getTerminalTimestampLabel(input.envelope),
    formatAuditTimestamp(terminalTimestamp),
  );
  pushField("Eredeti PDF", input.envelope.sourcePdfFilename);
  pushField("Azonosító", input.envelope.id);
  pushField("Eredeti dokumentum SHA-256", input.envelope.sourcePdfHash);
  if (input.signedPdfSha256) {
    pushField("Aláírt dokumentum SHA-256", input.signedPdfSha256);
  }

  if (input.auditFingerprint) {
    pushField("Eseménynapló ujjlenyomata (SHA-256)", input.auditFingerprint);
  }

  pushSection("Aláírók");

  for (const signer of input.signers) {
    const actionLabel = getSignerCertificateActionLabel(input.envelope, signer);
    const signerLabel = input.redactForRecipients
      ? `${signer.signOrder}. ${signer.name}`
      : `${signer.signOrder}. ${signer.name} <${signer.email}>`;

    pushParagraph(signerLabel, input.fonts.bold, 10, { gapBefore: 6 });
    pushParagraph(actionLabel, input.fonts.regular, bodyFontSize, {
      gapAfter: 2,
      indent: 14,
    });

    for (const detail of describeSignerEvidence(
      signer,
      input.auditEvents,
      Boolean(input.redactForRecipients),
    )) {
      pushParagraph(detail, input.fonts.regular, bodyFontSize - 0.5, {
        color: "muted",
        indent: 14,
      });
    }
  }

  if (input.copyRecipients && input.copyRecipients.length > 0) {
    pushSection("Másolatot kapott címzettek");
    pushParagraph(
      "Megkapták a lezárt dokumentum másolatát. Nem írták alá.",
      input.fonts.regular,
      bodyFontSize,
    );

    for (const recipient of input.copyRecipients) {
      pushParagraph(
        input.redactForRecipients
          ? recipient.name
          : `${recipient.name} <${recipient.email}>`,
        input.fonts.regular,
        bodyFontSize,
      );
    }
  }

  const billing =
    input.envelope.contractType === "customer" ? input.envelope.billing : null;

  if (billing) {
    const offer = input.envelope.offer ?? null;

    pushSection("Számlázási adatok");
    pushField("Név", billingFullName(billing));
    pushField("Számlázási cím", formatBillingAddress(billing));
    pushField("Tervezési cím", billing.projectAddress);

    if (!input.redactForRecipients) {
      pushField("Telefonszám", billing.phone);
    }

    if (offer) {
      pushField("Ajánlat sorszáma", offer.offerNumber);
      pushField("Árajánlat összege", formatForint(offer.totalAmount));
      pushField("Fizetendő előleg", formatForint(offer.depositAmount));
      pushField(
        "Utalási határidő",
        transferDeadlineLabel(offer.transferDeadlineDays),
      );
    }

    pushField(
      "Elfogadta",
      `ÁSZF, Adatvédelmi Nyilatkozat, fizetési kötelezettség (${formatAuditTimestamp(billing.acceptedAt)})`,
    );
  }

  pushSection("Eseménynapló");

  for (const event of auditEvents) {
    const actor =
      event.actorEmail ??
      (typeof event.metadata?.signerEmail === "string"
        ? event.metadata.signerEmail
        : (AUDIT_ACTOR_LABELS[event.actorType] ?? event.actorType));
    const signerName =
      typeof event.metadata?.signerName === "string"
        ? event.metadata.signerName
        : null;
    const actorLabel =
      signerName && actor !== signerName ? `${signerName} <${actor}>` : actor;

    pushParagraph(
      `${formatAuditTimestamp(event.createdAt)}  ·  ${AUDIT_EVENT_LABELS[event.event] ?? event.event}`,
      input.fonts.bold,
      bodyFontSize,
      { gapBefore: 4 },
    );
    pushParagraph(actorLabel, input.fonts.regular, bodyFontSize - 0.5, {
      color: "muted",
      indent: 14,
    });

    for (const detail of describeEventEvidence(event)) {
      pushParagraph(detail, input.fonts.regular, bodyFontSize - 0.5, {
        color: "muted",
        indent: 14,
      });
    }
  }

  pushSection("Hogyan ellenőrizheted ezt az igazolást");
  pushParagraph(
    "Az aláírt dokumentumot és ezt az igazolást is digitális aláírással, elektronikus bélyegzővel zártuk le. A PDF-olvasó csak akkor mutatja érvényesnek a bélyegzőt, ha a fájl a lezárás óta nem változott. A fenti SHA-256 értékeket ennek az oldalnak a Dokumentum ellenőrzése oldalán is ellenőrizheted.",
    input.fonts.regular,
    bodyFontSize,
  );

  return lines;
}

const AUTHENTICATION_LABELS: Record<string, string> = {
  access_code: "a küldőtől kapott hozzáférési kód",
  account: "saját fiók, e-mail-címmel és jelszóval megnyitva",
  email_code: "e-mailben küldött egyszeri kód",
};

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

/**
 * A signature the signer made with their own certificate through the
 * install's signing provider: its level, the provider, and the certificate.
 */
function describeProviderSignatureEvidence(
  signed: AuditEventRecord | undefined,
  redacted: boolean,
): string[] {
  const value = signed?.metadata?.providerSignature;

  if (!value || typeof value !== "object") {
    return [];
  }

  const signature = value as Record<string, unknown>;
  const level =
    signature.level === "qualified"
      ? "minősített elektronikus aláírás"
      : signature.level === "advanced"
        ? "fokozott biztonságú elektronikus aláírás"
        : null;

  if (!level) {
    return [];
  }

  const provider =
    typeof signature.provider === "string"
      ? `, szolgáltató: ${signature.provider}`
      : "";
  const method =
    typeof signature.method === "string" ? ` (${signature.method})` : "";
  const details = [
    `Aláírás típusa: ${level}${provider}${method}; az aláírás az aláírt PDF-ben található`,
  ];

  if (!redacted && typeof signature.certificateSubject === "string") {
    const issuer =
      typeof signature.certificateIssuer === "string"
        ? `, kibocsátó: ${signature.certificateIssuer}`
        : "";
    const serial =
      typeof signature.certificateSerialNumber === "string"
        ? `, sorozatszám: ${signature.certificateSerialNumber}`
        : "";
    const validTo =
      typeof signature.certificateValidTo === "number"
        ? `, érvényes eddig: ${formatAuditTimestamp(signature.certificateValidTo)}`
        : "";

    details.push(
      `Aláíró tanúsítvány: ${signature.certificateSubject}${issuer}${serial}${validTo}`,
    );
  }

  if (signature.timestamped === true) {
    details.push(
      "Az aláírás időbélyeg-szolgáltatótól származó időbélyeget tartalmaz",
    );
  }

  return details;
}

/** What the record shows about how one signer was identified and agreed. */
function describeSignerEvidence(
  signer: SignerRecord,
  auditEvents: readonly AuditEventRecord[],
  redacted: boolean,
): string[] {
  const forSigner = auditEvents.filter(
    (event) => event.metadata?.signerId === signer.id,
  );
  const details: string[] = [];
  const signed = forSigner.find((event) => event.event === "signed");
  const consented = forSigner.find((event) => event.event === "consented");
  const checks = [
    "az e-mailben kapott aláírási link birtoklása",
    ...readStringArray(signed?.metadata?.authMethods).map(
      (method) => AUTHENTICATION_LABELS[method] ?? method,
    ),
  ];

  const part11 =
    signed?.metadata?.part11 && typeof signed.metadata.part11 === "object"
      ? (signed.metadata.part11 as Record<string, unknown>)
      : null;

  if (part11) {
    checks.push("az aláíráshoz újra megadott e-mail-cím és jelszó");
  }

  if (signed || signer.status === "declined") {
    details.push(`Azonosítás módja: ${checks.join(", ")}`);
  }

  const manifestation = buildSignatureManifestation(signer);

  if (part11 && manifestation) {
    details.push(manifestation);

    if (typeof part11.meaningStatement === "string") {
      details.push(
        `Az aláíró által megerősített jelentés: „${part11.meaningStatement}”`,
      );
    }
  }

  if (consented) {
    details.push(
      `Hozzájárult az elektronikus iratok és aláírások használatához: ${formatAuditTimestamp(consented.createdAt)}${
        typeof consented.metadata?.disclosureVersion === "string"
          ? ` (tájékoztató verziója: ${consented.metadata.disclosureVersion})`
          : ""
      }`,
    );
  }

  const methods = readStringArray(signed?.metadata?.signatureMethods).map(
    (method) => SIGNATURE_METHOD_LABELS[method] ?? method,
  );

  if (methods.length > 0) {
    details.push(`Aláírás módja: ${methods.join(", ")}`);
  }

  details.push(...describeProviderSignatureEvidence(signed, redacted));

  if (!redacted && signed?.ipAddress) {
    details.push(`Aláírás IP-címe: ${signed.ipAddress}`);
  }

  return details;
}

function describeEventEvidence(event: AuditEventRecord): string[] {
  const details: string[] = [];
  const metadata = event.metadata ?? {};

  if (event.ipAddress || event.userAgent) {
    details.push(
      [
        event.ipAddress ? `IP-cím: ${event.ipAddress}` : null,
        event.userAgent ? `böngésző: ${event.userAgent.slice(0, 160)}` : null,
      ]
        .filter(Boolean)
        .join(" | "),
    );
  }

  if (typeof metadata.timezoneOffsetMinutes === "number") {
    const offset = -metadata.timezoneOffsetMinutes;
    const sign = offset >= 0 ? "+" : "-";
    const hours = Math.floor(Math.abs(offset) / 60);
    const minutes = Math.abs(offset) % 60;

    details.push(
      `az aláíró órája: UTC${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
    );
  }

  if (event.event === "email_sent") {
    const recipient =
      typeof metadata.recipient === "string" ? metadata.recipient : null;
    const kind =
      typeof metadata.template === "string" ? metadata.template : null;
    const messageId =
      typeof metadata.messageId === "string" ? metadata.messageId : null;

    details.push(
      [
        kind ? `e-mail (${kind})` : "e-mail",
        recipient ? `címzett: ${recipient}` : null,
        messageId
          ? `a levelezőszolgáltató ezzel az azonosítóval fogadta: ${messageId}`
          : null,
      ]
        .filter(Boolean)
        .join(", "),
    );
  }

  if (event.event === "verified" && typeof metadata.method === "string") {
    details.push(
      `sikeres: ${AUTHENTICATION_LABELS[metadata.method] ?? metadata.method}`,
    );
  }

  if (
    event.event === "verification_failed" &&
    typeof metadata.method === "string"
  ) {
    details.push(
      `hibás: ${AUTHENTICATION_LABELS[metadata.method] ?? metadata.method}`,
    );
  }

  return details;
}

function getSignerCertificateActionLabel(
  envelope: EnvelopeRecord,
  signer: SignerRecord,
): string {
  switch (signer.status) {
    case "signed":
      return `Aláírás időpontja: ${formatAuditTimestamp(signer.signedAt)}`;
    case "declined":
      return `Elutasítás időpontja: ${formatAuditTimestamp(signer.declinedAt)}`;
    case "notified":
      if (envelope.status === "voided") {
        return "Aláírásra várt, amikor az aláírási kérést visszavonták";
      }

      if (envelope.status === "declined") {
        return "Aláírásra várt, amikor az aláírási kérést elutasították";
      }

      return "Aláírásra vár";
    case "pending":
      return "Még nem került sorra";
    default: {
      const exhaustiveStatus: never = signer.status;
      return exhaustiveStatus;
    }
  }
}

function appendAuditTrailPages(input: {
  auditEvents: AuditEventRecord[];
  auditFingerprint?: string | null;
  completedAt: number;
  copyRecipients?: readonly CertificateCopyRecipient[];
  envelope: EnvelopeRecord;
  fonts: {
    bold: TextFace;
    regular: TextFace;
  };
  pdfDocument: PDFDocument;
  redactForRecipients?: boolean;
  signedPdfSha256?: string | null;
  signers: SignerRecord[];
}) {
  const templatePage = input.pdfDocument.getPageCount()
    ? input.pdfDocument.getPage(0)
    : null;
  const pageSize = templatePage
    ? {
        height: templatePage.getHeight(),
        width: templatePage.getWidth(),
      }
    : DEFAULT_AUDIT_PAGE_SIZE;
  const margin = 48;
  const maxWidth = pageSize.width - margin * 2;
  const lineHeightMultiplier = 1.24;
  const lines = buildAuditLines({
    auditEvents: input.auditEvents,
    auditFingerprint: input.auditFingerprint,
    completedAt: input.completedAt,
    copyRecipients: input.copyRecipients,
    envelope: input.envelope,
    fonts: input.fonts,
    maxWidth,
    redactForRecipients: input.redactForRecipients,
    signedPdfSha256: input.signedPdfSha256,
    signers: input.signers,
  });

  // Room kept at the bottom of each page for its footer.
  const footerSpace = 28;
  const pages: PDFPage[] = [];
  const addPage = () => {
    const added = input.pdfDocument.addPage([pageSize.width, pageSize.height]);

    pages.push(added);
    return added;
  };
  let page = addPage();
  let cursorY = pageSize.height - margin;

  for (const line of lines) {
    const lineHeight = line.size * lineHeightMultiplier;
    const ruleSpace = line.ruleBefore ? 12 : 0;

    if (
      cursorY - (line.gapBefore ?? 0) - ruleSpace - lineHeight <
      margin + footerSpace
    ) {
      page = addPage();
      cursorY = pageSize.height - margin;
    } else {
      cursorY -= line.gapBefore ?? 0;
    }

    if (line.ruleBefore) {
      page.drawLine({
        color: AUDIT_COLORS.rule,
        end: { x: pageSize.width - margin, y: cursorY },
        start: { x: margin, y: cursorY },
        thickness: 0.6,
      });
      cursorY -= ruleSpace;
    }

    line.font.drawText(page, line.text, {
      color: AUDIT_COLORS[line.color ?? "ink"],
      size: line.size,
      x: margin + (line.indent ?? 0),
      y: cursorY - line.size,
    });

    cursorY -= lineHeight;
    cursorY -= line.gapAfter ?? 0;
  }

  // A quiet footer on every certificate page: what it is and where it is.
  pages.forEach((footerPage, index) => {
    const text = `${input.envelope.title}  ·  Hitelesítési igazolás  ·  ${String(index + 1)}/${String(pages.length)}`;
    const size = 7.5;
    const width = input.fonts.regular.widthOfTextAtSize(text, size);

    footerPage.drawLine({
      color: AUDIT_COLORS.rule,
      end: { x: pageSize.width - margin, y: margin + 14 },
      start: { x: margin, y: margin + 14 },
      thickness: 0.6,
    });
    input.fonts.regular.drawText(footerPage, text, {
      color: AUDIT_COLORS.muted,
      size,
      x: Math.max(margin, (pageSize.width - width) / 2),
      y: margin,
    });
  });
}

/** Someone sent a copy of the finished document who did not sign it. */
export type CertificateCopyRecipient = { email: string; name: string };

type CertificateInput = {
  auditEvents: AuditEventRecord[];
  copyRecipients?: readonly CertificateCopyRecipient[];
  envelope: EnvelopeRecord;
  redactForRecipients?: boolean;
  /** The finished signed PDF's SHA-256, printed when there is one. */
  signedPdfSha256?: string | null;
  signers: SignerRecord[];
};

type SealOption = {
  seal?: PdfSealer;
};

function assertTerminalEnvelope(envelope: EnvelopeRecord, noun: string) {
  if (
    envelope.status !== "completed" &&
    envelope.status !== "declined" &&
    envelope.status !== "voided"
  ) {
    throw new PdfFinalizeError(
      `${noun} can only be generated for terminal envelopes.`,
    );
  }
}

export async function storeEnvelopeCertificatePdf(
  input: CertificateInput & { certificate: StorageObjectRef },
  {
    seal,
    storageService = createStorageService(),
  }: SealOption & {
    storageService?: StorageService;
  } = {},
): Promise<StoredSealedPdf> {
  assertTerminalEnvelope(input.envelope, "Certificates");

  const body = await renderEnvelopeCertificatePdf(input, { seal });
  const stored = await storageService.putObject({
    body,
    contentType: "application/pdf",
    key: input.certificate.key,
  });

  return { ...stored, body, sha256: sha256Hex(body) };
}

export async function storeRecipientEnvelopeCertificatePdf(
  input: Omit<CertificateInput, "redactForRecipients"> & {
    certificate: StorageObjectRef;
  },
  {
    seal,
    storageService = createStorageService(),
  }: SealOption & {
    storageService?: StorageService;
  } = {},
): Promise<StoredSealedPdf> {
  assertTerminalEnvelope(input.envelope, "Evidence bundles");

  return storeEnvelopeCertificatePdf(
    {
      ...input,
      redactForRecipients: true,
    },
    {
      seal,
      storageService,
    },
  );
}

export async function renderEnvelopeCertificatePdf(
  input: CertificateInput,
  { seal = defaultSealer }: SealOption = {},
): Promise<Uint8Array> {
  assertTerminalEnvelope(input.envelope, "Certificates");

  const pdfDocument = await PDFDocument.create();
  const faces = await embedTextFaces(
    pdfDocument,
    [
      input.envelope,
      input.signers,
      input.auditEvents,
      input.copyRecipients ?? [],
      CERTIFICATE_WORDING_EXTRA_CHARACTERS,
    ],
    { bold: true, certificate: true },
  );
  const terminalTimestamp = resolveTerminalTimestamp(
    input.envelope,
    Math.floor(Date.now() / 1000),
  );

  appendAuditTrailPages({
    auditEvents: input.redactForRecipients
      ? input.auditEvents.map(redactAuditEventForRecipients)
      : input.auditEvents,
    auditFingerprint: computeAuditFingerprint(
      stripCompletedAuditEvents(input.auditEvents),
    ),
    completedAt: terminalTimestamp,
    copyRecipients: input.copyRecipients,
    envelope: input.envelope,
    fonts: faces,
    pdfDocument,
    redactForRecipients: input.redactForRecipients,
    signedPdfSha256: input.signedPdfSha256,
    signers: input.signers,
  });
  pdfDocument.setTitle(`Hitelesítési igazolás: ${input.envelope.title}`);
  pdfDocument.setProducer("SignuDoc");

  return seal(pdfDocument, "certificate");
}

export class SourceDocumentChangedError extends PdfFinalizeError {
  constructor() {
    super(
      "The stored source document no longer matches the one that was sent for signing.",
    );
    this.name = "SourceDocumentChangedError";
  }
}

export async function renderFinalizedEnvelopePdf(
  input: {
    auditEvents: AuditEventRecord[];
    completedAt: number;
    copyRecipients?: readonly CertificateCopyRecipient[];
    envelope: EnvelopeRecord;
    fields: FieldRecord[];
    includeAuditTrail?: boolean;
    signers: SignerRecord[];
    sourcePdfKey: string;
  },
  {
    seal = defaultSealer,
    storageService = createStorageService(),
  }: SealOption & {
    storageService?: StorageService;
  } = {},
): Promise<Uint8Array> {
  const sourcePdfObject = await storageService.getObject(input.sourcePdfKey);

  // The certificate states the source document's hash, so the stamped copy
  // must be made from exactly that file.
  if (sha256Hex(sourcePdfObject.body) !== input.envelope.sourcePdfHash) {
    throw new SourceDocumentChangedError();
  }

  const pdfDocument = await PDFDocument.load(sourcePdfObject.body);

  const stampedFields = input.fields
    .filter(shouldStampField)
    .sort((left, right) => left.page - right.page || left.y - right.y);
  // Part 11: the signer's name, the time and the meaning, printed beside
  // each of their signatures (21 CFR 11.50).
  const manifestations = new Map<string, string>();

  if (input.envelope.part11) {
    for (const signer of input.signers) {
      const text = signer.id ? buildSignatureManifestation(signer) : null;

      if (text && signer.id) {
        manifestations.set(signer.id, text);
      }
    }
  }
  // The signed document embeds glyphs for the stamped values only. The
  // certificate's wording is added when the audit trail is appended to it.
  const faces = await embedTextFaces(
    pdfDocument,
    [
      stampedFields.map((field) => field.value),
      [...manifestations.values()],
      input.includeAuditTrail
        ? [
            input.envelope,
            input.signers,
            input.auditEvents,
            input.copyRecipients ?? [],
            CERTIFICATE_WORDING_EXTRA_CHARACTERS,
          ]
        : [],
    ],
    {
      bold: Boolean(input.includeAuditTrail),
      certificate: Boolean(input.includeAuditTrail),
      signature: stampedFields.some(
        (field) =>
          (field.type === "signature" || field.type === "initials") &&
          field.inputMethod !== "drawn",
      ),
    },
  );
  const imageCache = new Map<string, PDFImage>();

  for (const field of stampedFields) {
    const page = pdfDocument.getPage(field.page - 1);

    if (!page) {
      throw new PdfFinalizeError(
        `Field ${field.id} references missing page ${field.page}.`,
      );
    }

    await stampFieldValue(
      field,
      page,
      { auditRegular: faces.regular, signature: faces.signature },
      imageCache,
      pdfDocument,
      storageService,
    );

    const manifestation =
      field.type === "signature" ? manifestations.get(field.signerId) : null;

    if (manifestation) {
      stampSignatureManifestation(field, page, faces.regular, manifestation);
    }
  }

  try {
    pdfDocument.getForm().flatten();
  } catch {
    // Many source PDFs have no AcroForm. Stamping still produces the final locked view.
  }

  if (input.includeAuditTrail) {
    appendAuditTrailPages({
      auditEvents: stripCompletedAuditEvents(input.auditEvents),
      completedAt: input.completedAt,
      copyRecipients: input.copyRecipients,
      envelope: input.envelope,
      fonts: faces,
      pdfDocument,
      redactForRecipients: true,
      signers: input.signers,
    });
  }

  return seal(pdfDocument, "signed-document");
}

export async function finalizeEnvelope(
  input: {
    auditEvents: AuditEventRecord[];
    copyRecipients?: readonly CertificateCopyRecipient[];
    envelope: EnvelopeRecord;
    fields: FieldRecord[];
    signers: SignerRecord[];
    sourcePdf: StorageObjectRef;
  },
  {
    seal,
    signedRevision,
    storageService = createStorageService(),
  }: SealOption & {
    /**
     * The last signer's revision, when the signers signed with their own
     * certificates: it is the signed document, and gets validation data.
     */
    signedRevision?: Uint8Array;
    storageService?: StorageService;
  } = {},
): Promise<FinalizedEnvelopeArtifacts> {
  const generatedAt = Math.floor(Date.now() / 1000);
  const storageIdentity = {
    envelopeId: input.envelope.id,
    userId: input.envelope.userId,
  };
  const signedPdfBytes = signedRevision
    ? await finishSignerSignedPdf(signedRevision)
    : await renderFinalizedEnvelopePdf(
        {
          auditEvents: input.auditEvents,
          completedAt: generatedAt,
          copyRecipients: input.copyRecipients,
          envelope: input.envelope,
          fields: input.fields,
          // The certificate goes at the end of the signed document itself,
          // so everyone gets one file. It is the redacted version, because
          // the signed document goes to every signer and copy recipient.
          includeAuditTrail: true,
          signers: input.signers,
          sourcePdfKey: input.sourcePdf.key,
        },
        {
          seal,
          storageService,
        },
      );
  const signedPdfSha256 = sha256Hex(signedPdfBytes);
  const completedEnvelope = {
    ...input.envelope,
    completedAt: generatedAt,
    status: "completed" as const,
    updatedAt: generatedAt,
  };
  let signedPdf: StoredSealedPdf | null = null;
  let certificate: StoredSealedPdf | null = null;
  let recipientCertificate: StoredSealedPdf | null = null;

  try {
    signedPdf = {
      ...(await storageService.putObject({
        body: signedPdfBytes,
        contentType: "application/pdf",
        key: buildEnvelopeSignedPdfKey(storageIdentity),
      })),
      body: signedPdfBytes,
      sha256: signedPdfSha256,
    };

    certificate = await storeEnvelopeCertificatePdf(
      {
        auditEvents: input.auditEvents,
        certificate: {
          bucketName: input.sourcePdf.bucketName,
          key: buildEnvelopeCertificateKey({
            ...storageIdentity,
            audience: "internal",
          }),
        },
        copyRecipients: input.copyRecipients,
        envelope: completedEnvelope,
        signedPdfSha256,
        signers: input.signers,
      },
      {
        seal,
        storageService,
      },
    );
    recipientCertificate = await storeRecipientEnvelopeCertificatePdf(
      {
        auditEvents: input.auditEvents,
        certificate: {
          bucketName: input.sourcePdf.bucketName,
          key: buildEnvelopeCertificateKey({
            ...storageIdentity,
            audience: "recipient",
          }),
        },
        copyRecipients: input.copyRecipients,
        envelope: completedEnvelope,
        signedPdfSha256,
        signers: input.signers,
      },
      {
        seal,
        storageService,
      },
    );

    return {
      certificate,
      generatedAt,
      recipientCertificate,
      signedPdf,
    };
  } catch (error) {
    await Promise.all([
      ...(signedPdf
        ? [storageService.deleteObject(signedPdf.key).catch(() => undefined)]
        : []),
      ...(certificate
        ? [storageService.deleteObject(certificate.key).catch(() => undefined)]
        : []),
      ...(recipientCertificate
        ? [
            storageService
              .deleteObject(recipientCertificate.key)
              .catch(() => undefined),
          ]
        : []),
    ]);
    throw error;
  }
}
