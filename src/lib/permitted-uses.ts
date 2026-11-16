// What documents this software may be used for, shown on every install at
// /electronic-signatures and confirmed by the sender before each send. The
// version is stored with each send, so the record shows which list the
// sender confirmed.

export const PERMITTED_USE_VERSION = "2026-11-14";
export const PERMITTED_USE_PATH = "/electronic-signatures";

export type UseSection = { heading: string; items: string[] };

/** Documents the US laws exclude from electronic signature (ESIGN 103, UETA 3). */
export const US_EXCLUDED_DOCUMENTS: string[] = [
  "Végrendeletek, végrendelet-kiegészítések és végrendeleti trösztök.",
  "Örökbefogadás, válás és más családjogi ügyek.",
  "Bírósági határozatok, értesítések és hivatalos bírósági iratok, például beadványok és periratok.",
  "Hitelszerződés vagy elsődleges lakóhely bérlete alapján küldött értesítések késedelemről, végrehajtásról, kilakoltatásról vagy visszavételről.",
  "Értesítések közüzemi szolgáltatások (víz, fűtés, áram) megszüntetéséről vagy felmondásáról.",
  "Értesítések egészség- vagy életbiztosítási juttatások megszüntetéséről vagy felmondásáról (a járadékok kivételével).",
  "Termékvisszahívási értesítések és az egészséget vagy biztonságot veszélyeztető lényeges hibákról szóló értesítések.",
  "Veszélyes anyagok, növényvédő szerek vagy más mérgező vagy veszélyes anyagok szállításához vagy kezeléséhez kötelezően mellékelendő iratok.",
  "Az egységes kereskedelmi törvénykönyv (Uniform Commercial Code) legtöbb része az adásvételen és a bérleten kívül (például a forgatásra szánt értékpapírok, mint a saját váltók).",
  "Minden más, amit az adott állam vagy ország papíron, közjegyzői hitelesítéssel vagy személyes tanúzással ír elő, például sok ingatlan-átruházási okirat.",
];

/** Documents that the EU and member states commonly keep out of simple e-signatures. */
export const EU_LIMITS: string[] = [
  "Ingatlanon fennálló jogokat létrehozó vagy átruházó szerződések (a bérlet kivételével), amelyekhez a legtöbb tagállam közjegyzői formát ír elő.",
  "Szerződések, amelyekhez jogszabály szerint bíróság, hatóság vagy közjegyző közreműködése szükséges.",
  "Fogyasztók által vállalt kezességi és garanciaszerződések, valamint családjogi és öröklési ügyek, sok tagállamban.",
  "Minden, amihez a jogszabály minősített elektronikus aláírást (QES) ír elő, kivéve, ha ehhez a telepítéshez aláírás-szolgáltató tartozik, és a küldeményt minősített aláírással küldik, úgy, hogy minden aláíró minősített tanúsítvánnyal rendelkezik.",
];

export const WHAT_IT_IS: UseSection = {
  heading: "Mi a Signudoc",
  items: [
    "Eszköz hétköznapi üzleti megállapodásokhoz: adásvételi és szolgáltatási szerződésekhez, titoktartási megállapodásokhoz (NDA), ajánlatokhoz, megrendelésekhez, hozzájárulási és jóváhagyási űrlapokhoz és hasonló dokumentumokhoz.",
    "Az Egyesült Államokban az itt tett aláírások az ESIGN és az UETA (valamint New York állam ESRA törvénye) szerinti elektronikus aláírások.",
    "Az EU-ban és az Egyesült Királyságban ezek az eIDAS szerinti egyszerű elektronikus aláírások (SES). A bíróság nem utasíthatja el őket csak azért, mert elektronikusak, de előfordulhat, hogy bizonyítanod kell, ki írta alá a dokumentumot. Ebben segít a hitelesítési igazolás, a lezárt PDF és a választható hozzáférési kód vagy e-mailes kód.",
  ],
};

export const WHAT_IT_IS_NOT: UseSection = {
  heading: "Mi nem a Signudoc",
  items: [
    "Alapállapotában nem az eIDAS szerinti fokozott biztonságú (AdES) vagy minősített (QES) elektronikus aláírás. A telepítéshez hozzá lehet adni aláírás-szolgáltatót, és ezen keresztül a küldő kérheti, hogy minden aláíró a saját nevében fokozott biztonságú vagy minősített aláírással írjon alá. Ilyen szolgáltató nélkül a lezárt PDF-eken lévő elektronikus bélyegző a telepítés sajátja, vagy – ha a szervezet bélyegzőtanúsítványt vásárol – a szervezet fokozott biztonságú elektronikus bélyegzője, nem pedig az aláíróké.",
    "Alapállapotában nem validált, az FDA 21 CFR Part 11 előírásainak megfelelő rendszer. A rendszergazda bekapcsolhatja a Part 11 módot (az aláírók saját, megerősített fiókkal és jelszóval írnak alá, és minden aláírás feltünteti a jelentését), de a szervezetednek ettől még validálnia kell a telepítést, saját eljárásokat kell kidolgoznia és követnie, és igazolnia kell az elektronikus aláírásait az FDA felé.",
    "Nem HIPAA hatálya alá tartozó szolgáltatás. Ne küldj védett egészségügyi adatot, hacsak a szervezetednek nincsenek saját megállapodásai és kontrolljai a telepítés által használt minden szolgáltatásra.",
    "Az egyes aláírók által adott, elektronikus iratokra vonatkozó hozzájáruláson túl nem fogyasztói tájékoztatási rendszer. Ha jogszabály írja elő, hogy bizonyos fogyasztói tájékoztatásokat elektronikusan kell átadnod, ellenőrizd, hogy annak saját szabályai teljesülnek-e.",
    "Nem jogi tanácsadás. Hogy a telepítés milyen dokumentumokhoz használható, arról az dönt, aki üzemelteti.",
  ],
};
