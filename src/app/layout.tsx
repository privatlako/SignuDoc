import type { Metadata } from "next";
import { Montserrat } from "next/font/google";

import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

// latin-ext carries ő and ű.
const montserrat = Montserrat({
  display: "swap",
  subsets: ["latin", "latin-ext"],
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
      <body className={`${montserrat.variable} antialiased`}>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
