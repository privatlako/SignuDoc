// TODO(homilla): needs Homilla-specific legal review
import type { Metadata } from "next";
import Link from "next/link";

import { PublicDocumentShell } from "@/components/layout/public-document-shell";
import { requireHostedMode } from "@/lib/hosted-pages";
import { resolvePublicSupportAddress } from "@/lib/public-contact";

export const metadata: Metadata = {
  description:
    "Hogyan gyűjti, használja, osztja meg, őrzi és védi a SignuDoc az adatokat nyilvános, egyesült államokbeli elektronikus aláírási szolgáltatásában.",
  title: "Adatvédelmi tájékoztató | SignuDoc",
};

export default async function PrivacyPage() {
  await requireHostedMode();

  const privacyAddress = await resolvePublicSupportAddress();

  return (
    <PublicDocumentShell
      description="Ez az adatvédelmi tájékoztató leírja, milyen adatokat gyűjt a SignuDoc, hogyan használjuk és kivel osztjuk meg őket, milyen jogaid vannak, és hogyan küldhetsz nekünk adatvédelmi kérést."
      lastUpdated="2026. március 25."
      title="Adatvédelmi tájékoztató"
    >
      <section className="space-y-3">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          1. Hatály és a szolgáltatás felépítése
        </h2>
        <p>
          A SignuDoc elsősorban az Egyesült Államokra összpontosító elektronikus
          aláírási szolgáltatás, hétköznapi üzleti megállapodásokhoz és hasonló
          kereskedelmi folyamatokhoz. Ez a tájékoztató a fióktulajdonosokra, az
          aláírókra, a weboldal látogatóira és a támogatással kapcsolatba
          lépőkre vonatkozik, akik a SignuDocot használják.
        </p>
        <p>
          A SignuDoc nem jogszabályban előírt fogyasztói tájékoztatási
          folyamatokhoz készült, amelyekhez külön E-SIGN szerinti fogyasztói
          hozzájárulás kell. Ha egy küldő ezen a körön kívül használja a
          SignuDocot, továbbra is ő felel azért, hogy a folyamat jogilag
          megfelelő legyen.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          2. Milyen adatokat gyűjtünk
        </h2>
        <p>A következő adatkategóriákat gyűjthetjük:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Fiókadatok</strong>, például név, e-mail-cím, jelszóadatok,
            az e-mail-cím megerősítésének állapota, munkamenetadatok és a profil
            módosításai.
          </li>
          <li>
            <strong>Dokumentum- és folyamatadatok</strong>, például feltöltött
            PDF-ek, dokumentumcímek, oldalszámok, elhelyezett mezők, az aláírók
            sorrendje, a küldemény állapota és a kapcsolódó metaadatok.
          </li>
          <li>
            <strong>Aláírói és aláírási adatok</strong>, például az aláírók neve
            és e-mail-címe, gépelt aláírások, rajzolt aláírásképek, dátumok,
            szöveges bejegyzések, bejelölt jelölőnégyzetek és az elutasítások
            indoka.
          </li>
          <li>
            <strong>Eseménynapló- és biztonsági adatok</strong>, például IP-cím,
            böngésző- vagy eszközadatok, időbélyegek, tokenazonosítók, a
            nyilvántartásokhoz való hozzáférések, küldési, emlékeztetési és
            aláírási események, valamint a rendszer által készített
            eseménynaplók.
          </li>
          <li>
            <strong>Támogatási és kommunikációs adatok</strong>, például a
            SignuDocnak küldött e-mailjeid, fiókmegszüntetési kérések,
            adatvédelmi kérések és az akadálymentességgel vagy a termékkel
            kapcsolatos visszajelzések.
          </li>
          <li>
            <strong>Sütik és helyi állapot</strong>, például hitelesítési sütik,
            munkamenet-információk és az alkalmazás biztonságos működéséhez
            szükséges, korlátozott, böngészőben tárolt adatok.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          3. Honnan származnak az adatok
        </h2>
        <p>Közvetlenül tőled gyűjtünk adatokat, amikor:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>fiókot hozol létre vagy használsz;</li>
          <li>dokumentumot töltesz fel vagy küldesz;</li>
          <li>aláírási csomagot teljesítesz, elutasítasz vagy letöltesz;</li>
          <li>e-mailben vagy támogatási csatornán kapcsolatba lépsz velünk;</li>
          <li>böngészed vagy használod a weboldalt.</li>
        </ul>
        <p>
          Adatok automatikusan is keletkeznek, amikor a SignuDoc eseményeket
          naplóz, tranzakciós e-maileket küld, védi a munkameneteket, korlátozza
          a kérések gyakoriságát vagy lezárt nyilvántartásokat tárol.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          4. Hogyan használjuk az adatokat
        </h2>
        <p>Az adatokat a következőkre használhatjuk:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>fiókok létrehozása és kezelése;</li>
          <li>aláírási folyamatok és lezárt dokumentumcsomagok kézbesítése;</li>
          <li>e-mail-címek megerősítése és tranzakciós üzenetek küldése;</li>
          <li>
            a küldemények előzményeinek, az eseménynaplóknak és a biztonsági
            naplóknak a vezetése;
          </li>
          <li>csalás, visszaélés és jogosulatlan hozzáférés megelőzése;</li>
          <li>
            válaszadás támogatási, adatvédelmi és akadálymentességi kérésekre;
          </li>
          <li>
            jogi kötelezettségek teljesítése, megállapodások érvényesítése és
            viták rendezése;
          </li>
          <li>
            a szolgáltatás megbízhatóságának, biztonságának és
            használhatóságának javítása.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          5. Kivel osztjuk meg az adatokat
        </h2>
        <p>
          Megoszthatjuk az adatokat olyan szolgáltatókkal, amelyek segítenek a
          SignuDoc működtetésében, például hitelesítési, felhőtárolási,
          e-mail-kézbesítési, tárhely-, infrastruktúra-, naplózási, biztonsági
          és ügyféltámogatási szolgáltatókkal.
        </p>
        <p>
          Akkor is kiadhatunk adatokat, ha az észszerűen szükséges a
          jogszabályok betartásához, jogi eljárásra adott válaszhoz, a SignuDoc,
          a felhasználók vagy a nyilvánosság jogainak vagy biztonságának
          védelméhez, illetve egyesüléssel, felvásárlással, finanszírozással
          vagy eszközértékesítéssel összefüggésben.
        </p>
        <p>
          A SignuDoc nem hirdetésekből finanszírozott szolgáltatás. Ha ez
          megváltozik, frissítjük ezt a tájékoztatót, mielőtt a személyes
          adatokat lényegesen más módon kezdenénk használni.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          6. Megőrzés
        </h2>
        <p>
          Az el nem küldött piszkozat küldeményeket és a hozzájuk feltöltött
          forrásdokumentumokat egy inaktív időszak után törölhetjük, például ha
          a küldő 30 napig nem végez rajtuk semmilyen műveletet.
        </p>
        <p>
          A lezárt, elutasított és visszavont küldemények addig érhetők el, amíg
          a fiókod aktív, így hozzáférsz az aláírt dokumentumokhoz és az
          eseménynaplóhoz. A kapcsolódó eseménynapló- és biztonsági
          nyilvántartásokat is megőrizzük, ameddig észszerűen szükséges a
          szolgáltatás működtetéséhez, a visszaélések megelőzéséhez, a jogi
          kötelezettségek teljesítéséhez, a viták rendezéséhez és a
          megállapodások érvényesítéséhez.
        </p>
        <p>
          Ha megszünteted a fiókodat, korlátozott ideig lehetőséget adhatunk az
          adatok exportálására, majd töröljük a tárolt dokumentumfájlokat és a
          kapcsolódó küldeményadatokat, kivéve azokat a korlátozott adatokat,
          amelyekre biztonsági, csalásmegelőzési, jogi megfelelési vagy
          vitarendezési célból szükségünk van.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          7. Biztonság
        </h2>
        <p>
          A SignuDoc adminisztratív, technikai és fizikai védelmi intézkedéseket
          alkalmaz a személyes adatok védelmére, többek között hitelesített
          hozzáférés-szabályozást, eseménynaplózást, a kérések gyakoriságának
          korlátozását, biztonsági fejléceket és felhőtárolási kontrollokat.
          Egyetlen rendszer sem tökéletesen biztonságos, ezért abszolút
          biztonságot nem tudunk garantálni.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          8. Adatvédelmi jogaid
        </h2>
        <p>
          Attól függően, hol élsz, és milyen kapcsolatban állsz a SignuDockal, a
          következő jogaid lehetnek:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            megismerheted a rólad tárolt személyes adatokat, vagy hozzáférést
            kérhetsz hozzájuk;
          </li>
          <li>kérheted a pontatlan adatok helyesbítését;</li>
          <li>kérheted az adatok törlését, a jogszabályi kivételek mellett;</li>
          <li>
            másolatot kérhetsz bizonyos adatokról, amelyeket kézzel elő tudunk
            állítani;
          </li>
          <li>
            visszavonhatod a hozzájárulásodat, ha egy adatkezelés hozzájáruláson
            alapul;
          </li>
          <li>
            nem érhet hátrányos megkülönböztetés amiatt, hogy élsz az
            adatvédelmi jogaiddal.
          </li>
        </ul>
        <p>
          A kaliforniai lakosoknak emellett joguk lehet megkérdezni, milyen
          kategóriájú és konkrétan milyen személyes adatokat gyűjtöttünk róluk,
          kérni a pontatlan személyes adatok helyesbítését, és kérni a törlést,
          a vonatkozó kivételek mellett.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          9. Hogyan gyakorolhatod a jogaidat
        </h2>
        <p>
          Hozzáférési, helyesbítési, törlési vagy fiókmegszüntetési kéréssel írj
          ide:{" "}
          <Link
            className="font-semibold text-(--accent-ink) underline decoration-[rgb(var(--accent-rgb)/0.35)] underline-offset-4"
            href={`mailto:${privacyAddress}`}
          >
            {privacyAddress}
          </Link>
          , vagy használd az alkalmazáson belüli fiókmegszüntetési kérést, ha
          elérhető.
        </p>
        <p>
          Mielőtt egy kérés alapján intézkedünk, kérhetjük, hogy igazold a
          személyazonosságodat. Például kérhetjük, hogy igazold, hogy a kérdéses
          e-mail-cím a tiéd, nevezz meg legutóbbi fióktevékenységet, vagy adj
          meg annyi adatot a küldeményről, amennyi alapján megtaláljuk a
          vizsgálandó nyilvántartásokat.
        </p>
        <p>
          Ha a kaliforniai jog alkalmazandó, igyekszünk az ellenőrizhető kérés
          beérkezésétől számított 45 naptári napon belül válaszolni, és ezt a
          jogszabály által megengedett esetben egyszer további 45 nappal
          meghosszabbíthatjuk. Ha a GDPR vagy hasonló jogszabály alkalmazandó,
          igyekszünk egy hónapon belül válaszolni, összetett vagy nagy számú
          kérés esetén a jogszerű hosszabbítás lehetőségével.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          10. Sütik és helyi tárolás
        </h2>
        <p>
          A SignuDoc sütiket és hasonló technológiákat elsősorban hitelesítésre,
          a munkamenet folytonosságára, biztonsági célra és az alkalmazás
          alapvető állapotának megőrzésére használ. Az alkalmazás
          használhatóságához szükséges, korlátozott helyi beállításokat is
          tárolhatunk, például a felület beállításait és a folyamatban lévő
          műveletek oldalállapotát. A küldő oldali folyamatoknál a piszkozat
          PDF-előnézetek legfeljebb 24 órán át a böngészőben (IndexedDB)
          tárolódhatnak, hogy gyorsabb legyen a dokumentum előkészítése.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          11. Gyermekek és nemzetközi használat
        </h2>
        <p>
          A SignuDoc nem 13 év alatti gyermekeknek szól, és tudatosan nem
          gyűjtünk személyes adatot gyermekektől a szolgáltatáson keresztül. Ha
          úgy gondolod, hogy egy gyermek személyes adatot adott meg nekünk, lépj
          kapcsolatba velünk, hogy megvizsgálhassuk és rendezhessük az ügyet.
        </p>
        <p>
          A SignuDocot elsősorban egyesült államokbeli üzleti használatra
          üzemeltetjük. Ha az Egyesült Államokon kívülről használod a
          szolgáltatást, tudomásul veszed, hogy az adatokat az Egyesült
          Államokban vagy más olyan helyen dolgozhatják fel és tárolhatják, ahol
          a szolgáltatóink működnek.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          12. Változások és kapcsolat
        </h2>
        <p>
          Ezt a tájékoztatót időről időre frissíthetjük úgy, hogy a módosított
          változatot közzétesszük ezen az oldalon. A lényeges változások a
          közzétételükkor lépnek hatályba, hacsak nem jelölünk meg későbbi
          időpontot.
        </p>
        <p>
          Adatvédelmi kérdéseidet, kéréseidet és panaszaidat ide küldheted:{" "}
          <Link
            className="font-semibold text-(--accent-ink) underline decoration-[rgb(var(--accent-rgb)/0.35)] underline-offset-4"
            href={`mailto:${privacyAddress}`}
          >
            {privacyAddress}
          </Link>
          , vagy használhatod a{" "}
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
