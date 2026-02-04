import React from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import ShellLayout from "@/components/layouts/shell-layout";
import HostSwitcher from "@/components/dev/HostSwitcher";
import { Providers } from "./providers";
import "./globals.css";
// export const runtime = "edge"; // DISABLED: OpenNext doesn't support edge runtime on pages, only API routes

export const metadata: Metadata = {
  title: "DRĀKO.SYSTEMS",
  description: "Núcleo administrativo central para gestionar tu ecosistema de SaaS",
};

const AdminShell = ({ children }: { children: React.ReactNode }) => <ShellLayout>{children}</ShellLayout>;

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[#03050b] text-white" data-shell="public">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(76,201,240,0.25),_transparent_60%)]" />
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

  // Public routes that should NEVER show the admin sidebar
  const isPublicRoute =
    matchedPath.startsWith("/site") ||
    matchedPath.startsWith("/auth") ||
    referer.includes("/site/") ||
    referer.includes("/auth/");

  const usePublicShell = hostMode === "PUBLIC_SAAS" || hostMode === "PREVIEW" || isPublicRoute;

  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body className="antialiased bg-[var(--background)] text-[var(--foreground)]">
        <Providers>
          {usePublicShell ? <PublicShell>{children}</PublicShell> : <AdminShell>{children}</AdminShell>}
          <HostSwitcher />
        </Providers>
      </body>
    </html>
  );
}
