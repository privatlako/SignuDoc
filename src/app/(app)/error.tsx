"use client";

import { StatusPanel } from "@/components/shared/status-panel";

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <StatusPanel
      description="Hiba történt az oldal betöltése közben. Próbáld újra."
      footer={
        <button
          className="btn-quiet min-h-11 px-5"
          onClick={reset}
          type="button"
        >
          Újra
        </button>
      }
      title="Nem sikerült betölteni az oldalt."
      tone="error"
    />
  );
}
