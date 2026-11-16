import type { Metadata } from "next";
import { connection } from "next/server";

import { PublicDocumentShell } from "@/components/layout/public-document-shell";
import {
  EU_LIMITS,
  PERMITTED_USE_VERSION,
  US_EXCLUDED_DOCUMENTS,
  WHAT_IT_IS,
  WHAT_IT_IS_NOT,
} from "@/lib/permitted-uses";
import { getBranding } from "@/lib/settings";

export const metadata: Metadata = {
  description:
    "Milyen dokumentumokat lehet itt aláírni, és milyen elektronikus aláírásról van szó.",
  title: "Elektronikus aláírás: mire való",
};

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-6">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

// On every install, hosted or not: senders confirm this list before each
// send, and signers can read it.
export default async function ElectronicSignaturesPage() {
  await connection();

  const { productName } = await getBranding();

  return (
    <PublicDocumentShell
      description={`A(z) ${productName} a Signudocot használja elektronikus aláírások gyűjtésére. Ez az oldal leírja, mely dokumentumokhoz való, és melyekhez nem.`}
      lastUpdated={PERMITTED_USE_VERSION}
      title="Mire való"
    >
      <section className="space-y-3">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          {WHAT_IT_IS.heading}
        </h2>
        <List items={WHAT_IT_IS.items} />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          {WHAT_IT_IS_NOT.heading}
        </h2>
        <List items={WHAT_IT_IS_NOT.items} />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          Ezeket a dokumentumokat ne küldd (Egyesült Államok)
        </h2>
        <p>
          A szövetségi ESIGN törvény (15 U.S.C. 7003) és az államok által
          elfogadott Uniform Electronic Transactions Act ezeket kizárja, ezért
          az elektronikus aláírás nem feltétlenül teszi őket érvényessé:
        </p>
        <List items={US_EXCLUDED_DOCUMENTS} />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          Ezekkel légy óvatos (Európai Unió)
        </h2>
        <p>
          Az eIDAS a tagállamokra bízza, mely dokumentumokhoz kell erősebb
          forma. Ezekhez jellemzően kell:
        </p>
        <List items={EU_LIMITS} />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          Ki dönt
        </h2>
        <p>
          Ezt az oldalt a(z) {productName} üzemelteti, és ő dönt arról, mire
          használható. Minden küldés előtt a küldő megerősíti, hogy a dokumentum
          nem tartozik az itt felsorolt típusok közé. Ez az oldal általános
          tájékoztatás, nem jogi tanácsadás.
        </p>
      </section>
    </PublicDocumentShell>
  );
}
