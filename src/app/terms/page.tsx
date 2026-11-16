// TODO(homilla): needs Homilla-specific legal review
import type { Metadata } from "next";
import Link from "next/link";

import { PublicDocumentShell } from "@/components/layout/public-document-shell";
import { requireHostedMode } from "@/lib/hosted-pages";
import { resolvePublicSupportAddress } from "@/lib/public-contact";

export const metadata: Metadata = {
  description:
    "A SignuDoc nyilvános elektronikus aláírási szolgáltatás használatára vonatkozó feltételek.",
  title: "Felhasználási feltételek | SignuDoc",
};

export default async function TermsPage() {
  await requireHostedMode();

  const supportAddress = await resolvePublicSupportAddress();

  return (
    <PublicDocumentShell
      description="Ezek a felhasználási feltételek szabályozzák, hogyan férhetsz hozzá a SignuDochoz és hogyan használhatod. Egy induló, egyesült államokbeli elektronikus aláírási termékre vonatkoznak, amely hétköznapi üzleti megállapodásokhoz és kereskedelmi folyamatokhoz készült."
      lastUpdated="2026. március 21."
      title="Felhasználási feltételek"
    >
      <section className="space-y-3">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          1. Áttekintés
        </h2>
        <p>
          Azzal, hogy fiókot hozol létre, dokumentumot töltesz fel, küldeményt
          küldesz vagy a SignuDocon keresztül aláírsz, elfogadod ezeket a
          feltételeket. Ha a SignuDocot egy cég vagy más szervezet nevében
          használod, kijelented, hogy jogosult vagy a szervezetet ezekkel a
          feltételekkel kötelezni.
        </p>
        <p>
          A SignuDoc szoftvert biztosít elektronikus iratok előkészítéséhez,
          küldéséhez, aláírásához és tárolásához. A SignuDoc nem ügyvédi iroda,
          nem a jogi képviselőd, nem ad jogi tanácsot, és nem dönti el, hogy egy
          adott dokumentum valamely joghatóságban jogilag alkalmas-e
          elektronikus aláírásra.
        </p>
        <p>
          A SignuDoc jelenleg egyesült államokbeli vállalkozások és szervezetek
          számára érhető el.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          2. Jogosultság és felhatalmazás
        </h2>
        <p>
          A SignuDocot csak akkor használhatod, ha az alkalmazandó jog szerint
          kötelező erejű szerződést köthetsz, és csak jogszerű üzleti vagy
          szervezeti célra. Te felelsz azért, hogy minden küldő, aláíró és
          címzett jogosult legyen eljárni az általa képviselt fél nevében.
        </p>
        <p>
          Azt is neked kell eldöntened, hogy az ügyletedhez kell-e tanú,
          közjegyzői hitelesítés, papíralapú kézbesítés, különleges megőrzési
          szabály, vagy olyan aláírási forma, amelyet a SignuDoc nem biztosít.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          3. Megengedett használat és kizárt dokumentumok
        </h2>
        <p>
          A SignuDoc hétköznapi üzleti megállapodásokhoz és hasonló kereskedelmi
          iratokhoz készült, például titoktartási megállapodásokhoz (NDA),
          munkaleírásokhoz, beszállítói és szolgáltatási szerződésekhez,
          beszerzési jóváhagyásokhoz és hasonló üzleti dokumentumokhoz.
        </p>
        <p>
          A SignuDoc nem használható olyan dokumentumokhoz vagy értesítésekhez,
          amelyek kívül esnek a megengedett használati körén, többek között:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            végrendeletek, végrendelet-kiegészítések és végrendeleti trösztök;
          </li>
          <li>örökbefogadás, válás vagy más családjogi ügyek;</li>
          <li>
            bírósági határozatok, bírósági értesítések, periratok vagy más
            hivatalos bírósági iratok;
          </li>
          <li>
            közüzemi szolgáltatások (például víz, fűtés vagy áram)
            megszüntetéséről vagy felmondásáról szóló értesítések;
          </li>
          <li>
            elsődleges lakóhelyet érintő késedelemről, lejárttá tételről,
            visszavételről, végrehajtásról, kilakoltatásról vagy a hibaorvoslás
            jogáról szóló értesítések;
          </li>
          <li>
            egészségbiztosítási vagy életbiztosítási juttatások megszüntetése
            vagy felmondása;
          </li>
          <li>
            termékvisszahívási értesítések, illetve az egészséget vagy
            biztonságot veszélyeztető lényeges termékhibákról szóló értesítések;
          </li>
          <li>
            veszélyes anyagok, növényvédő szerek vagy más mérgező vagy veszélyes
            anyagok szállításához vagy kezeléséhez kötelezően mellékelendő
            iratok;
          </li>
          <li>
            jogszabályban előírt fogyasztói tájékoztatások, vagy más olyan
            folyamatok, amelyekhez az irat elektronikus kézbesítése előtt külön
            E-SIGN szerinti fogyasztói hozzájárulás kell.
          </li>
        </ul>
        <p>
          Ha egy dokumentum szabályozott, biztonsági szempontból érzékeny,
          fogyasztói tájékoztatási, hagyatéktervezési, bírósági vagy családjogi
          kategóriába tartozik, ne használd hozzá a SignuDocot. Egy küldemény
          elküldésével megerősíted, hogy a dokumentum a SignuDoc megengedett
          használati körébe tartozó, hétköznapi üzleti megállapodás.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          4. A küldő felelőssége
        </h2>
        <p>
          A küldő felel a feltöltött tartalomért, a beállított aláírási
          sorrendért, az elhelyezett mezőkért, a meghívott címzettekért és a
          létrejövő folyamat jogi megfelelőségéért. Rendelkezned kell a
          dokumentum feltöltéséhez és az egyes címzettektől kért aláírásokhoz
          szükséges jogokkal és engedélyekkel.
        </p>
        <p>
          Te felelsz azért, hogy az aláírók elérhetőségei pontosak legyenek,
          hogy ne küldj félrevezető vagy megtévesztő küldeményt, és hogy a
          szükséges értesítéseket, tájékoztatásokat vagy offline eljárásokat
          szükség esetén a SignuDocon kívül intézd.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          5. Elektronikus aláírások és iratok
        </h2>
        <p>
          A SignuDoc megengedett használati körébe tartozó dokumentumok esetén a
          SignuDoc az Egyesült Államokban használt szabványos elektronikus
          aláírásokat és iratokat támogatja, olyan jogszabályok alapján, mint az
          Electronic Signatures in Global and National Commerce Act (E-SIGN) és
          az államok elektronikus ügyletekről szóló törvényei (például UETA),
          ahol ezek alkalmazandók.
        </p>
        <p>
          A SignuDoc nem biztosít eIDAS szerinti minősített elektronikus
          aláírást, és nem ígéri, hogy egy SignuDoc-folyamat a hétköznapi
          egyesült államokbeli elektronikus aláírási kereteken kívül megfelel
          bármely ország bizalmi szolgáltatási, tanúsítványra vonatkozó,
          személyazonosság-ellenőrzési vagy közjegyzői szabályainak.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          6. A fiók biztonsága és elfogadható használat
        </h2>
        <p>
          Te felelsz a belépési adataid védelméért, a fiókodhoz való hozzáférés
          korlátozásáért, és azért, hogy haladéktalanul értesítsd a SignuDocot,
          ha jogosulatlan használatot gyanítasz. A SignuDoc nem használható
          jogsértésre, mások jogainak megsértésére, kártevő terjesztésére, a
          címzettek zaklatására, adatok automatikus kigyűjtésére, a szolgáltatás
          működésének zavarására, illetve a hozzáférés-szabályozás vagy a
          kérésgyakorisági korlátok megkerülésére.
        </p>
        <p>
          A SignuDoc nem használható más személy megszemélyesítésére, aláírások
          megtévesztéssel történő gyűjtésére, vagy olyan kéretlen vagy tömeges
          üzenetek küldésére, amelyek nem kapcsolódnak valódi aláírási
          folyamathoz.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          7. A szolgáltatás változásai, elérhetősége és az iratok
        </h2>
        <p>
          A SignuDoc bármikor módosíthatja, fejlesztheti, felfüggesztheti vagy
          megszüntetheti az egyes funkciókat. A szolgáltatás fejlődésével
          korlátokat vezethetünk be a dokumentumméretre, az aláírók számára, a
          tárhelyre vagy a megőrzésre. Eltávolíthatunk tartalmat, illetve
          felfüggeszthetünk fiókokat, ha azok látszólag megsértik ezeket a
          feltételeket, vagy jogi, működési vagy biztonsági kockázatot
          jelentenek.
        </p>
        <p>
          A fontos lezárt dokumentumokról érdemes saját példányt letöltened és
          megőrizned. A SignuDoc által biztosított dokumentumtárolás kényelmi
          funkció, és az adatvédelmi tájékoztatóban leírt megőrzési és törlési
          gyakorlat vonatkozik rá.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          8. Szellemi tulajdon és a tartalmaid
        </h2>
        <p>
          Közted és a SignuDoc között a feltöltött dokumentumok és adatok a
          tieid maradnak, azzal, hogy a SignuDoc és szolgáltatói megkapják
          azokat a jogokat, amelyek a tartalom tárolásához, feldolgozásához,
          továbbításához, megjelenítéséhez, védelméhez és őrzéséhez szükségesek
          a szolgáltatás működtetése érdekében.
        </p>
        <p>
          A SignuDocot, a márkajelzéseit, a szoftverét, a felületét és a
          kapcsolódó anyagokat a vonatkozó szellemitulajdon-jogi szabályok
          védik. Ha jogszabály kifejezetten nem engedi, nem másolhatod,
          értékesítheted tovább, fejtheted vissza a szolgáltatást, és nem
          készíthetsz belőle származékos művet.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          9. Felfüggesztés, megszüntetés és a fiók lezárása
        </h2>
        <p>
          A szolgáltatás használatát bármikor abbahagyhatod. A SignuDoc
          felfüggesztheti vagy megszüntetheti a hozzáférésedet, ha észszerűen
          úgy ítéli meg, hogy megsértetted ezeket a feltételeket, a
          szolgáltatást a megengedett körön kívül használtad, vagy biztonsági,
          csalási vagy jogi kockázatot okoztál.
        </p>
        <p>
          A fiók lezárását a beállítások oldalon kérheted, vagy írhatsz ide:{" "}
          <Link
            className="font-semibold text-(--accent-ink) underline decoration-[rgb(var(--accent-rgb)/0.35)] underline-offset-4"
            href={`mailto:${supportAddress}`}
          >
            {supportAddress}
          </Link>
          . A fiók lezárása előtt töltsd le azokat a dokumentumokat, amelyeket
          meg szeretnél tartani. A lezárás után a SignuDoc korlátozott ideig
          lehetőséget adhat az adatok exportálására, majd törölheti a tárolt
          dokumentumfájlokat és a kapcsolódó küldeményadatokat, kivéve azokat a
          korlátozott adatokat, amelyeket biztonsági, csalásmegelőzési, jogi
          megfelelési vagy vitarendezési célból megőriz.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          10. Felelősségkizárás
        </h2>
        <p>
          A SignuDocot a jogszabályok által megengedett legteljesebb mértékben
          „ahogy van” és „ahogy elérhető” alapon biztosítjuk. A SignuDoc kizár
          minden kifejezett, hallgatólagos, törvényi vagy egyéb szavatosságot,
          ideértve a forgalomképességre, az adott célra való alkalmasságra, a
          jogcímre, a jogsértés hiányára, a pontosságra, a megszakítás nélküli
          elérhetőségre és az adott ügylethez szükséges jogi megfelelőségre
          vonatkozó hallgatólagos szavatosságot is.
        </p>
        <p>
          A SignuDoc nem szavatolja, hogy egy adott folyamat a bíróság előtt
          érvényes lesz, a hatóság elfogadja, vagy alkalmas egy szabályozott
          vagy kizárt dokumentumtípushoz. A dokumentumok érvényesíthetőségével,
          megőrzésével, a fogyasztói tájékoztatásokkal, a közjegyzői
          hitelesítéssel vagy az egyes joghatóságok előírásaival kapcsolatos
          kérdésekben kérj jogi tanácsot.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          11. A felelősség korlátozása
        </h2>
        <p>
          A jogszabályok által megengedett legteljesebb mértékben a SignuDoc,
          valamint kapcsolt vállalkozásai, szolgáltatói, licencadói és
          munkatársai nem felelnek semmilyen közvetett, járulékos, különleges,
          következményi, példaértékű vagy büntető jellegű kárért, illetve az
          elmaradt haszonért, bevételért, jó hírnévért, adatokért vagy
          használatért, amely a szolgáltatásból vagy ezekből a feltételekből
          ered, vagy azokkal összefügg.
        </p>
        <p>
          A jogszabályok által megengedett legteljesebb mértékben a SignuDoc
          összesített felelőssége a szolgáltatásból vagy ezekből a feltételekből
          eredő vagy azokkal összefüggő valamennyi igényre nem haladhatja meg a
          következők közül a nagyobbat: az az összeg, amelyet az igényt
          megalapozó eseményt megelőző 12 hónapban a szolgáltatásért a
          SignuDocnak fizettél, vagy száz amerikai dollár (100 USD).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          12. Kártalanítás
        </h2>
        <p>
          Megvéded és kártalanítod a SignuDocot, valamint kapcsolt
          vállalkozásait, szolgáltatóit, licencadóit és munkatársait, és
          mentesíted őket minden olyan igény, veszteség, kár, felelősség,
          költség és kiadás (ideértve az észszerű ügyvédi díjakat is) alól,
          amely a dokumentumaidból, a szolgáltatás általad történő
          használatából, ezeknek a feltételeknek a megszegéséből, illetve
          jogszabály vagy más személy jogainak megsértéséből ered, vagy azokkal
          összefügg.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          13. Irányadó jog és változások
        </h2>
        <p>
          Hacsak az alkalmazandó jog másként nem rendelkezik, ezekre a
          feltételekre az Egyesült Államok szövetségi joga és annak az államnak
          a joga az irányadó, amelyben a SignuDoc üzemeltetőjét bejegyezték, a
          kollíziós szabályok figyelembevétele nélkül. Te és a SignuDoc
          elfogadjátok, hogy a bíróság elé vihető vitákban kizárólag az adott
          helyen illetékes állami vagy szövetségi bíróságok járnak el.
        </p>
        <p>
          A SignuDoc ezeket a feltételeket időről időre frissítheti úgy, hogy a
          módosított változatot közzéteszi ezen az oldalon. A frissített
          feltételek a közzétételükkor lépnek hatályba, hacsak nem jelölünk meg
          későbbi hatálybalépési időpontot.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-(--fg)">
          14. Kapcsolat
        </h2>
        <p>
          A feltételekkel kapcsolatos kérdéseidet ide küldheted:{" "}
          <Link
            className="font-semibold text-(--accent-ink) underline decoration-[rgb(var(--accent-rgb)/0.35)] underline-offset-4"
            href={`mailto:${supportAddress}`}
          >
            {supportAddress}
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
