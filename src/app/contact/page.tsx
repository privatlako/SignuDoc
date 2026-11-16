import type { Metadata } from "next";

import { ContactForm } from "@/components/contact/contact-form";
import { PublicDocumentShell } from "@/components/layout/public-document-shell";
import { requireHostedMode } from "@/lib/hosted-pages";

export const metadata: Metadata = {
  description:
    "Írj a SignuDocnak, ha támogatásra van szükséged, adatvédelmi kérdésed, akadálymentességi kérésed vagy jogi megkeresésed van.",
  title: "Kapcsolat | SignuDoc",
};

export default async function ContactPage() {
  await requireHostedMode();

  return (
    <PublicDocumentShell
      description="Az alábbi űrlapon írhatsz nekünk terméktámogatás, adatvédelmi kérés, akadálymentességi igény, jogi értesítés vagy egy SignuDockal küldött dokumentum ügyében."
      lastUpdated="2026. március 23."
      title="Kapcsolat"
    >
      <div className="mx-auto w-full max-w-[52rem]">
        <ContactForm />
      </div>
    </PublicDocumentShell>
  );
}
