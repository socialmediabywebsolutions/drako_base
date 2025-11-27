import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/sidebar";
import RightPanel from "@/components/right-panel";
import ThemeToggle from "@/components/ui/theme-toggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DRĀKO.SYSTEMS",
  description: "Núcleo administrativo central para gestionar tu ecosistema de SaaS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="light">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[var(--background)] text-[var(--foreground)]`}>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 min-w-0 flex flex-col bg-gradient-to-b from-[var(--background)] to-transparent">
            <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--panel)]/80 backdrop-blur" role="banner">
              <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-md bg-[var(--brand)]" />
                  <div className="text-sm text-[var(--muted)]">Centro de mando</div>
                </div>
                <ThemeToggle />
              </div>
            </header>
            <main className="flex-1 overflow-y-auto p-6 bg-[var(--background)]/90" role="main" aria-label="Contenido principal">
              <div className="mx-auto max-w-6xl">{children}</div>
            </main>
          </div>
          <div role="complementary" aria-label="Panel derecho">
            <RightPanel />
          </div>
        </div>
      </body>
    </html>
  );
}
