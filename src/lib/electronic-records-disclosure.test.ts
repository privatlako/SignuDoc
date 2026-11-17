import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import {
  buildElectronicRecordsDisclosure,
  CONSENT_STATEMENT,
  DEFAULT_DISCLOSURE_TEMPLATE,
  ELECTRONIC_RECORDS_DISCLOSURE_VERSION,
  fillDisclosurePlaceholders,
  findUnknownPlaceholders,
  formatDisclosureText,
  parseDisclosureText,
} from "./electronic-records-disclosure.ts";
import { resolveSignerDisclosure } from "./signer-disclosure.ts";

const party = { contactAddress: "help@acme.com", senderName: "Kiss Anna" };

test("the built-in disclosure keeps its five sections, with the sender filled in", () => {
  const sections = buildElectronicRecordsDisclosure(party);

  assert.deepEqual(
    sections.map((section) => section.heading),
    [
      "Hozzájárulás az elektronikus ügyintézéshez",
      "Választhatod a papírt is",
      "A hozzájárulás visszavonása",
      "Amire szükséged van",
      "Mire vonatkozik ez a hozzájárulás",
    ],
  );
  assert.ok(sections.every((section) => section.paragraphs.length === 1));
  assert.match(sections[0].paragraphs[0], /^Kiss Anna arra kér,/);
  assert.match(
    sections[1].paragraphs[0],
    /keresd: Kiss Anna \(help@acme\.com\)\. A papírmásolat ingyenes, hacsak Kiss Anna /,
  );
  assert.doesNotMatch(formatDisclosureText(sections), /\{sender\}|\{contact\}/);
});

test("without an address, {contact} is the sender's name alone", () => {
  assert.equal(
    fillDisclosurePlaceholders("Írj: {contact}.", {
      contactAddress: null,
      senderName: "Acme",
    }),
    "Írj: Acme.",
  );
});

test("placeholders are filled in one pass, so a name that looks like one stays as it is", () => {
  assert.equal(
    fillDisclosurePlaceholders("{sender} / {contact}", {
      contactAddress: "a@b.hu",
      senderName: "{contact}",
    }),
    "{contact} / {contact} (a@b.hu)",
  );
});

test("blank lines separate paragraphs and '## ' starts a section", () => {
  const sections = parseDisclosureText(
    [
      "Bevezető első sora",
      "ugyanannak a bekezdésnek a második sora",
      "",
      "",
      "Második bekezdés",
      "##   Első cím  ",
      "Az első cím alatt",
      "",
      "Még egy bekezdés",
      "## Üres cím",
      "##",
      "## Utolsó",
      "Vége",
    ].join("\r\n"),
  );

  assert.deepEqual(sections, [
    {
      heading: null,
      paragraphs: [
        "Bevezető első sora\nugyanannak a bekezdésnek a második sora",
        "Második bekezdés",
      ],
    },
    {
      heading: "Első cím",
      paragraphs: ["Az első cím alatt", "Még egy bekezdés"],
    },
    { heading: "Üres cím", paragraphs: [] },
    { heading: "Utolsó", paragraphs: ["Vége"] },
  ]);
});

test("markup is kept as text, not read", () => {
  const [section] = parseDisclosureText(
    "# Not a heading\n<script>alert(1)</script> <b>bold</b>",
  );

  assert.equal(section.heading, null);
  assert.deepEqual(section.paragraphs, [
    "# Not a heading\n<script>alert(1)</script> <b>bold</b>",
  ]);
});

test("text written back from its sections reads the same again", () => {
  const sections = parseDisclosureText(DEFAULT_DISCLOSURE_TEMPLATE);

  assert.equal(formatDisclosureText(sections), DEFAULT_DISCLOSURE_TEMPLATE);
  assert.deepEqual(
    parseDisclosureText(formatDisclosureText(sections)),
    sections,
  );
});

test("placeholders other than {sender} and {contact} are found", () => {
  assert.deepEqual(
    findUnknownPlaceholders("{sender} {sendr} {contact} {sendr} {x_1} {}"),
    ["{sendr}", "{x_1}"],
  );
});

test("no custom words means the built-in version", () => {
  for (const overrides of [
    { statement: null, text: null },
    { statement: "  ", text: "\n\n" },
    // The built-in words themselves, however they are spaced.
    {
      statement: ` ${CONSENT_STATEMENT}\n`,
      text: DEFAULT_DISCLOSURE_TEMPLATE.replaceAll("\n\n", "\n\n\n"),
    },
  ]) {
    const disclosure = resolveSignerDisclosure(party, overrides);

    assert.equal(disclosure.custom, false);
    assert.equal(disclosure.version, ELECTRONIC_RECORDS_DISCLOSURE_VERSION);
    assert.equal(disclosure.statement, CONSENT_STATEMENT);
    assert.deepEqual(
      disclosure.sections,
      buildElectronicRecordsDisclosure(party),
    );
  }
});

test("custom words get a version made from a hash of exactly what is shown", () => {
  const disclosure = resolveSignerDisclosure(party, {
    statement: "Elfogadom, {sender}.",
    text: "## Tájékoztató\n\nA dokumentumot {sender} küldte. Kérdés: {contact}.",
  });
  const expectedText =
    "## Tájékoztató\n\nA dokumentumot Kiss Anna küldte. Kérdés: Kiss Anna (help@acme.com).";
  const expectedStatement = "Elfogadom, Kiss Anna.";

  assert.equal(disclosure.custom, true);
  assert.equal(disclosure.text, expectedText);
  assert.equal(disclosure.statement, expectedStatement);
  assert.equal(
    disclosure.version,
    `custom-${createHash("sha256")
      .update(`${expectedText}\n\n${expectedStatement}`)
      .digest("hex")
      .slice(0, 12)}`,
  );
  assert.match(disclosure.version, /^custom-[0-9a-f]{12}$/);
});

test("a different word, sender or checkbox text gives a different version", () => {
  const base = { statement: null, text: "Első szöveg, {sender}." };
  const versions = new Set([
    resolveSignerDisclosure(party, base).version,
    resolveSignerDisclosure(party, { ...base, text: "Első szöveg!, {sender}." })
      .version,
    resolveSignerDisclosure({ ...party, senderName: "Nagy Béla" }, base)
      .version,
    resolveSignerDisclosure(party, { ...base, statement: "Egyetértek." })
      .version,
  ]);

  assert.equal(versions.size, 4);
  // Spacing alone does not change the words, so not the version either.
  assert.equal(
    resolveSignerDisclosure(party, {
      ...base,
      text: "\n Első szöveg, {sender}.  \n",
    }).version,
    resolveSignerDisclosure(party, base).version,
  );
});

test("only a custom checkbox text still counts as custom words", () => {
  const disclosure = resolveSignerDisclosure(party, {
    statement: "Egyetértek.",
    text: null,
  });

  assert.equal(disclosure.custom, true);
  assert.deepEqual(
    disclosure.sections,
    buildElectronicRecordsDisclosure(party),
  );
  assert.match(disclosure.version, /^custom-/);
});

test("a text with nothing readable in it falls back to the built-in one", () => {
  const disclosure = resolveSignerDisclosure(party, {
    statement: null,
    text: "##\n\n##   ",
  });

  assert.equal(disclosure.custom, false);
  assert.equal(disclosure.version, ELECTRONIC_RECORDS_DISCLOSURE_VERSION);
});
