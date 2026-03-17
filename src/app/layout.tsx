import React from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import ShellLayout from "@/components/layouts/shell-layout";
import HostSwitcher from "@/components/dev/HostSwitcher";
import { Providers } from "./providers";
import { shouldEnableNextAuthClient } from "@/lib/platform/surfaces";
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

const AdminShell = ({ children }: { children: React.ReactNode }) => <ShellLayout>{children}</ShellLayout>;

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-white text-slate-900" data-shell="public">
      <div className="relative z-10 flex min-h-screen flex-col">{children}</div>
    </div>
  );
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const hostMode = headersList.get("x-drako-host-mode") ?? "";

  // En local, x-invoke-path o referer pueden ayudar si x-matched-path falla
  const matchedPath =
    headersList.get("x-matched-path") ||
    headersList.get("x-invoke-path") ||
    headersList.get("next-url") ||
    "";

  const referer = headersList.get("referer") || "";
  let refererPath = "";
  try {
    refererPath = referer ? new URL(referer).pathname : "";
  } catch {
    refererPath = "";
  }

  const { locale: localeFromPath, pathWithoutLocale: normalizedPath } = resolveLocaleFromRequest(matchedPath || "/", null);
  const { pathWithoutLocale: normalizedRefererPath } = resolveLocaleFromRequest(refererPath || "", null);

  // Public routes that should NEVER show the admin sidebar
  const publicPrefixes = [
    "/site",
    "/auth",
    "/system",
    "/products",
    "/journal",
    "/vision",
    "/about",
    "/contact",
    "/",
    "",
  ];

  const isHomeRoute = normalizedPath === "/" || normalizedPath === "";
  const isPublicRoute =
    isHomeRoute ||
    publicPrefixes.some((prefix) => normalizedPath.startsWith(prefix) || normalizedRefererPath.startsWith(prefix)) ||
    referer.includes("/site/") ||
    referer.includes("/auth/");

  const usePublicShell = hostMode === "PUBLIC_SAAS" || hostMode === "PREVIEW" || isPublicRoute;
  const enableNextAuth = shouldEnableNextAuthClient(matchedPath || normalizedRefererPath || "/");

  const htmlLang = localeFromPath || defaultMarketingLocale;

  return (
    <html lang={htmlLang} className="light" suppressHydrationWarning>
      <body className="antialiased bg-white text-slate-900">
        <Providers enableNextAuth={enableNextAuth}>
          {usePublicShell ? <PublicShell>{children}</PublicShell> : <AdminShell>{children}</AdminShell>}
          <HostSwitcher />
        </Providers>
      </body>
    </html>
  );
}
