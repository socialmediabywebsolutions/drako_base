import type { ReactNode } from "react";
import Sidebar from "@/components/sidebar";
import RightPanel from "@/components/right-panel";
import ThemeToggle from "@/components/ui/theme-toggle";

interface ShellLayoutProps {
  children: ReactNode;
}

export default function ShellLayout({ children }: ShellLayoutProps) {
  return (
    <div className="flex min-h-screen" data-shell="admin">
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
  );
}
