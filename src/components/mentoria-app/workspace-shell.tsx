"use client";

import type { ReactNode } from "react";

type WorkspaceShellProps = {
  leftNav: ReactNode;
  centerBoard: ReactNode;
  rightCopilot: ReactNode;
  copilotMode?: "floating" | "rail";
  copilotLabel?: string;
};

export function WorkspaceShell({
  leftNav: _leftNav,
  centerBoard,
  rightCopilot,
  copilotMode: _copilotMode = "floating",
  copilotLabel: _copilotLabel = "Tutor",
}: WorkspaceShellProps) {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto grid min-h-screen max-w-[1880px] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(360px,430px)]">
        <main className="min-h-0 bg-slate-50">
          {centerBoard}
        </main>
        <aside className="min-h-0 border-l border-slate-200 bg-white">
          {rightCopilot}
        </aside>
      </div>
    </div>
  );
}
