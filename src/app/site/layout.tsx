import type { Metadata } from "next";
import SiteProviders from "./SiteProviders";

export const metadata: Metadata = {
  title: "DRĀKO Systems — Lo difícil lo hacemos fácil",
  description:
    "Analizamos tu negocio, detectamos oportunidades y activamos agentes de IA que trabajan por ti.",
};

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SiteProviders>
      <div className="relative min-h-screen bg-[var(--background)] text-[var(--foreground)]" data-shell="public">
        <div className="relative z-10 flex min-h-screen flex-col">{children}</div>
      </div>
    </SiteProviders>
  );
}
