import { type Branding } from "../branding.ts";
import { escapeHtml } from "../utils/html.ts";

// The look every outgoing email shares: a plain white page, the
// organization's logo on top, the message, and a quiet footer that says the
// email is automatic and names the portal. Built from tables and inline styles, which is what email programs
// (Gmail, Outlook, Apple Mail) reliably render.

export const PORTAL_NAME = "Elektronikus szerződés aláíró portál";

const COLORS = {
  border: "#e8e1d9",
  card: "#ffffff",
  ink: "#2e2621",
  muted: "#7a6f66",
  soft: "#f5f1ec",
};

const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const SERIF_STACK = "Georgia,'Times New Roman',serif";

/** The button and accent color: the install's brand color, or Homilla brown. */
function accentColor(branding: Branding): string {
  return branding.brandColor && /^#[0-9a-f]{6}$/i.test(branding.brandColor)
    ? branding.brandColor
    : COLORS.ink;
}

const PARAGRAPH_STYLE = `margin:0 0 16px;font-family:${FONT_STACK};font-size:16px;line-height:1.6;color:${COLORS.ink};`;
const LINK_STYLE = `color:${COLORS.ink};text-decoration:underline;`;

/** A large, centered call-to-action button. */
export function emailButton(label: string, url: string): string {
  return [
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:28px auto;">',
    "<tr>",
    `<td align="center" bgcolor="{{accent}}" style="border-radius:999px;background:{{accent}};">`,
    `<a href="${escapeHtml(url)}" target="_blank" style="display:inline-block;padding:17px 40px;font-family:${FONT_STACK};font-size:17px;font-weight:600;line-height:1.2;color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>`,
    "</td>",
    "</tr>",
    "</table>",
  ].join("");
}

/** A smaller, outlined button for a second action next to the main one. */
export function emailSecondaryButton(label: string, url: string): string {
  return [
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 28px;">',
    "<tr>",
    `<td align="center" style="border-radius:999px;border:1px solid ${COLORS.border};">`,
    `<a href="${escapeHtml(url)}" target="_blank" style="display:inline-block;padding:13px 28px;font-family:${FONT_STACK};font-size:15px;font-weight:600;line-height:1.2;color:${COLORS.ink};text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>`,
    "</td>",
    "</tr>",
    "</table>",
  ].join("");
}

/** A one-time code, large and easy to copy. */
export function emailCode(code: string): string {
  return [
    `<div style="margin:24px 0;padding:22px 16px;background:${COLORS.soft};border-radius:12px;text-align:center;">`,
    `<span style="font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:${COLORS.ink};">${escapeHtml(code)}</span>`,
    "</div>",
  ].join("");
}

/** The message's title, at the top of the card. */
export function emailHeading(text: string): string {
  return `<h1 style="margin:0 0 20px;font-family:${FONT_STACK};font-size:22px;font-weight:600;line-height:1.3;color:${COLORS.ink};">${escapeHtml(text)}</h1>`;
}

/** A quieter note, for details such as deadlines and fine print. */
export function emailNote(html: string): string {
  return `<p style="margin:0 0 12px;font-family:${FONT_STACK};font-size:14px;line-height:1.6;color:${COLORS.muted};">${html}</p>`;
}

/** Gives the plain <p> and <a> tags of a message body the layout's styles. */
function styleBody(html: string): string {
  return (
    html
      .replace(/<p>/g, `<p style="${PARAGRAPH_STYLE}">`)
      // Only plain links: buttons carry their own style attribute.
      .replace(/<a href="([^"]*)">/g, `<a href="$1" style="${LINK_STYLE}">`)
  );
}

function buildHeader(branding: Branding, logoSource: string | null): string {
  const name = branding.organizationName ?? branding.productName;
  const mark = logoSource
    ? `<img src="${escapeHtml(logoSource)}" alt="${escapeHtml(name)}" height="24" style="display:block;height:24px;width:auto;max-width:180px;border:0;" />`
    : `<div style="font-family:${SERIF_STACK};font-size:20px;letter-spacing:3px;color:${COLORS.ink};">${escapeHtml(name.toUpperCase())}</div>`;

  return `<tr><td style="padding:0 0 32px;">${mark}</td></tr>`;
}

export type EmailFooterContent = {
  links: Array<{ label: string; url: string }>;
  supportAddress: string | null;
};

function buildFooter(branding: Branding, footer: EmailFooterContent): string {
  const name = branding.organizationName ?? branding.productName;
  const style = `margin:0 0 8px;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${COLORS.muted};`;
  const linkStyle = `color:${COLORS.muted};text-decoration:underline;`;
  const parts: string[] = [
    `<p style="${style}">Ez egy automatikus e-mail.</p>`,
  ];

  if (footer.supportAddress) {
    parts.push(
      `<p style="${style}">Kérdésed van? Írj nekünk: <a href="mailto:${escapeHtml(footer.supportAddress)}" style="${linkStyle}">${escapeHtml(footer.supportAddress)}</a></p>`,
    );
  }

  if (footer.links.length > 0) {
    parts.push(
      `<p style="${style}">${footer.links
        .map(
          (link) =>
            `<a href="${escapeHtml(link.url)}" style="${linkStyle}">${escapeHtml(link.label)}</a>`,
        )
        .join(" &nbsp;·&nbsp; ")}</p>`,
    );
  }

  parts.push(`<p style="${style}">${escapeHtml(name)} · ${PORTAL_NAME}</p>`);

  return `<tr><td style="padding:24px 0 0;border-top:1px solid ${COLORS.border};">${parts.join("")}</td></tr>`;
}

/** Wraps a message body in the shared layout, as a complete HTML document. */
export function renderEmailLayout(input: {
  bodyHtml: string;
  branding: Branding;
  footer: EmailFooterContent;
  logoSource: string | null;
  preheader?: string;
}): string {
  const accent = accentColor(input.branding);
  const body = styleBody(input.bodyHtml).replace(/\{\{accent\}\}/g, accent);
  const preheader = input.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(input.preheader)}</div>`
    : "";

  return [
    "<!DOCTYPE html>",
    '<html lang="hu">',
    "<head>",
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width,initial-scale=1" />',
    '<meta name="color-scheme" content="light" />',
    '<meta name="supported-color-schemes" content="light" />',
    "</head>",
    `<body style="margin:0;padding:0;background:${COLORS.card};">`,
    preheader,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.card};">`,
    '<tr><td align="center" style="padding:32px 20px;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">',
    buildHeader(input.branding, input.logoSource),
    `<tr><td style="padding:0 0 16px;">${body}</td></tr>`,
    buildFooter(input.branding, input.footer),
    "</table>",
    "</td></tr>",
    "</table>",
    "</body>",
    "</html>",
  ].join("");
}
