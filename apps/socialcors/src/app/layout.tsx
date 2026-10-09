import React from "react";
import type { Metadata } from "next";
import "./globals.css";

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
