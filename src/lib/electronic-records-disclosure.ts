// What a signer is told, and agrees to, before signing: the disclosure the
// US laws on electronic signatures expect (ESIGN 101(c), UETA 5) and that
// works as a plain statement of terms elsewhere. Its version is stored with
// each signer's agreement, so the record shows which words they saw. Change
// the version whenever the words change.

export const ELECTRONIC_RECORDS_DISCLOSURE_VERSION = "2026-11-16";

export type DisclosureParty = {
  /** Who to ask for a paper copy or to withdraw: the organization or sender. */
  contactAddress: string | null;
  senderName: string;
};

export type DisclosureSection = { heading: string; text: string };

export function buildElectronicRecordsDisclosure(
  party: DisclosureParty,
): DisclosureSection[] {
  const contact = party.contactAddress
    ? `${party.senderName} (${party.contactAddress})`
    : party.senderName;

  return [
    {
      heading: "Hozzájárulás az elektronikus ügyintézéshez",
      text: `${party.senderName} arra kér, hogy ezt a dokumentumot papír helyett elektronikusan kapd meg és írd alá. Ha hozzájárulsz, az elektronikus aláírásod ugyanolyan hatályú, mint a kézzel írt, és az így kapott dokumentumok írásban kézbesítettnek számítanak.`,
    },
    {
      heading: "Választhatod a papírt is",
      text: `Nem kötelező hozzájárulnod. Ha inkább papíron írnád alá, vagy aláírás után papírmásolatot kérnél bármelyik dokumentumról, keresd: ${contact}. A papírmásolat ingyenes, hacsak ${party.senderName} a kérésed előtt másképp nem jelzi.`,
    },
    {
      heading: "A hozzájárulás visszavonása",
      text: `Aláírás előtt bármikor visszavonhatod ezt a hozzájárulást: utasítsd el az aláírást, vagy jelezd itt: ${contact}. A visszavonás nem érinti a már megadott aláírást.`,
    },
    {
      heading: "Amire szükséged van",
      text: "Egy friss webböngésző és egy eszköz, amely meg tudja nyitni és menteni a PDF-fájlokat. Az aláírt dokumentumot e-mailben kapod meg, ezért a küldőnél mindig a naprakész e-mail-címed szerepeljen. Töltsd le és őrizd meg az aláírt példányt: ez a saját példányod.",
    },
    {
      heading: "Mire vonatkozik ez a hozzájárulás",
      text: "Erre a dokumentumra és a vele kapcsolatos értesítésekre, amelyeket ezen az oldalon keresztül kapsz.",
    },
  ];
}

export const CONSENT_STATEMENT =
  "Elolvastam a fenti tájékoztatót, ezen az eszközön meg tudom nyitni és menteni a PDF-fájlokat, és hozzájárulok, hogy ehhez a dokumentumhoz elektronikus dokumentumokat és aláírást használjak.";
