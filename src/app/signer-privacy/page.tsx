import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { PublicDocumentShell } from "@/components/layout/public-document-shell";
import { getSettings } from "@/lib/settings";
import { STALE_DRAFT_RETENTION_DAYS } from "@/lib/retention";

export const metadata: Metadata = {
  description:
    "Hogyan használjuk az adataidat, amikor itt aláírsz egy dokumentumot.",
  title: "Adatvédelmi tájékoztató aláíróknak",
};

// A GDPR Article 13 notice for signers, built from the install's settings.
// Shown in the footer when the organization has not linked its own privacy
// policy. The organization remains the controller and should check it.
export default async function SignerPrivacyPage() {
  await connection();

  const settings = await getSettings();

  if (settings.hosted) {
    redirect("/privacy");
  }

  if (settings.privacyUrl) {
    redirect(settings.privacyUrl);
  }

  const organization =
    settings.organizationName?.trim() || "Az oldalt üzemeltető szervezet";
  const contact = settings.supportAddress;
  const retention = settings.retentionDays
    ? `A lezárt dokumentumokat és eseménynaplóikat a lezárás után ${String(settings.retentionDays)} nappal töröljük.`
    : "A lezárt dokumentumokat és eseménynaplóikat addig őrizzük, amíg a szervezet nem törli őket, mert egy megállapodás bizonyítékai, és sokat jogszabály szerint évekig meg kell őrizni.";

  return (
    <PublicDocumentShell
      description={`Ezen az oldalon a következő szervezet küld dokumentumokat elektronikus aláírásra: ${organization}. Ez a tájékoztató leírja, milyen adatokat gyűjtünk rólad az aláíráskor, miért, és mit tehetsz ezzel kapcsolatban.`}
      lastUpdated="2026. november 13."
      title="Adatvédelmi tájékoztató aláíróknak"
    >
      <section className="space-y-3">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          Ki felel az adataidért
        </h2>
        <p>
          Az adataidért ez a szervezet felel („adatkezelő”): {organization}.{" "}
          {contact ? (
            <>
              Elérhetőség:{" "}
              <a className="underline" href={`mailto:${contact}`}>
                {contact}
              </a>
              .
            </>
          ) : (
            "Azon a személyen keresztül érheted el őket, aki a dokumentumot küldte neked."
          )}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          Milyen adatokat gyűjtünk
        </h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>A neved és az e-mail-címed, amelyet a küldő ad meg.</li>
          <li>
            Amit te adsz meg: az aláírásod vagy a monogramod (gépelve vagy
            rajzolva), dátumok, szövegek és jelölőnégyzetek, illetve az
            elutasítás oka.
          </li>
          <li>
            Az aláírás bizonyítékai: mikor nyitottad meg, fogadtad el és írtad
            alá a dokumentumot, az IP-címed, a böngésződ önazonosítása, és az
            ellenőrzések, amelyeken átmentél (például e-mailben kapott kód).
          </li>
          <li>
            A dokumentummal kapcsolatban neked küldött e-mailek nyilvántartása.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          Miért és milyen jogalapon
        </h2>
        <p>
          Azért, hogy átnézhesd és aláírhasd a dokumentumot, hogy megkapd a
          példányokat, és hogy bizonyíték maradjon arról, ki mit és mikor írt
          alá. A jogalap egy olyan szerződés megkötését megelőző lépések vagy a
          szerződés teljesítése, amelyben részes fél vagy (GDPR 6. cikk (1)
          bekezdés b) pont), a szervezet jogos érdeke, hogy bizonyítani tudja a
          megállapodást (6. cikk (1) bekezdés f) pont), valamint az
          iratmegőrzésre vonatkozó jogi kötelezettség (6. cikk (1) bekezdés c)
          pont).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          Ki fér még hozzá
        </h2>
        <p>
          A dokumentum többi szereplője látja a nevedet, az e-mail-címedet és az
          aláírásodat. Az oldalt működtető szolgáltatások a szervezet (
          {organization}) nevében kezelik az adatokat: a tárhelyszolgáltató
          (Vercel), az adatbázis-szolgáltató (például Neon), a fájltárolás
          (Vercel Blob) és az e-mail-szolgáltató (Resend). Közülük néhány az
          Egyesült Államokban működik. Ha az adatok elhagyják az Európai
          Gazdasági Térséget, az EU–USA adatvédelmi keretrendszer vagy általános
          szerződési feltételek védik őket.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          Meddig őrizzük
        </h2>
        <p>
          {retention} Az el nem küldött piszkozatokat{" "}
          {String(STALE_DRAFT_RETENTION_DAYS)} nap változatlanság után töröljük.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          A jogaid
        </h2>
        <p>
          A szervezettől ({organization}) kérheted, hogy adjon másolatot az
          adataidról, javítsa ki őket, korlátozza a felhasználásukat, vagy
          törölje őket. A felhasználásuk ellen tiltakozhatsz is. Egy aláírt
          nyilvántartás törlési kérés ellenére is megőrizhető, amíg
          bizonyítékként vagy jogszabály alapján szükség van rá (GDPR 17. cikk
          (3) bekezdés). Panaszt tehetsz annak az országnak az adatvédelmi
          hatóságánál is, ahol élsz vagy dolgozol.
        </p>
      </section>
    </PublicDocumentShell>
  );
}
