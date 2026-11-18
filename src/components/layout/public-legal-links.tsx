"use client";

import { LockKeyhole, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { useBranding } from "@/components/layout/branding-provider";
import { PUBLIC_COPYRIGHT_YEAR, publicFooterLinks } from "@/lib/legal";
import { cn } from "@/lib/cn";

type PublicLegalFooterProps = {
  className?: string;
  contentClassName?: string;
  labelVariant?: "long" | "short";
  linkClassName?: string;
};

type FooterLink = {
  external: boolean;
  href: string;
  label: string;
};

export function PublicLegalFooter({
  className = "",
  contentClassName = "",
  labelVariant = "short",
  linkClassName,
}: PublicLegalFooterProps) {
  const branding = useBranding();
  const resolvedLinkClassName =
    linkClassName ??
    "text-[0.8125rem] font-medium text-(--tertiary) transition-colors hover:text-(--accent-ink)";
  // The hosted service links to its own pages. Any other install links to
  // whatever terms and privacy policy its organization has published.
  const links: FooterLink[] = branding.hosted
    ? publicFooterLinks.map((link) => ({
        external: false,
        href: link.href,
        label: labelVariant === "long" ? link.longLabel : link.shortLabel,
      }))
    : [
        ...(branding.termsUrl
          ? [
              {
                external: true,
                href: branding.termsUrl,
                label:
                  labelVariant === "long"
                    ? "Felhasználási feltételek"
                    : "Feltételek",
              },
            ]
          : []),
        // Without the organization's own policy, signers still get a
        // notice, built from the install's settings.
        branding.privacyUrl
          ? {
              external: true,
              href: branding.privacyUrl,
              label:
                labelVariant === "long"
                  ? "Adatvédelmi tájékoztató"
                  : "Adatvédelem",
            }
          : {
              external: false,
              href: "/signer-privacy",
              label:
                labelVariant === "long"
                  ? "Adatkezelési tájékoztató"
                  : "Adatvédelem",
            },
      ];

  return (
    <footer className={cn("relative z-10", className)}>
      <div className={cn("page-width py-7", contentClassName)}>
        {/* One row on wide screens: the name on the left, the reassurance in
            the middle, the links on the right, all on one line. Stacked and
            centred on phones. */}
        <div className="flex flex-col items-center gap-3 text-center text-[0.8125rem] text-(--tertiary) lg:grid lg:grid-cols-[1fr_auto_1fr] lg:gap-6 lg:text-left">
          <p className="lg:justify-self-start">
            © {PUBLIC_COPYRIGHT_YEAR} {branding.productName}
          </p>

          {/* Reassurance for signers: the site is only served over HTTPS,
              and finished documents carry an electronic seal. */}
          <ul
            aria-label="Biztonság"
            className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5"
          >
            <li className="inline-flex items-center gap-1.5">
              <LockKeyhole
                aria-hidden="true"
                className="size-3.5 shrink-0 text-(--success)"
                strokeWidth={2.2}
              />
              Biztonságos, titkosított kapcsolat (SSL)
            </li>
            <li className="inline-flex items-center gap-1.5">
              <ShieldCheck
                aria-hidden="true"
                className="size-3.5 shrink-0 text-(--success)"
                strokeWidth={2.2}
              />
              Elektronikusan hitelesített dokumentumok
            </li>
          </ul>

          {links.length > 0 ? (
            <nav
              aria-label="Lábléc"
              className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 lg:justify-self-end"
            >
              {links.map((link) =>
                link.external ? (
                  <a
                    className={resolvedLinkClassName}
                    href={link.href}
                    key={link.href}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    className={resolvedLinkClassName}
                    href={link.href}
                    key={link.href}
                  >
                    {link.label}
                  </Link>
                ),
              )}
            </nav>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
