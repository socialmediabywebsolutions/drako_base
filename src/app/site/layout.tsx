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
      {children}
    </SiteProviders>
  );
}
