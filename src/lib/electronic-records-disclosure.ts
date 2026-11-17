// What a signer is told, and agrees to, before signing: the disclosure the
// US laws on electronic signatures expect (ESIGN 101(c), UETA 5) and that
// works as a plain statement of terms elsewhere. Its version is stored with
// each signer's agreement, so the record shows which words they saw. Change
// the version whenever the default words change.
//
// An administrator can replace the words in Settings. That text is plain
// text, never HTML: blank lines separate paragraphs, a line that starts with
// "## " is a heading, and {sender} and {contact} are filled in per envelope.
// A replaced text gets a version made from a hash of the exact words (see
// signer-disclosure.ts), so the record still shows what the signer saw.
//
// Nothing here touches Node APIs: the Settings form uses it in the browser.

export const ELECTRONIC_RECORDS_DISCLOSURE_VERSION = "2026-11-16";

/** The longest disclosure text an administrator can save. */
export const MAX_DISCLOSURE_TEXT_LENGTH = 8000;

/** The longest consent checkbox text an administrator can save. */
export const MAX_CONSENT_STATEMENT_LENGTH = 600;

/** The placeholders a disclosure or consent text may use. */
export const DISCLOSURE_PLACEHOLDERS = ["sender", "contact"] as const;

export type DisclosureParty = {
  /** Who to ask for a paper copy or to withdraw: the organization or sender. */
  contactAddress: string | null;
  senderName: string;
};

export type DisclosureSection = {
  heading: string | null;
  paragraphs: string[];
};

/**
 * The built-in disclosure, in the same plain-text form an administrator
 * edits. {sender} is the sender's name; {contact} is the sender's name with
 * the address to write to.
 */
export const DEFAULT_DISCLOSURE_TEMPLATE = [
  "## Hozzájárulás az elektronikus ügyintézéshez",
  "{sender} arra kér, hogy ezt a dokumentumot papír helyett elektronikusan kapd meg és írd alá. Ha hozzájárulsz, az elektronikus aláírásod ugyanolyan hatályú, mint a kézzel írt, és az így kapott dokumentumok írásban kézbesítettnek számítanak.",
  "## Választhatod a papírt is",
  "Nem kötelező hozzájárulnod. Ha inkább papíron írnád alá, vagy aláírás után papírmásolatot kérnél bármelyik dokumentumról, keresd: {contact}. A papírmásolat ingyenes, hacsak {sender} a kérésed előtt másképp nem jelzi.",
  "## A hozzájárulás visszavonása",
  "Aláírás előtt bármikor visszavonhatod ezt a hozzájárulást: utasítsd el az aláírást, vagy jelezd itt: {contact}. A visszavonás nem érinti a már megadott aláírást.",
  "## Amire szükséged van",
  "Egy friss webböngésző és egy eszköz, amely meg tudja nyitni és menteni a PDF-fájlokat. Az aláírt dokumentumot e-mailben kapod meg, ezért a küldőnél mindig a naprakész e-mail-címed szerepeljen. Töltsd le és őrizd meg az aláírt példányt: ez a saját példányod.",
  "## Mire vonatkozik ez a hozzájárulás",
  "Erre a dokumentumra és a vele kapcsolatos értesítésekre, amelyeket ezen az oldalon keresztül kapsz.",
].join("\n\n");

export const CONSENT_STATEMENT =
  "Elolvastam a fenti tájékoztatót, ezen az eszközön meg tudom nyitni és menteni a PDF-fájlokat, és hozzájárulok, hogy ehhez a dokumentumhoz elektronikus dokumentumokat és aláírást használjak.";

/** What {contact} stands for: the sender, and where to write when known. */
export function disclosureContact(party: DisclosureParty): string {
  return party.contactAddress
    ? `${party.senderName} (${party.contactAddress})`
    : party.senderName;
}

/**
 * Fills in {sender} and {contact} in one pass, so a name that itself looks
 * like a placeholder is left as it is.
 */
export function fillDisclosurePlaceholders(
  text: string,
  party: DisclosureParty,
): string {
  const contact = disclosureContact(party);

  return text.replace(/\{(sender|contact)\}/g, (_match, name: string) =>
    name === "sender" ? party.senderName : contact,
  );
}

/** Placeholders in a text that are not ones this module fills in. */
export function findUnknownPlaceholders(text: string): string[] {
  const known = new Set<string>(DISCLOSURE_PLACEHOLDERS);
  const unknown = new Set<string>();

  for (const match of text.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g)) {
    if (!known.has(match[1])) {
      unknown.add(match[0]);
    }
  }

  return [...unknown];
}

/**
 * Reads plain text into sections. Blank lines separate paragraphs, a line
 * that starts with "## " starts a new section with that heading, and single
 * line breaks inside a paragraph are kept. Nothing is read as markup.
 */
export function parseDisclosureText(text: string): DisclosureSection[] {
  const sections: DisclosureSection[] = [];
  let section: DisclosureSection = { heading: null, paragraphs: [] };
  let paragraph: string[] = [];

  const endParagraph = () => {
    if (paragraph.length > 0) {
      section.paragraphs.push(paragraph.join("\n"));
      paragraph = [];
    }
  };
  const endSection = () => {
    endParagraph();

    if (section.heading !== null || section.paragraphs.length > 0) {
      sections.push(section);
    }
  };

  for (const rawLine of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    const heading = /^##(?:\s+(.*))?$/.exec(line);

    if (heading) {
      const headingText = (heading[1] ?? "").trim();

      // "##" with nothing after it is not a heading of anything.
      if (headingText.length > 0) {
        endSection();
        section = { heading: headingText, paragraphs: [] };
      }

      continue;
    }

    if (line.length === 0) {
      endParagraph();
      continue;
    }

    paragraph.push(line);
  }

  endSection();

  return sections;
}

/**
 * Writes sections back as plain text, in one fixed form. The same words
 * always come out the same way, which is what the version hash is made of.
 */
export function formatDisclosureText(
  sections: readonly DisclosureSection[],
): string {
  const blocks: string[] = [];

  for (const section of sections) {
    if (section.heading !== null) {
      blocks.push(`## ${section.heading}`);
    }

    blocks.push(...section.paragraphs);
  }

  return blocks.join("\n\n");
}

/** Sections with {sender} and {contact} filled in. */
export function renderDisclosureSections(
  template: string,
  party: DisclosureParty,
): DisclosureSection[] {
  return parseDisclosureText(template).map((section) => ({
    heading:
      section.heading === null
        ? null
        : fillDisclosurePlaceholders(section.heading, party),
    paragraphs: section.paragraphs.map((paragraph) =>
      fillDisclosurePlaceholders(paragraph, party),
    ),
  }));
}

/** The built-in disclosure for one sender. */
export function buildElectronicRecordsDisclosure(
  party: DisclosureParty,
): DisclosureSection[] {
  return renderDisclosureSections(DEFAULT_DISCLOSURE_TEMPLATE, party);
}

/**
 * True when a saved text says the same as the built-in one, apart from
 * spacing. Such a text is treated as the built-in one, version and all.
 */
export function isDefaultDisclosureTemplate(text: string): boolean {
  return (
    formatDisclosureText(parseDisclosureText(text)) ===
    formatDisclosureText(parseDisclosureText(DEFAULT_DISCLOSURE_TEMPLATE))
  );
}

/** A consent text as it is shown and stored: one line, single spaces. */
export function normalizeConsentStatement(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
