"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { MessageCircle, Minus, X } from "lucide-react";

type WorkspaceShellProps = {
  leftNav: ReactNode;
  centerBoard: ReactNode;
  rightCopilot: ReactNode;
  copilotMode?: "floating" | "rail";
  copilotLabel?: string;
};

export function WorkspaceShell({
  leftNav,
  centerBoard,
  rightCopilot,
  copilotMode = "floating",
  copilotLabel = "Tutor",
}: WorkspaceShellProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);

  if (copilotMode === "rail") {
    return (
      <div className="min-h-screen bg-slate-100">
        <div className="mx-auto grid min-h-screen max-w-[1880px] grid-cols-[240px_minmax(0,1fr)_minmax(340px,400px)]">
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

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1880px]">
        <aside className="hidden w-[232px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white lg:block">
          {leftNav}
        </aside>
        <aside className="w-[88px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white lg:hidden">
          {leftNav}
        </aside>

        <main className="relative min-w-0 flex-1 bg-slate-50">
          {centerBoard}
        </main>
      </div>

      {isOpen && !isMinimized ? (
        <div className="fixed bottom-4 right-4 z-40 w-[calc(100vw-1rem)] max-w-[390px] sm:bottom-5 sm:right-5 sm:w-[380px]">
          <div className="pointer-events-auto flex h-[min(620px,72vh)] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">{copilotLabel}</div>
                  <div className="truncate text-xs text-slate-500">Escribe y seguimos paso a paso</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMinimized(true)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                  aria-label={`Minimizar ${copilotLabel.toLowerCase()}`}
                >
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMinimized(false);
                    setIsOpen(false);
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                  aria-label={`Cerrar ${copilotLabel.toLowerCase()}`}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              {rightCopilot}
            </div>
          </div>
        </div>
      ) : null}

      {isOpen && isMinimized ? (
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-900 shadow-[0_16px_40px_rgba(15,23,42,0.18)] transition hover:bg-slate-50"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="flex flex-col">
            <span>{copilotLabel}</span>
            <span className="text-xs font-normal text-slate-500">Abrir conversación</span>
          </span>
        </button>
      ) : null}

      {!isOpen ? (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(15,23,42,0.22)] transition hover:bg-black"
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          {copilotLabel}
        </button>
      ) : null}
    </div>
  );
}
