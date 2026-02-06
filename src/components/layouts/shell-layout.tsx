"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/sidebar";
import RightPanel from "@/components/right-panel";
import ThemeToggle from "@/components/ui/theme-toggle";

interface ShellLayoutProps {
  children: React.ReactNode;
}

export default function ShellLayout({ children }: ShellLayoutProps) {
  const [leftWidth, setLeftWidth] = useState(240);
  const [rightWidth, setRightWidth] = useState(300);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft) {
        const newWidth = Math.max(140, Math.min(500, e.clientX));
        setLeftWidth(newWidth);
      }
      if (isResizingRight) {
        const newWidth = Math.max(260, Math.min(800, window.innerWidth - e.clientX));
        setRightWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      setIsResizingRight(false);
    };

    if (isResizingLeft || isResizingRight) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
    } else {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isResizingLeft, isResizingRight]);

  return (
    <div className="flex min-h-screen bg-slate-50 overflow-hidden" data-shell="admin">
      {/* Sidebar with resize handle and toggle */}
      <div
        style={{ width: leftOpen ? leftWidth : 0 }}
        className={`relative flex-shrink-0 transition-all duration-300 ${!leftOpen ? 'invisible overflow-hidden' : ''}`}
      >
        <div className="h-full flex flex-col relative">
          <Sidebar innerStyle={{ width: leftWidth }} />
          <button
            onClick={() => setLeftOpen(false)}
            className="absolute top-6 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all z-50"
            title="Cerrar panel"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7" /></svg>
          </button>
        </div>

        {leftOpen && (
          <div
            onMouseDown={() => setIsResizingLeft(true)}
            className={`absolute -right-0.5 top-0 w-1.5 h-full cursor-col-resize z-30 transition-colors group ${isResizingLeft ? 'bg-sky-500' : 'hover:bg-sky-300'}`}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-1 h-1 bg-sky-500 rounded-full" />
              <div className="w-1 h-1 bg-sky-500 rounded-full" />
              <div className="w-1 h-1 bg-sky-500 rounded-full" />
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden relative">
        {/* Open toggles */}
        {!leftOpen && (
          <button
            onClick={() => setLeftOpen(true)}
            className="absolute top-20 left-6 w-10 h-10 bg-white border border-slate-200 rounded-xl shadow-lg flex items-center justify-center text-slate-500 hover:text-sky-500 transition-all z-40"
            title="Abrir menú"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        )}

        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur" role="banner">
          <div className="mx-auto max-w-full px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 rounded-md bg-sky-500 shadow-sm" />
              <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">Centro de mando</div>
            </div>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6" role="main" aria-label="Contenido principal">
          <div className="mx-auto max-w-full">{children}</div>
        </main>

        {!rightOpen && (
          <button
            onClick={() => setRightOpen(true)}
            className="absolute top-20 right-6 w-10 h-10 bg-white border border-slate-200 rounded-xl shadow-lg flex items-center justify-center text-slate-500 hover:text-sky-500 transition-all z-40"
            title="Abrir utilidades"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
          </button>
        )}
      </div>

      {/* Right Panel with resize handle and toggle */}
      <div
        style={{ width: rightOpen ? rightWidth : 0 }}
        className={`relative flex-shrink-0 transition-all duration-300 ${!rightOpen ? 'invisible overflow-hidden' : 'border-l border-slate-200 bg-white'}`}
        role="complementary"
        aria-label="Panel derecho"
      >
        {rightOpen && (
          <>
            <div
              onMouseDown={() => setIsResizingRight(true)}
              className={`absolute -left-0.5 top-0 w-1.5 h-full cursor-col-resize z-30 transition-colors group ${isResizingRight ? 'bg-sky-500' : 'hover:bg-sky-300'}`}
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-1 h-1 bg-sky-500 rounded-full" />
                <div className="w-1 h-1 bg-sky-500 rounded-full" />
                <div className="w-1 h-1 bg-sky-500 rounded-full" />
              </div>
            </div>
            <div className="h-full flex flex-col overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Utilidades</span>
                <button
                  onClick={() => setRightOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-all"
                  title="Cerrar utilidades"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <RightPanel />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
