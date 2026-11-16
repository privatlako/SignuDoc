"use client";

import { useState } from "react";

import { ShellButton } from "@/components/shared/form-shell";

export function RenewDownloadButton({ token }: { token: string }) {
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "sent"; maskedEmail: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function handleClick() {
    setState({ kind: "sending" });

    try {
      const response = await fetch(
        `/api/download/${encodeURIComponent(token)}/renew`,
        { method: "POST" },
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        maskedEmail?: string;
      } | null;

      if (!response.ok || !payload?.maskedEmail) {
        setState({
          kind: "error",
          message: payload?.error ?? "Most nem sikerült új linkeket küldeni.",
        });
        return;
      }

      setState({ kind: "sent", maskedEmail: payload.maskedEmail });
    } catch {
      setState({
        kind: "error",
        message: "Most nem sikerült új linkeket küldeni.",
      });
    }
  }

  return (
    <div className="space-y-4">
      {state.kind === "sent" ? (
        <p role="status" className="notice notice-success">
          Az új linkeket elküldtük ide: {state.maskedEmail}.
        </p>
      ) : (
        <ShellButton loading={state.kind === "sending"} onClick={handleClick}>
          {state.kind === "sending"
            ? "Küldés…"
            : "Új letöltési linkeket kérek e-mailben"}
        </ShellButton>
      )}
      {state.kind === "error" ? (
        <p role="alert" className="notice notice-danger">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
