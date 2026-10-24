import React from "react";
import type { Metadata } from "next";
import "./globals.css";

// Paridad con el monolito: su layout raíz llamaba a headers(), lo que hacía dinámicas todas
// las páginas (render por petición). Sin esto Next prerenderiza en el build páginas como
// /socialflow/auth o /socialflows, que entonces salen sin contenido de servidor o con datos
// congelados en el momento del build.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Socialcors",
  description: "Tu equipo de marketing en redes sociales con inteligencia artificial.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="light" suppressHydrationWarning>
      <body className="antialiased bg-white text-slate-900">{children}</body>
    </html>
  );
}
