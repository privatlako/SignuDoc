import { ChevronLeft, ChevronRight } from "lucide-react";

export type ShellNavItem = {
  href: string;
  label: string;
};

export const primaryNavItems: ShellNavItem[] = [
  { href: "/dashboard", label: "Szerződések" },
  { href: "/templates", label: "Sablonok" },
  { href: "/envelopes/new", label: "Új szerződés" },
  { href: "/settings", label: "Beállítások" },
];

export const ChevronLeftIcon = ChevronLeft;

export const ChevronRightIcon = ChevronRight;
