export const PUBLIC_COPYRIGHT_YEAR = 2026;

export const publicLegalLinks = [
  {
    href: "/terms",
    longLabel: "Felhasználási feltételek",
    shortLabel: "Feltételek",
  },
  {
    href: "/privacy",
    longLabel: "Adatvédelmi tájékoztató",
    shortLabel: "Adatvédelem",
  },
  {
    href: "/contact",
    longLabel: "Kapcsolat",
    shortLabel: "Kapcsolat",
  },
] as const;

export const publicFooterLinks = [
  publicLegalLinks[0],
  publicLegalLinks[1],
  {
    href: "/accessibility",
    longLabel: "Akadálymentességi nyilatkozat",
    shortLabel: "Akadálymentesség",
  },
  publicLegalLinks[2],
] as const;
