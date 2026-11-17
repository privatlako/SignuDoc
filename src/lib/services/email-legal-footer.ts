import { type Branding } from "../branding.ts";
import { getEnv, type EnvSource } from "../utils/env.ts";
import { PORTAL_NAME, renderEmailLayout } from "./email-layout.ts";
import { requireConfigValue } from "./service-config.ts";

type EmailBodyContent = {
  htmlBody: string;
  textBody: string;
};

type FooterLink = {
  label: string;
  url: string;
};

// Links may be pages on this site ("/terms") or the organization's own
// absolute URLs. Either way the email gets an absolute URL.
function buildFooterLinks(branding: Branding, env: EnvSource): FooterLink[] {
  const candidates: Array<[label: string, url: string | null]> = [
    ["Felhasználási feltételek", branding.termsUrl],
    // Without the organization's own policy, the notice built from the
    // install's settings.
    branding.privacyUrl || branding.hosted
      ? ["Adatvédelmi tájékoztató", branding.privacyUrl]
      : [
          "Adatkezelési tájékoztató",
          getEnv(env).appUrl ? "/signer-privacy" : null,
        ],
    ["Kapcsolat", branding.contactUrl],
  ];
  const links = candidates.filter((candidate): candidate is [string, string] =>
    Boolean(candidate[1]),
  );

  if (links.length === 0) {
    return [];
  }

  const appUrl = requireConfigValue("app", "APP_URL", getEnv(env).appUrl);

  return links.map(([label, url]) => ({
    label,
    url: new URL(url, appUrl).toString(),
  }));
}

/**
 * The install's logo for the top of an email, or null when it has none.
 * Email programs fetch it from this site, so it needs the site's address.
 */
function buildLogoSource(branding: Branding, env: EnvSource): string | null {
  const appUrl = getEnv(env).appUrl;

  if (!branding.logoUrl || !appUrl) {
    return null;
  }

  return new URL(branding.logoUrl, appUrl).toString();
}

/**
 * Puts a message into the shared email layout (see email-layout.ts): the
 * organization's logo and the portal's name on top, and a footer with the
 * support address and the install's terms, privacy and contact links. The
 * plain-text version gets the same footer as lines of text.
 */
export function withUserEmailLegalFooter(
  input: EmailBodyContent & { preheader?: string },
  branding: Branding,
  env: EnvSource = process.env,
): EmailBodyContent {
  const links = buildFooterLinks(branding, env);
  const supportAddress = branding.hosted ? null : branding.supportAddress;
  const name = branding.organizationName ?? branding.productName;
  const textLines: string[] = ["", "Ez egy automatikus e-mail."];

  if (supportAddress) {
    textLines.push("", `Kérdésed van? Írj nekünk: ${supportAddress}`);
  }

  for (const link of links) {
    textLines.push("", `${link.label}:`, link.url);
  }

  textLines.push("", `${name} · ${PORTAL_NAME}`);

  return {
    htmlBody: renderEmailLayout({
      bodyHtml: input.htmlBody,
      branding,
      footer: { links, supportAddress },
      logoSource: buildLogoSource(branding, env),
      ...(input.preheader ? { preheader: input.preheader } : {}),
    }),
    // Each entry starts with an empty line; one more newline puts that
    // empty line between the message and the footer.
    textBody: `${input.textBody}\n${textLines.join("\n")}`,
  };
}
