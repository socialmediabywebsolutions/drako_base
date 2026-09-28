import React from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter, Space_Mono } from "next/font/google";
import { defaultMarketingLocale, resolveLocaleFromRequest } from "@/lib/i18n/marketing";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DRAKO Systems — La IA que domina tu negocio digital",
  description: "Holding de inteligencia artificial especializada. 26+ agentes autónomos, 3 SaaS activos, automatización 24/7 para negocios digitales.",
  alternates: {
    languages: {
      es: "/",
      "x-default": "/",
    },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const matchedPath =
    headersList.get("x-matched-path") ||
    headersList.get("x-invoke-path") ||
    headersList.get("next-url") ||
    "/";
  const { locale: localeFromPath } = resolveLocaleFromRequest(matchedPath || "/", null);
  const htmlLang = localeFromPath || defaultMarketingLocale;

  return (
    <html lang={htmlLang} className={`light ${inter.variable} ${spaceMono.variable}`} suppressHydrationWarning>
      <body className="antialiased bg-white text-slate-900">{children}</body>
    </html>
  );
}
