import type { Metadata } from "next";

import { PublicDocumentShell } from "@/components/layout/public-document-shell";
import { RenewDownloadButton } from "@/components/downloads/renew-download-button";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Lejárt letöltési link",
};

type ExpiredDownloadPageProps = {
  params: Promise<{ token: string }>;
};

export default async function ExpiredDownloadPage({
  params,
}: ExpiredDownloadPageProps) {
  const { token } = await params;

  return (
    <PublicDocumentShell
      description="A letöltési linkek csak korlátozott ideig működnek. Újakat kérhetsz arra az e-mail-címre, amelyre a dokumentumot küldték."
      title="Ez a letöltési link lejárt"
    >
      <div className="mx-auto w-full max-w-[52rem]">
        <RenewDownloadButton token={token} />
      </div>
    </PublicDocumentShell>
  );
}
