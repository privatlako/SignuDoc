"use client";

import { useEffect, useRef, useState } from "react";

import { DocumentThumbnail } from "@/components/shared/document-thumbnail";
import { ShellButton } from "@/components/shared/form-shell";
import { PageHeader } from "@/components/shared/page-header";
import { StatusPanel } from "@/components/shared/status-panel";
import { StepIndicator } from "@/components/shared/step-indicator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CONTRACT_TYPE_LABELS,
  CUSTOMER_CONTRACT_SIGNER_RULE,
  type ContractType,
  type CustomerOffer,
  customerOfferSchema,
  DEFAULT_TRANSFER_DEADLINE_DAYS,
  formatForint,
  parseForintInput,
} from "@/lib/customer-contract";
import type { ReviewEnvelopeData } from "@/lib/envelopes";
import { PERMITTED_USE_PATH } from "@/lib/permitted-uses";
import {
  DEFAULT_ENVELOPE_DEADLINE_DAYS,
  DEFAULT_ENVELOPE_REMINDER_DAYS,
  ENVELOPE_DEADLINE_DAY_OPTIONS,
  ENVELOPE_REMINDER_DAY_OPTIONS,
} from "@/lib/types/domain";
import { getSignerPalette } from "./signer-palette";

const envelopeSteps = [
  "Feltöltés",
  "Aláírók",
  "Mezők elhelyezése",
  "Ellenőrzés",
];
const redirectDelayMs = 1200;
const defaultSendErrorMessage = "Az elküldés nem sikerült. Próbáld újra.";

type ReviewShellProps = {
  envelopeId: string;
  initialState?: "error";
  record?: ReviewEnvelopeData;
};

type ReviewRecordView = {
  copyRecipients: readonly { email: string; id: string; name: string }[];
  filename: string;
  pageCount: number;
  signers: readonly ReviewSigner[];
  sizeLabel: string;
  title: string;
};

type ReviewFieldSummaryLabel =
  | "Legördülő lista"
  | "Szám"
  | "Választógomb csoport"
  | "Jelölőnégyzet"
  | "Aláírás dátuma"
  | "Szignó"
  | "Aláírás"
  | "Szöveg";

type ReviewSigner = {
  color?: string;
  email: string;
  fieldSummaries: readonly ReviewFieldSummaryLabel[];
  id: string;
  name: string;
  order: number;
  tint?: string;
};

type SendPhase = "error" | "idle" | "sending";

type SignatureLevel = "advanced" | "qualified" | "simple";

type OfferFormValues = {
  depositAmount: string;
  offerNumber: string;
  phone: string;
  projectAddress: string;
  totalAmount: string;
  transferDeadlineDays: string;
};

type OfferFormErrors = Partial<Record<keyof OfferFormValues, string>>;

const emptyOfferForm: OfferFormValues = {
  depositAmount: "",
  offerNumber: "",
  phone: "",
  projectAddress: "",
  totalAmount: "",
  transferDeadlineDays: String(DEFAULT_TRANSFER_DEADLINE_DAYS),
};

/** Checks the offer the way the server does, with a message per field. */
function validateOfferForm(
  values: OfferFormValues,
): { offer: CustomerOffer; ok: true } | { errors: OfferFormErrors; ok: false } {
  const days = values.transferDeadlineDays.trim();
  const parsed = customerOfferSchema.safeParse({
    depositAmount: parseForintInput(values.depositAmount) ?? undefined,
    offerNumber: values.offerNumber,
    phone: values.phone,
    projectAddress: values.projectAddress,
    totalAmount: parseForintInput(values.totalAmount) ?? undefined,
    transferDeadlineDays: /^\d{1,3}$/.test(days) ? Number(days) : undefined,
  });

  if (parsed.success) {
    return { offer: parsed.data, ok: true };
  }

  const errors: OfferFormErrors = {};

  for (const issue of parsed.error.issues) {
    const key = issue.path[0];

    if (typeof key === "string" && !(key in errors)) {
      errors[key as keyof OfferFormValues] = issue.message;
    }
  }

  return { errors, ok: false };
}

function describeSignatureLevel(level: SignatureLevel, providerName: string) {
  switch (level) {
    case "advanced":
      return `Fokozott biztonságú elektronikus aláírás (${providerName})`;
    case "qualified":
      return `Minősített elektronikus aláírás (${providerName})`;
    default:
      return "SignuDoc-aláírás";
  }
}

