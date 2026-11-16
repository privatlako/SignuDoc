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
      "Felhasználási feltételek:",
      "https://sign.acme.com/terms",
      "",
      "Adatvédelmi tájékoztató:",
      "https://sign.acme.com/privacy",
      "",
      "Kapcsolat:",
      "https://sign.acme.com/contact",
    ].join("\n"),
  );
  assert.match(
    result.htmlBody,
    /<a href="https:\/\/sign\.acme\.com\/terms">Felhasználási feltételek<\/a>/,
  );
  assert.doesNotMatch(result.textBody, /SignuDoc segítségével/);
});

test("a neutral install with nothing else set links its signer privacy notice and says who sent the message", () => {
  const result = withUserEmailLegalFooter(body, neutral, env);

  assert.equal(
    result.textBody,
    [
      "Hello",
      "",
      "Adatkezelési tájékoztató:",
      "https://sign.acme.com/signer-privacy",
      "",
      "Ezt az üzenetet Acme Corp küldte a SignuDoc segítségével.",
    ].join("\n"),
  );
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
      "Felhasználási feltételek:",
      "https://acme.com/terms",
      "",
      "Adatvédelmi tájékoztató:",
      "https://acme.com/privacy",
      "",
      "Kérdésed van? Írj ide: help@acme.com",
      "",
      "Ezt az üzenetet Acme Corp küldte a SignuDoc segítségével.",
    ].join("\n"),
  );
  assert.match(
    result.htmlBody,
    /<a href="mailto:help@acme\.com">help@acme\.com<\/a>/,
  );
});

test("an install that has not been named yet does not invent a name", () => {
  const result = withUserEmailLegalFooter(
    body,
    { ...neutral, organizationName: null, productName: "SignuDoc" },
    env,
  );

  assert.match(
    result.textBody,
    /\n\nEzt az üzenetet a SignuDoc segítségével küldtük\.$/,
  );
  assert.doesNotMatch(result.textBody, /Acme/);
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

  assert.match(
    result.htmlBody,
    /Ezt az üzenetet Harbour &amp; &lt;Finch&gt; küldte/,
  );
  assert.doesNotMatch(result.htmlBody, /<Finch>/);
  assert.doesNotMatch(result.htmlBody, /b="2"/);
  // The plain-text part is not HTML and carries the name as it is.
  assert.match(
    result.textBody,
    /Ezt az üzenetet Harbour & <Finch> küldte a SignuDoc segítségével\./,
  );
});

test("a neutral install with no links does not need to know its own URL", () => {
  assert.doesNotThrow(() => withUserEmailLegalFooter(body, neutral, {}));
});

test("an install with a logo puts it at the top of the HTML part only", () => {
  const result = withUserEmailLegalFooter(
    body,
    {
      ...neutral,
      logoUrl: "/api/brand/logo?v=0123456789abcdef",
      productName: 'Acme "Signing" & Co',
    },
    env,
  );

  assert.ok(
    result.htmlBody.startsWith(
      '<p style="margin:0 0 24px;"><img src="https://sign.acme.com/api/brand/logo?v=0123456789abcdef" alt="Acme &quot;Signing&quot; &amp; Co"',
    ),
  );
  assert.ok(result.htmlBody.includes("<p>Hello</p>"));
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
