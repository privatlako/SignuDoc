"use client";

import { useState, type ChangeEvent } from "react";

type VerifyAnswer =
  | { match: false }
  | {
      envelopeId: string;
      fileKind: "signed-document" | "certificate";
      finishedAt: number | null;
      match: true;
      signerCount: number;
      status: "completed" | "declined" | "voided";
      title: string;
    };

const dateFormatter = new Intl.DateTimeFormat("hu-HU", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "UTC",
});

const STATUS_WORDS = {
  completed: "lezárva",
  declined: "elutasítva",
  voided: "visszavonva",
} as const;

async function sha256OfFile(file: File): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function VerifyForm() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [answer, setAnswer] = useState<VerifyAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    setAnswer(null);
    setError(null);
    setHash(null);

    if (!file) {
      setFileName(null);
      return;
    }

    setFileName(file.name);
    setIsChecking(true);

    try {
      const sha256 = await sha256OfFile(file);

      setHash(sha256);

      const response = await fetch("/api/verify", {
        body: JSON.stringify({ sha256 }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        (VerifyAnswer & { error?: string }) | null;

      if (!response.ok || !payload) {
        setError(payload?.error ?? "Most nem sikerült ellenőrizni a fájlt.");
        return;
      }

      setAnswer(payload);
    } catch {
      setError("A fájlt nem sikerült beolvasni.");
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <div className="space-y-6">
      <label className="block cursor-pointer rounded-[1.25rem] border-2 border-dashed border-(--border-strong) bg-(--surface) px-6 py-8 text-center transition hover:border-(--accent) hover:bg-(--accent-softer)">
        <span className="block text-[0.9375rem] font-bold text-(--fg)">
          Válassz egy aláírt PDF-et vagy hitelesítési igazolást
        </span>
        <span className="mt-1 block text-sm text-(--secondary)">
          A fájl az eszközödön marad. Csak az SHA-256 ujjlenyomatát küldjük el.
        </span>
        <input
          accept="application/pdf,.pdf"
          aria-label="Ellenőrizendő PDF"
          className="mx-auto mt-4 block max-w-full text-sm text-(--secondary) file:mr-3 file:min-h-10 file:cursor-pointer file:rounded-xl file:border-0 file:bg-(--accent) file:px-4 file:text-sm file:font-bold file:text-white hover:file:bg-(--accent-hover)"
          // One file at a time, so a verdict cannot land on the wrong one.
          disabled={isChecking}
          onChange={handleFile}
          type="file"
        />
      </label>

      <div aria-live="polite" className="space-y-3" role="status">
        {isChecking ? <p>{fileName} ellenőrzése…</p> : null}
        {error ? <p className="notice notice-danger">{error}</p> : null}
        {answer?.match === true ? (
          <div className="rounded-2xl bg-(--success-soft) px-5 py-4">
            <p className="font-bold text-(--success)">
              Ez a fájl változatlan. Ez az a{" "}
              {answer.fileKind === "signed-document"
                ? "aláírt dokumentum"
                : "hitelesítési igazolás"}
              , amelyet ez az oldal a(z) „{answer.title}” dokumentumhoz
              készített.
            </p>
            <p className="mt-2 text-sm text-(--secondary)">
              A küldemény állapota: {STATUS_WORDS[answer.status]}
              {answer.finishedAt
                ? ` (${dateFormatter.format(new Date(answer.finishedAt * 1000))} UTC)`
                : ""}
              . Aláírók száma: {answer.signerCount}. Küldeményazonosító:{" "}
              {answer.envelopeId}.
            </p>
          </div>
        ) : null}
        {answer?.match === false ? (
          <div className="rounded-2xl bg-(--danger-soft) px-5 py-4">
            <p className="font-bold text-(--danger)">Nincs egyezés.</p>
            <p className="mt-2 text-sm text-(--secondary)">
              Ez az oldal nem ezt a fájlt készítette. Lehet, hogy módosították,
              egy másik program újramentette, vagy máshonnan származik. Kérd el
              a küldőtől az ezen az oldalon tárolt példányt.
            </p>
          </div>
        ) : null}
        {hash ? (
          <p className="well break-all px-4 py-3 font-mono text-xs text-(--secondary)">
            SHA-256: {hash}
          </p>
        ) : null}
      </div>
    </div>
  );
}
