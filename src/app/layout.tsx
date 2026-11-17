import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-ui",
  weight: ["400", "500", "600", "700", "800"],
});

// The icon comes from app/icon.png and app/apple-icon.png.
export const metadata: Metadata = {
  title: "Elektronikus szerződés aláíró portál",
  description: "Szerződések elektronikus aláírása.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hu">
      <body className={`${plusJakartaSans.variable} antialiased`}>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
