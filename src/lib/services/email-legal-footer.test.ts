import assert from "node:assert/strict";
import { test } from "node:test";

import { HOSTED_BRANDING, type Branding } from "../branding.ts";
import { withUserEmailLegalFooter } from "./email-legal-footer.ts";

const env = { APP_URL: "https://sign.acme.com" };
const body = { htmlBody: "<p>Hello</p>", textBody: "Hello" };

const neutral: Branding = {
  brandColor: null,
  contactUrl: null,
  hosted: false,
  logoUrl: null,
  organizationName: "Acme Corp",
  privacyUrl: null,
  productName: "Acme Corp",
  signupAvailable: true,
  supportAddress: null,
  termsUrl: null,
};

test("the hosted service links to its own terms, privacy and contact pages", () => {
  const result = withUserEmailLegalFooter(body, HOSTED_BRANDING, env);

  assert.equal(
    result.textBody,
    [
      "Hello",
      "",
      "Ez egy automatikus e-mail.",
      "",
      "Felhasználási feltételek:",
      "https://sign.acme.com/terms",
      "",
      "Adatvédelmi tájékoztató:",
      "https://sign.acme.com/privacy",
      "",
      "Kapcsolat:",
      "https://sign.acme.com/contact",
      "",
      "SignuDoc · Elektronikus szerződés aláíró portál",
    ].join("\n"),
  );
  assert.match(
    result.htmlBody,
    /<a href="https:\/\/sign\.acme\.com\/terms" style="[^"]*">Felhasználási feltételek<\/a>/,
  );
});

test("a neutral install links its signer privacy notice and names the organization and the portal", () => {
  const result = withUserEmailLegalFooter(body, neutral, env);

  assert.equal(
    result.textBody,
    [
      "Hello",
      "",
      "Ez egy automatikus e-mail.",
      "",
      "Adatkezelési tájékoztató:",
      "https://sign.acme.com/signer-privacy",
      "",
      "Acme Corp · Elektronikus szerződés aláíró portál",
    ].join("\n"),
  );
  assert.doesNotMatch(result.textBody, /SignuDoc/);
  assert.doesNotMatch(result.htmlBody, /SignuDoc/);
});

test("a neutral install links to the organization's own pages and support address", () => {
  const result = withUserEmailLegalFooter(
    body,
    {
      ...neutral,
      privacyUrl: "https://acme.com/privacy",
      supportAddress: "help@acme.com",
      termsUrl: "https://acme.com/terms",
    },
    env,
  );

  assert.equal(
    result.textBody,
    [
      "Hello",
      "",
      "Ez egy automatikus e-mail.",
      "",
      "Kérdésed van? Írj nekünk: help@acme.com",
      "",
      "Felhasználási feltételek:",
      "https://acme.com/terms",
      "",
      "Adatvédelmi tájékoztató:",
      "https://acme.com/privacy",
      "",
      "Acme Corp · Elektronikus szerződés aláíró portál",
    ].join("\n"),
  );
  assert.match(
    result.htmlBody,
    /<a href="mailto:help@acme\.com" style="[^"]*">help@acme\.com<\/a>/,
  );
});

test("the message body is wrapped in a complete Hungarian HTML document", () => {
  const result = withUserEmailLegalFooter(body, neutral, env);

  assert.ok(result.htmlBody.startsWith("<!DOCTYPE html>"));
  assert.match(result.htmlBody, /<html lang="hu">/);
  assert.match(result.htmlBody, /Elektronikus szerződés aláíró portál/);
  // Plain paragraphs get the layout's styles.
  assert.match(result.htmlBody, /<p style="[^"]*">Hello<\/p>/);
});

test("the organization's name and links are escaped in the HTML part", () => {
  const result = withUserEmailLegalFooter(
    body,
    {
      ...neutral,
      organizationName: "Harbour & <Finch>",
      termsUrl: 'https://acme.com/terms?a=1&b="2"',
    },
    env,
  );

  assert.match(result.htmlBody, /Harbour &amp; &lt;Finch&gt;/);
  assert.doesNotMatch(result.htmlBody, /<Finch>/);
  assert.doesNotMatch(result.htmlBody, /b="2"/);
  // The plain-text part is not HTML and carries the name as it is.
  assert.match(result.textBody, /Harbour & <Finch> · Elektronikus/);
});

test("a neutral install with no links does not need to know its own URL", () => {
  assert.doesNotThrow(() => withUserEmailLegalFooter(body, neutral, {}));
});

test("an install with a logo shows it in the header of the HTML part only", () => {
  const result = withUserEmailLegalFooter(
    body,
    {
      ...neutral,
      logoUrl: "/api/brand/logo?v=0123456789abcdef",
      organizationName: 'Acme "Signing" & Co',
    },
    env,
  );

  assert.match(
    result.htmlBody,
    /<img src="https:\/\/sign\.acme\.com\/api\/brand\/logo\?v=0123456789abcdef" alt="Acme &quot;Signing&quot; &amp; Co"/,
  );
  assert.doesNotMatch(result.textBody, /logo/);
});

test("without the site's address there is nowhere to fetch a logo from", () => {
  const result = withUserEmailLegalFooter(
    body,
    { ...neutral, logoUrl: "/api/brand/logo?v=0123456789abcdef" },
    {},
  );

  assert.doesNotMatch(result.htmlBody, /<img/);
});
