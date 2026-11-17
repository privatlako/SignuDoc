"use client";

import { useState } from "react";

import { ShellButton } from "@/components/shared/form-shell";
import {
  BILLING_STATUS_LABELS,
  type BillingStatus,
} from "@/lib/customer-contract";
import type { EnvelopeDetailCustomerContract } from "@/lib/envelopes";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-3">
      <dt className="text-[0.8125rem] font-semibold text-(--tertiary)">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-sm font-semibold text-(--fg)">
        {value}
      </dd>
    </div>
  );
}

/** The offer, the billing details and the invoicing status of a customer contract. */
export function CustomerContractPanel({
  envelopeId,
  record,
}: {
  envelopeId: string;
  record: EnvelopeDetailCustomerContract;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function changeStatus(status: BillingStatus) {
    setError(null);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/envelopes/${envelopeId}/billing`, {
        body: JSON.stringify({ status }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      if (response.ok) {
        window.location.reload();
        return;
      }

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      setError(
        payload?.error ?? "Nem sikerült módosítani a számlázási állapotot.",
      );
    } catch {
      setError("Nem sikerült módosítani a számlázási állapotot.");
    } finally {
      setIsSaving(false);
    }
  }

  const status = record.billingStatus;

  return (
    <section
      className="grid gap-5 lg:grid-cols-2"
      data-animate="enter"
      data-animate-delay="1"
    >
      <article className="panel p-5 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold text-(--fg)">Ajánlat adatai</h2>
          <span className="pill pill-neutral">Ügyfélszerződés</span>
        </div>
        {record.offer ? (
          <dl className="well mt-4 grid gap-3 p-4">
            <DetailRow
              label="Ajánlat sorszáma"
              value={record.offer.offerNumber}
            />
            <DetailRow
              label="Árajánlat összege"
              value={record.offer.totalLabel}
            />
            <DetailRow
              label="Esedékes előleg"
              value={record.offer.depositLabel}
            />
            <DetailRow
              label="Utalási határidő"
              value={record.offer.transferDeadlineLabel}
            />
            {record.offer.projectAddress ? (
              <DetailRow
                label="Tervezési cím (megadva)"
                value={record.offer.projectAddress}
              />
            ) : null}
            {record.offer.phone ? (
              <DetailRow
                label="Telefonszám (megadva)"
                value={record.offer.phone}
              />
            ) : null}
          </dl>
        ) : (
          <p className="mt-4 text-sm leading-6 text-(--secondary)">
            Ehhez a szerződéshez nincsenek ajánlati adatok.
          </p>
        )}
      </article>

      <article className="panel p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold text-(--fg)">
            Számlázási adatok
          </h2>
          {status ? (
            <span
              className={`pill ${status === "invoiced" ? "pill-success" : "pill-accent"}`}
              data-testid="billing-status"
            >
              {BILLING_STATUS_LABELS[status]}
            </span>
          ) : null}
        </div>

        {record.billing ? (
          <dl className="well mt-4 grid gap-3 p-4">
            <DetailRow label="Név" value={record.billing.name} />
            <DetailRow label="E-mail" value={record.billing.email} />
            <DetailRow label="Telefonszám" value={record.billing.phone} />
            <DetailRow label="Számlázási cím" value={record.billing.address} />
            <DetailRow
              label="Tervezési cím"
              value={record.billing.projectAddress}
            />
            <DetailRow
              label="Feltételek elfogadva"
              value={record.billing.acceptedAtLabel}
            />
          </dl>
        ) : (
          <p className="mt-4 text-sm leading-6 text-(--secondary)">
            Az ügyfél aláíráskor adja meg a számlázási adatait.
          </p>
        )}

        {status ? (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[0.8125rem] leading-5 text-(--tertiary)">
              {record.billingStatusChangedAtLabel
                ? `Utoljára módosítva: ${record.billingStatusChangedAtLabel}`
                : null}
            </p>
            {status === "pending" ? (
              <ShellButton
                loading={isSaving}
                onClick={() => void changeStatus("invoiced")}
              >
                Kiszámlázva
              </ShellButton>
            ) : (
              <ShellButton
                loading={isSaving}
                onClick={() => void changeStatus("pending")}
                variant="secondary"
              >
                Visszaállítás számlázásra várra
              </ShellButton>
            )}
          </div>
        ) : null}

        {error ? (
          <div className="notice notice-danger mt-4" role="alert">
            {error}
          </div>
        ) : null}
      </article>
    </section>
  );
}
