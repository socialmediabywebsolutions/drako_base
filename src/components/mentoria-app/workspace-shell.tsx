"use client";

import type { ReactNode } from "react";

type WorkspaceShellProps = {
  leftNav: ReactNode;
  centerBoard: ReactNode;
  rightCopilot: ReactNode;
};

export function WorkspaceShell({ leftNav, centerBoard, rightCopilot }: WorkspaceShellProps) {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto grid h-screen max-w-[1920px] grid-cols-[252px_minmax(0,1fr)_minmax(390px,440px)] gap-0">
        <aside className="overflow-y-auto border-r border-slate-200 bg-white">
          {leftNav}
        </aside>
        <main className="overflow-y-auto bg-slate-50">
          {centerBoard}
        </main>
        <aside className="overflow-y-auto border-l border-slate-200 bg-white">
          {rightCopilot}
        </aside>
      </div>
    </div>
  );
}
