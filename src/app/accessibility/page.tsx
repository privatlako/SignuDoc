import type { Metadata } from "next";
import Link from "next/link";

import { PublicDocumentShell } from "@/components/layout/public-document-shell";
import { requireHostedMode } from "@/lib/hosted-pages";
import { resolvePublicSupportAddress } from "@/lib/public-contact";

export const metadata: Metadata = {
  description:
    "A SignuDoc akadálymentességi nyilatkozata: a jelenlegi akadálymentességi funkciók, az ismert korlátok, és hogyan kérhetsz segítséget.",
  title: "Akadálymentességi nyilatkozat | SignuDoc",
};

export default async function AccessibilityPage() {
  await requireHostedMode();

  const supportAddress = await resolvePublicSupportAddress();

  return (
    <PublicDocumentShell
      description="A SignuDoc azon dolgozik, hogy a fogyatékossággal élők számára is egyre jobban használható legyen. Ez a nyilatkozat leírja, mit támogatunk most, milyen ismert korlátai vannak az induló termékünknek, és hogyan kérhetsz segítséget vagy alkalmazkodást."
      lastUpdated="2026. március 25."
      title="Akadálymentességi nyilatkozat"
    >
      <section className="space-y-3">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          Vállalásunk
        </h2>
        <p>
          Azt szeretnénk, hogy a SignuDocot minél többen használhassák, azok is,
          akik billentyűzetes navigációra, képernyőolvasóra, nagyításra vagy más
          kisegítő technológiára támaszkodnak. Követjük az akadálymentesség
          bevált gyakorlatait, és az akadálymentességi visszajelzéseket
          kiemelten kezeljük.
        </p>
        <p>
          A SignuDoc még induló termék, és egyes részei akadálymentesebbek, mint
          mások. Ez a nyilatkozat őszintén leírja a termék jelenlegi állapotát
          és a most elérhető segítséget.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          Ami most a legjobban működik
        </h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            A fiók létrehozása, a bejelentkezés, az irányítópult, a beállítások
            és a legtöbb nem vászonalapú űrlap szemantikus vezérlőket használ,
            és billentyűzettel is bejárható.
          </li>
          <li>
            Az aláírási felület a PDF-előnézet fölött billentyűzettel
            fókuszálható HTML-beviteli mezőket és gombokat használ, és az
            oldalsávban összefoglalja a hozzád rendelt mezőket.
          </li>
          <li>
            Az állapotüzenetek, a gombok és az űrlapcímkék értelmes szöveget
            adnak át a kisegítő technológiáknak.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          Ismert korlátok
        </h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            A PDF-előnézet vásznon jelenik meg, ezért a képernyőolvasók számára
            nem teljesen szemantikus megjelenítése az eredeti dokumentumnak.
          </li>
          <li>
            A dokumentum küldő oldali előkészítése jelenleg nagyrészt húzással
            és mutatóeszközzel történő mezőelhelyezésre épül. Ez a folyamat a
            vak felhasználók és egyes, csak billentyűzetet használók számára még
            nem teljesen akadálymentes.
          </li>
          <li>
            Egyes feltöltött PDF-ek beszkennelt képeket, összetett elrendezést
            vagy harmadik féltől származó akadálymentességi hibákat
            tartalmazhatnak, amelyeket a SignuDoc megjelenítéskor nem tud
            teljesen kijavítani.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          Más segítség
        </h2>
        <p>
          Ha segítség kell egy dokumentum létrehozásához, elküldéséhez,
          átnézéséhez vagy aláírásához, írj ide:{" "}
          <Link
            className="font-semibold text-(--accent-ink) underline decoration-[rgb(var(--accent-rgb)/0.35)] underline-offset-4"
            href={`mailto:${supportAddress}`}
          >
            {supportAddress}
          </Link>
          . Írd meg, a folyamat melyik részét szeretnéd elvégezni, milyen
          kisegítő technológiát használsz (ha szívesen megosztod), és milyen
          alkalmazkodás segítene.
        </p>
        <p>
          A helyzettől függően tudunk személyes segítséget, más kapcsolattartási
          módot vagy egy másik támogatott utat adni a folyamat elvégzéséhez.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          Szabványok és folyamatban lévő munka
        </h2>
        <p>
          A fejlesztések tervezésénél a WCAG 2.2 AA szintjét vesszük gyakorlati
          viszonyítási alapnak, de nem állítjuk, hogy a SignuDoc minden része ma
          teljesen megfelel neki.
        </p>
        <p>
          A közeljövőben a vászonalapú PDF-megjelenítés akadálymentességének
          javítására, a felugró ablakok fókuszkezelésének megerősítésére, a csak
          mutatóeszközzel elvégezhető műveletek csökkentésére és a
          billentyűzetbarát alternatívák bővítésére összpontosítunk.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          Visszajelzés
        </h2>
        <p>
          Az akadálymentességi visszajelzések segítenek eldönteni, mit javítsunk
          először. Ha akadályba ütközöl, írj ide:{" "}
          <Link
            className="font-semibold text-(--accent-ink) underline decoration-[rgb(var(--accent-rgb)/0.35)] underline-offset-4"
            href={`mailto:${supportAddress}`}
          >
            {supportAddress}
          </Link>{" "}
          vagy használd a{" "}
          <Link
            className="font-semibold text-(--accent-ink) underline decoration-[rgb(var(--accent-rgb)/0.35)] underline-offset-4"
            href="/contact"
          >
            Kapcsolat
          </Link>{" "}
          oldalt.
        </p>
      </section>
    </PublicDocumentShell>
  );
}
