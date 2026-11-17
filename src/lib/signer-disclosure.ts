import { createHash } from "node:crypto";

import {
  buildElectronicRecordsDisclosure,
  CONSENT_STATEMENT,
  ELECTRONIC_RECORDS_DISCLOSURE_VERSION,
  fillDisclosurePlaceholders,
  formatDisclosureText,
  isDefaultDisclosureTemplate,
  normalizeConsentStatement,
  renderDisclosureSections,
  type DisclosureParty,
  type DisclosureSection,
} from "./electronic-records-disclosure.ts";

// The disclosure one signer is shown: the built-in words, or the ones an
// administrator saved in Settings, with the sender filled in.

export type SignerDisclosure = {
  /** True when the administrator's own words are used for either part. */
  custom: boolean;
  sections: DisclosureSection[];
  statement: string;
  /** The sections as plain text, exactly as the signer is shown them. */
  text: string;
  /**
   * ELECTRONIC_RECORDS_DISCLOSURE_VERSION for the built-in words, otherwise
   * "custom-" and the first 12 hex digits of the SHA-256 of the text, a blank
   * line, and the consent statement. Either way it names the exact words.
   */
  version: string;
};

export type DisclosureOverrides = {
  /** The administrator's disclosure text, or null for the built-in one. */
  text: string | null;
  /** The administrator's consent checkbox text, or null for the built-in one. */
  statement: string | null;
};

export function customDisclosureVersion(
  text: string,
  statement: string,
): string {
  const digest = createHash("sha256")
    .update(`${text}\n\n${statement}`, "utf8")
    .digest("hex");

  return `custom-${digest.slice(0, 12)}`;
}

export function resolveSignerDisclosure(
  party: DisclosureParty,
  overrides: DisclosureOverrides,
): SignerDisclosure {
  const customText =
    overrides.text !== null &&
    overrides.text.trim().length > 0 &&
    !isDefaultDisclosureTemplate(overrides.text)
      ? overrides.text
      : null;
  const customStatement =
    overrides.statement !== null &&
    normalizeConsentStatement(overrides.statement).length > 0 &&
    normalizeConsentStatement(overrides.statement) !== CONSENT_STATEMENT
      ? normalizeConsentStatement(overrides.statement)
      : null;

  const sections =
    customText === null
      ? buildElectronicRecordsDisclosure(party)
      : renderDisclosureSections(customText, party);
  // A text that turns out to hold nothing readable falls back to the
  // built-in one rather than showing the signer an empty box.
  const shownSections =
    sections.length > 0 ? sections : buildElectronicRecordsDisclosure(party);
  const statement =
    customStatement === null
      ? CONSENT_STATEMENT
      : fillDisclosurePlaceholders(customStatement, party);
  const text = formatDisclosureText(shownSections);
  const custom =
    (customText !== null && sections.length > 0) || customStatement !== null;

  return {
    custom,
    sections: shownSections,
    statement,
    text,
    version: custom
      ? customDisclosureVersion(text, statement)
      : ELECTRONIC_RECORDS_DISCLOSURE_VERSION,
  };
}
