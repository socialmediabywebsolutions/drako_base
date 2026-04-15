"use client";

import type { ReactNode } from "react";

type WorkspaceShellProps = {
  leftNav: ReactNode;
  centerBoard: ReactNode;
  rightCopilot: ReactNode;
};

export function WorkspaceShell({ leftNav, centerBoard, rightCopilot }: WorkspaceShellProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="mx-auto grid h-screen max-w-[1920px] grid-cols-[280px_1fr_360px] gap-0">
        <aside className="border-r border-slate-200 bg-white overflow-y-auto">
          {leftNav}
        </aside>
        <main className="overflow-y-auto bg-slate-50">
          {centerBoard}
        </main>
        <aside className="border-l border-slate-200 bg-white overflow-y-auto">
          {rightCopilot}
        </aside>
      </div>
    </div>
  );
}
