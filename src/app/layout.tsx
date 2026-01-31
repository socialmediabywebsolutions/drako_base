import type { Metadata } from "next";
import { headers } from "next/headers";
import ShellLayout from "@/components/layouts/shell-layout";
import HostSwitcher from "@/components/dev/HostSwitcher";
import "./globals.css";
export const runtime = "edge";

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
  const matchedPath =
    headersList.get("x-matched-path") || headersList.get("x-invoke-path") || headersList.get("next-url") || "";
  const isSiteRoute = matchedPath.startsWith("/site");
  const usePublicShell = hostMode === "PUBLIC_SAAS" || hostMode === "PREVIEW" || isSiteRoute;

  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body className="antialiased bg-[var(--background)] text-[var(--foreground)]">
        {usePublicShell ? <PublicShell>{children}</PublicShell> : <AdminShell>{children}</AdminShell>}
        <HostSwitcher />
      </body>
    </html>
  );
}