function buildSuccessMessage(firstSignerName: string) {
  return `A szerződést elküldtük. ${firstSignerName} értesítést kapott.`;
}

function formatReminderInterval(intervalDays: number | null) {
  if (intervalDays === null) {
    return "Kikapcsolva";
  }

  if (intervalDays === 1) {
    return "Naponta";
  }

  return intervalDays === 7 ? "Hetente" : `${String(intervalDays)} naponta`;
}

export function ReviewShell({
  envelopeId,
  initialState,
  record,
}: ReviewShellProps) {
  const [deadlineDays, setDeadlineDays] = useState<number>(
    DEFAULT_ENVELOPE_DEADLINE_DAYS,
  );
  const [reminderDays, setReminderDays] = useState<number | null>(
    DEFAULT_ENVELOPE_REMINDER_DAYS,
  );
  const [signatureLevel, setSignatureLevel] =
    useState<SignatureLevel>("simple");
  const [contractType, setContractType] = useState<ContractType>("partner");
  const [offerValues, setOfferValues] =
    useState<OfferFormValues>(emptyOfferForm);
  const [offerErrors, setOfferErrors] = useState<OfferFormErrors>({});
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [sendPhase, setSendPhase] = useState<SendPhase>("idle");
  const [sendError, setSendError] = useState<string | null>(null);
  const sendTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (sendTimeoutRef.current) {
        window.clearTimeout(sendTimeoutRef.current);
      }
    };
  }, []);

  function closeConfirmation() {
    if (sendPhase === "sending") {
      return;
    }

    setSendPhase("idle");
    setIsConfirmationOpen(false);
  }

  function updateOffer(key: keyof OfferFormValues, value: string) {
    setOfferValues((current) => ({ ...current, [key]: value }));
    setOfferErrors((current) => ({ ...current, [key]: undefined }));
  }

  function openConfirmation() {
    if (contractType === "customer") {
      const checked = validateOfferForm(offerValues);

      if (!checked.ok) {
        setOfferErrors(checked.errors);
        return;
      }
    }

    setOfferErrors({});
    setNotice(null);
    setSendError(null);
    setSendPhase("idle");
    setIsConfirmationOpen(true);
  }

  async function handleConfirmSend() {
    if (sendPhase === "sending") {
      return;
    }

    if (sendTimeoutRef.current) {
      window.clearTimeout(sendTimeoutRef.current);
      sendTimeoutRef.current = null;
    }

    setSendError(null);
    setSendPhase("sending");

    try {
      const response = await fetch(`/api/envelopes/${envelopeId}/send`, {
        body: JSON.stringify({
          expiresInDays: deadlineDays,
          permittedUseConfirmed: true,
          reminderIntervalDays: reminderDays,
          ...(record?.signingProvider ? { signatureLevel } : {}),
          contractType,
          ...(contractType === "customer"
            ? (() => {
                const checked = validateOfferForm(offerValues);

                return checked.ok ? { offer: checked.offer } : {};
              })()
            : {}),
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        notifiedSignerName?: string;
        redirectPath?: string;
      } | null;

      if (!response.ok) {
        setSendError(payload?.error ?? defaultSendErrorMessage);
        setSendPhase("error");
        return;
      }

      const notifiedSignerName =
        payload?.notifiedSignerName?.trim() || firstSigner?.name || "1. aláíró";
      const redirectPath = payload?.redirectPath || `/envelopes/${envelopeId}`;

      setIsConfirmationOpen(false);
      setNotice(buildSuccessMessage(notifiedSignerName));
      setSendPhase("idle");
      sendTimeoutRef.current = window.setTimeout(() => {
        window.location.assign(redirectPath);
      }, redirectDelayMs);
    } catch {
      setSendError(defaultSendErrorMessage);
      setSendPhase("error");
    }
  }

  if (initialState === "error") {
    return (
      <div className="space-y-5">
        <PageHeader
          description="4/4. lépés – Ellenőrzés és elküldés"
          title="Új szerződés"
        />
        <StepIndicator current={4} steps={envelopeSteps} />
        <StatusPanel
          footer={
            <ShellButton
              onClick={() => window.location.reload()}
              variant="secondary"
            >
              Újra
            </ShellButton>
          }
          description="Nem sikerült betölteni a piszkozat összefoglalóját. Nézd át az előző lépéseket, és próbáld újra."
          title="Nem sikerült betölteni az összefoglalót"
          tone="error"
        />
      </div>
    );
  }

  if (!record || record.isEmpty) {
    return (
      <div className="space-y-5">
        <PageHeader
          description="4/4. lépés – Ellenőrzés és elküldés"
          title="Új szerződés"
        />
        <StepIndicator current={4} steps={envelopeSteps} />
        <StatusPanel
          action={{
            href: `/envelopes/${envelopeId}/prepare`,
            label: "Vissza a mezőkhöz",
          }}
          description="Az ellenőrzés előtt adj hozzá aláírókat, és helyezd el a mezőket."
          eyebrow="Hiányos piszkozat"
          title="Még nincs mit ellenőrizni"
        />
      </div>
    );
  }

  const activeRecord: ReviewRecordView = {
    copyRecipients: record.copyRecipients ?? [],
    filename: record.filename,
    pageCount: record.pageCount,
    signers: record.signers.map((signer) => ({ ...signer })),
    sizeLabel: record.sizeLabel,
    title: record.title,
  };
  const canSend = Boolean(record.canSend);
  const disabledReason = record.disabledReason ?? null;
  const firstSigner = activeRecord.signers[0];

  return (
    <div className="space-y-5">
      <PageHeader
        description="4/4. lépés – Ellenőrzés és elküldés"
        title="Új szerződés"
      />

      <StepIndicator current={4} steps={envelopeSteps} />

      {notice ? (
        <section className="notice notice-success" role="status">
          <p>{notice}</p>
          <p className="mt-0.5 font-medium text-(--secondary)">
            A szerződés adatlapjának megnyitása…
          </p>
        </section>
      ) : null}

      <section
        className="panel p-5 sm:p-8"
        data-animate="enter"
        data-animate-delay="2"
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)]">
          <article className="well flex flex-col gap-5 p-5 sm:p-6">
            <p className="section-eyebrow">Dokumentum</p>
            <div className="flex h-56 items-center justify-center">
              <DocumentThumbnail
                envelopeId={envelopeId}
                title={activeRecord.title}
              />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-[1.375rem] font-extrabold leading-tight text-(--fg)">
                {activeRecord.title}
              </h2>
              <p className="text-sm leading-6 text-(--secondary)">
                {activeRecord.filename} · {activeRecord.pageCount} oldal ·{" "}
                {activeRecord.sizeLabel}
              </p>
            </div>
          </article>

          <article className="min-w-0">
            <div className="flex items-center justify-between gap-3 px-1">
              <h2 className="text-lg font-extrabold text-(--fg)">
                Aláírási sorrend
              </h2>
              <span className="pill pill-neutral">
                {activeRecord.signers.length} aláíró
              </span>
            </div>

            <ol className="mt-4 space-y-3">
              {activeRecord.signers.map((signer, index) => {
                const palette =
                  signer.color && signer.tint
                    ? { color: signer.color, tint: signer.tint }
                    : getSignerPalette(index);

                return (
                  <li className="well p-4" key={signer.id}>
                    <div className="flex items-start gap-3.5">
                      <span
                        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                        style={{
                          backgroundColor: palette.tint,
                          color: palette.color,
                        }}
                      >
                        {signer.order}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate text-[0.9375rem] font-bold text-(--fg)">
                              {signer.name}
                            </p>
                            <p className="truncate text-sm text-(--secondary)">
                              {signer.email}
                            </p>
                          </div>
                          <span
                            className="pill w-fit"
                            style={{
                              backgroundColor: palette.tint,
                              color: palette.color,
                            }}
                          >
                            <span
                              aria-hidden="true"
                              className="size-2 rounded-full"
                              style={{ backgroundColor: palette.color }}
                            />
                            {signer.order}. aláíró
                          </span>
                        </div>

                        <p
                          className={`mt-2 text-sm leading-6 ${
                            signer.fieldSummaries.includes("Aláírás")
                              ? "text-(--tertiary)"
                              : "font-semibold text-(--danger)"
                          }`}
                        >
                          {formatSignerFieldSummary(signer.fieldSummaries)}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>

            {activeRecord.copyRecipients.length > 0 ? (
              <div className="well mt-3 p-4">
                <p className="text-[0.9375rem] font-bold text-(--fg)">
                  Másolatot kapnak, amikor mindenki aláírt
                </p>
                <ul className="mt-2 space-y-1 text-sm leading-6 text-(--secondary)">
                  {activeRecord.copyRecipients.map((recipient) => (
                    <li className="truncate" key={recipient.id}>
                      {recipient.name} · {recipient.email}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <p className="notice notice-accent mt-4 font-medium">
              Elküldés után az 1. aláíró e-mailben kap egy linket az aláíráshoz.
              A többiek sorban kapnak értesítést, amikor az előttük lévő aláíró
              végzett.
            </p>

            <ContractTypeSection
              contractType={contractType}
              disabled={sendPhase === "sending" || Boolean(notice)}
              errors={offerErrors}
              onContractTypeChange={(value) => {
                setContractType(value);
                setOfferErrors({});
              }}
              onOfferChange={updateOffer}
              values={offerValues}
            />

            <div className="well mt-4 p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="text-[0.8125rem] font-semibold text-(--secondary)">
                    Aláírási határidő
                  </span>
                  <select
                    className="field-input"
                    disabled={sendPhase === "sending" || Boolean(notice)}
                    onChange={(event) =>
                      setDeadlineDays(Number(event.target.value))
                    }
                    value={deadlineDays}
                  >
                    {ENVELOPE_DEADLINE_DAY_OPTIONS.map((days) => (
                      <option key={days} value={days}>
                        {days} nap
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[0.8125rem] font-semibold text-(--secondary)">
                    Automatikus emlékeztető
                  </span>
                  <select
                    className="field-input"
                    disabled={sendPhase === "sending" || Boolean(notice)}
                    onChange={(event) =>
                      setReminderDays(
                        event.target.value === "off"
                          ? null
                          : Number(event.target.value),
                      )
                    }
                    value={reminderDays ?? "off"}
                  >
                    <option value="off">{formatReminderInterval(null)}</option>
                    {ENVELOPE_REMINDER_DAY_OPTIONS.map((days) => (
                      <option key={days} value={days}>
                        {formatReminderInterval(days)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="mt-3 text-sm leading-6 text-(--secondary)">
                A határidő után az aláírási linkek nem működnek. Az emlékeztetőt
                az az aláíró kapja, aki éppen soron van, amíg alá nem ír.
                Mindkettőt később is módosíthatod a szerződés adatlapján.
              </p>
            </div>

            {record.signingProvider ? (
              <div className="well mt-4 p-4">
                <label className="grid gap-1.5">
                  <span className="text-[0.8125rem] font-semibold text-(--secondary)">
                    Aláírás típusa
                  </span>
                  <select
                    className="field-input"
                    disabled={sendPhase === "sending" || Boolean(notice)}
                    onChange={(event) =>
                      setSignatureLevel(event.target.value as SignatureLevel)
                    }
                    value={signatureLevel}
                  >
                    {(["simple", "advanced", "qualified"] as const).map(
                      (level) => (
                        <option key={level} value={level}>
                          {describeSignatureLevel(
                            level,
                            record.signingProvider!.name,
                          )}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <p className="mt-3 text-sm leading-6 text-(--secondary)">
                  {signatureLevel === "simple"
                    ? "Az aláírók itt írnak alá, a kész PDF-et pedig ez a rendszer látja el hitelesítő pecséttel."
                    : `Minden aláíró a szolgáltatónál (${record.signingProvider.name}) igazolja a személyazonosságát, és a saját nevére szóló tanúsítvánnyal ír alá. ${signatureLevel === "qualified" ? "Minősített aláíráshoz minősített tanúsítvány kell, ami nem minden aláírónak van. " : ""}Hogy egy dokumentumhoz melyik típus kell, az jogi kérdés; ez nem jogi tanácsadás.`}
                </p>
              </div>
            ) : null}
          </article>
        </div>

        {disabledReason ? (
          <div className="notice notice-danger mt-5" role="alert">
            <p>{disabledReason}</p>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <ShellButton
            href={`/envelopes/${envelopeId}/prepare`}
            variant="secondary"
          >
            ← Vissza
          </ShellButton>
          <ShellButton disabled={!canSend} onClick={openConfirmation}>
            Elküldés
          </ShellButton>
        </div>
      </section>

      {isConfirmationOpen ? (
        <SendConfirmationDialog
          deadlineDays={deadlineDays}
          errorMessage={sendPhase === "error" ? sendError : null}
          firstSignerName={firstSigner?.name ?? "1. aláíró"}
          isSending={sendPhase === "sending"}
          onCancel={closeConfirmation}
          onConfirm={handleConfirmSend}
          signatureType={
            record.signingProvider && signatureLevel !== "simple"
              ? describeSignatureLevel(
                  signatureLevel,
                  record.signingProvider.name,
                )
              : null
          }
          offerSummary={
            contractType === "customer"
              ? (() => {
                  const checked = validateOfferForm(offerValues);

                  return checked.ok
                    ? `Ügyfélszerződés: ${checked.offer.offerNumber} sz. ajánlat, ${formatForint(checked.offer.totalAmount)}, előleg ${formatForint(checked.offer.depositAmount)}.`
                    : null;
                })()
              : null
          }
          signerCount={activeRecord.signers.length}
          title={activeRecord.title}
        />
      ) : null}
    </div>
  );
}

type SendConfirmationDialogProps = {
  deadlineDays: number;
  errorMessage: string | null;
  firstSignerName: string;
  isSending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  /** Set for a customer contract: the offer in one line. */
  offerSummary: string | null;
  /** Set when signers sign through the install's signing provider. */
  signatureType: string | null;
  signerCount: number;
  title: string;
};

function SendConfirmationDialog({
  deadlineDays,
  errorMessage,
  firstSignerName,
  isSending,
  onCancel,
  onConfirm,
  offerSummary,
  signatureType,
  signerCount,
  title,
}: SendConfirmationDialogProps) {
  const [isPermittedUseConfirmed, setIsPermittedUseConfirmed] = useState(false);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isSending) {
          onCancel();
        }
      }}
    >
      <DialogContent className="max-w-md sm:p-8" showCloseButton={false}>
        <div className="space-y-4">
          <DialogHeader className="space-y-3">
            <DialogTitle>Elküldöd a szerződést?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 text-sm leading-6 text-(--secondary)">
                <p>
                  „{title}” – {signerCount} aláírónak küldjük el.{" "}
                  {signerCount === 1
                    ? `${firstSignerName} azonnal értesítést kap.`
                    : `Az első aláíró (${firstSignerName}) azonnal értesítést kap.`}{" "}
                  Az aláírási kérés {deadlineDays} nap múlva lejár.
                </p>
                {offerSummary ? <p>{offerSummary}</p> : null}
                {signatureType ? (
                  <p>
                    Aláírás típusa: {signatureType}. Elküldés után már nem
                    módosítható.
                  </p>
                ) : null}
              </div>
            </DialogDescription>
          </DialogHeader>

          <label className="well block px-4 py-4">
            <span className="flex items-start gap-3">
              <Checkbox
                autoFocus
                checked={isPermittedUseConfirmed}
                className="mt-1"
                disabled={isSending}
                onCheckedChange={(checked) =>
                  setIsPermittedUseConfirmed(checked === true)
                }
              />
              <span className="text-sm leading-6 text-(--secondary)">
                Az elküldéssel megerősíted, hogy ez a dokumentum szokásos üzleti
                megállapodás, és nem végrendelet, bírósági határozat, jogszabály
                által előírt fogyasztói tájékoztató vagy más olyan{" "}
                <a
                  className="font-semibold text-(--accent-ink) underline decoration-[rgb(var(--accent-rgb)/0.35)] underline-offset-4"
                  href={PERMITTED_USE_PATH}
                  rel="noreferrer"
                  target="_blank"
                >
                  dokumentum, amely nem írható alá elektronikusan
                </a>
                .
              </span>
            </span>
          </label>

          {errorMessage ? (
            <div className="notice notice-danger" role="alert">
              <p>{errorMessage}</p>
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <ShellButton
              disabled={isSending}
              onClick={onCancel}
              variant="secondary"
            >
              Mégse
            </ShellButton>
            <ShellButton
              disabled={!isPermittedUseConfirmed}
              loading={isSending}
              onClick={onConfirm}
            >
              {isSending ? "Küldés…" : "Elküldés most"}
            </ShellButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatSignerFieldSummary(fields: readonly ReviewFieldSummaryLabel[]) {
  const fieldCount = fields.length;

  if (fieldCount === 0) {
    return "Még nincs elhelyezett mező (0 mező)";
  }

  return `(${fieldCount} mező)`;
}

function OfferInput({
  disabled,
  error,
  helper,
  inputMode,
  label,
  name,
  onChange,
  suffix,
  value,
}: {
  disabled: boolean;
  error?: string;
  helper?: string;
  inputMode?: "numeric" | "tel" | "text";
  label: string;
  name: string;
  onChange: (value: string) => void;
  suffix?: string;
  value: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[0.8125rem] font-semibold text-(--secondary)">
        {label}
      </span>
      <span className="relative flex items-center">
        <input
          aria-describedby={error || helper ? `${name}-hint` : undefined}
          aria-invalid={error ? true : undefined}
          className={`field-input w-full ${suffix ? "pr-12" : ""} ${error ? "border-(--danger)" : ""}`}
          disabled={disabled}
          inputMode={inputMode}
          name={name}
          onChange={(event) => onChange(event.target.value)}
          value={value}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-3.5 text-sm font-semibold text-(--tertiary)">
            {suffix}
          </span>
        ) : null}
      </span>
      {error ? (
        <span
          className="text-xs font-semibold text-(--danger)"
          id={`${name}-hint`}
        >
          {error}
        </span>
      ) : helper ? (
        <span
          className="text-xs leading-5 text-(--tertiary)"
          id={`${name}-hint`}
        >
          {helper}
        </span>
      ) : null}
    </label>
  );
}

function ContractTypeSection({
  contractType,
  disabled,
  errors,
  onContractTypeChange,
  onOfferChange,
  values,
}: {
  contractType: ContractType;
  disabled: boolean;
  errors: OfferFormErrors;
  onContractTypeChange: (value: ContractType) => void;
  onOfferChange: (key: keyof OfferFormValues, value: string) => void;
  values: OfferFormValues;
}) {
  return (
    <div className="well mt-4 p-4">
      <label className="grid gap-1.5">
        <span className="text-[0.8125rem] font-semibold text-(--secondary)">
          Szerződés típusa
        </span>
        <select
          className="field-input"
          disabled={disabled}
          name="contractType"
          onChange={(event) =>
            onContractTypeChange(event.target.value as ContractType)
          }
          value={contractType}
        >
          {(["partner", "customer"] as const).map((type) => (
            <option key={type} value={type}>
              {CONTRACT_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </label>

      {contractType === "customer" ? (
        <div className="mt-4 grid gap-4">
          <p className="section-eyebrow">Ajánlat adatai</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <OfferInput
              disabled={disabled}
              error={errors.offerNumber}
              label="Ajánlat sorszáma"
              name="offerNumber"
              onChange={(value) => onOfferChange("offerNumber", value)}
              value={values.offerNumber}
            />
            <OfferInput
              disabled={disabled}
              error={errors.transferDeadlineDays}
              helper="Aláírástól számítva."
              inputMode="numeric"
              label="Utalási határidő"
              name="transferDeadlineDays"
              onChange={(value) => onOfferChange("transferDeadlineDays", value)}
              suffix="nap"
              value={values.transferDeadlineDays}
            />
            <OfferInput
              disabled={disabled}
              error={errors.totalAmount}
              inputMode="numeric"
              label="Árajánlat összege"
              name="totalAmount"
              onChange={(value) => onOfferChange("totalAmount", value)}
              suffix="Ft"
              value={values.totalAmount}
            />
            <OfferInput
              disabled={disabled}
              error={errors.depositAmount}
              inputMode="numeric"
              label="Esedékes előleg"
              name="depositAmount"
              onChange={(value) => onOfferChange("depositAmount", value)}
              suffix="Ft"
              value={values.depositAmount}
            />
            <OfferInput
              disabled={disabled}
              error={errors.projectAddress}
              helper="Nem kötelező. Az ügyfél aláíráskor ellenőrzi."
              label="Tervezési cím"
              name="projectAddress"
              onChange={(value) => onOfferChange("projectAddress", value)}
              value={values.projectAddress}
            />
            <OfferInput
              disabled={disabled}
              error={errors.phone}
              helper="Nem kötelező. Az ügyfél aláíráskor ellenőrzi."
              inputMode="tel"
              label="Telefonszám"
              name="phone"
              onChange={(value) => onOfferChange("phone", value)}
              value={values.phone}
            />
          </div>
        </div>
      ) : null}

      <p className="mt-3 text-sm leading-6 text-(--secondary)">
        {contractType === "customer"
          ? `Az ügyfél aláíráskor látja az ajánlat összegét és az előleget, megadja a számlázási adatait, és elfogadja a feltételeket. ${CUSTOMER_CONTRACT_SIGNER_RULE}`
          : "Tervezői vagy partnerszerződésnél az aláírás a megszokott módon zajlik, számlázási adatok nélkül."}
      </p>
    </div>
  );
}
