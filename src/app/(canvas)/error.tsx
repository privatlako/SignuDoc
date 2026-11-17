"use client";

import { StatusPanel } from "@/components/shared/status-panel";

export default function CanvasError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <StatusPanel
        description="Valami hiba történt a dokumentum megnyitásakor. Próbáld újra."
        footer={
          <button
            className="btn-quiet min-h-11 px-5"
            onClick={reset}
            type="button"
          >
            Újratöltés
          </button>
        }
        title="Nem sikerült megnyitni a dokumentumot."
        tone="error"
      />
    </div>
  );
}
