import React from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { defaultMarketingLocale, resolveLocaleFromRequest } from "@/lib/i18n/marketing";
import "./globals.css";

export const metadata: Metadata = {
  title: "DRĀKO.SYSTEMS — Lo difícil lo hacemos fácil",
  description: "Transformamos tu negocio con inteligencia artificial especializada.",
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
    <html lang={htmlLang} className="light" suppressHydrationWarning>
      <body className="antialiased bg-white text-slate-900">{children}</body>
    </html>
  );
}
