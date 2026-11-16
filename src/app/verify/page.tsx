import type { Metadata } from "next";

import { PublicDocumentShell } from "@/components/layout/public-document-shell";
import { VerifyForm } from "@/components/verify/verify-form";

export const metadata: Metadata = {
  description:
    "Ellenőrizd, hogy egy aláírt PDF vagy hitelesítési igazolás pontosan az a fájl-e, amelyet ez az oldal készített.",
  title: "Dokumentum ellenőrzése",
};

export default function VerifyPage() {
  return (
    <PublicDocumentShell
      description="Ellenőrizd, hogy egy aláírt PDF vagy hitelesítési igazolás pontosan az a fájl-e, amelyet ez az oldal az aláírás lezárulásakor készített. A fájl bármilyen apró módosítása más ujjlenyomatot ad."
      title="Dokumentum ellenőrzése"
    >
      <div className="mx-auto w-full max-w-[52rem] space-y-8">
        <VerifyForm />
        <section className="space-y-3">
          <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
            Az elektronikus bélyegző ellenőrzése PDF-olvasóban
          </h2>
          <p>
            A lezárt dokumentumokon és igazolásokon elektronikus bélyegző is
            van. Nyisd meg a fájlt az Adobe Acrobat Readerben vagy egy másik
            PDF-olvasóban, és nézd meg az aláírások panelt. Az olvasó jelzi,
            hogy a dokumentum változott-e a lezárás óta. Ha a szervezet nem
            telepített hitelesítésszolgáltatótól származó tanúsítványt, az
            olvasó azt is jelzi, hogy az aláíró személyazonossága ismeretlen. Ez
            várható, és nem befolyásolja a módosítások ellenőrzését.
          </p>
        </section>
      </div>
    </PublicDocumentShell>
  );
}
