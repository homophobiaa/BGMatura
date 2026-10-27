import type { Metadata } from "next";
import { Inter, Literata } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-inter",
});

const literata = Literata({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-literata",
});

export const metadata: Metadata = {
  title: "BG Matura — подготовка за ДЗИ по БЕЛ",
  description:
    "Платформа в разработка за подготовка по български език и литература.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="bg" className={`${inter.variable} ${literata.variable}`}>
      <body>{children}</body>
    </html>
  );
}
