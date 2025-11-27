"use client";
import { useCallback, useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("drako.theme");
    if (stored) return stored === "dark";
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark;
  });

  const apply = useCallback((enabled: boolean) => {
    const html = document.documentElement;
    if (enabled) html.classList.add("dark");
    else html.classList.remove("dark");
    localStorage.setItem("drako.theme", enabled ? "dark" : "light");
  }, []);

  useEffect(() => {
    apply(dark);
  }, [apply, dark]);

  return (
    <button
      aria-label="Alternar tema"
      className="relative inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--border)_75%,transparent)] bg-[var(--panel)]/80 px-3 py-1.5 text-xs font-semibold text-[var(--muted)] transition hover:text-[var(--foreground)] hover:-translate-y-0.5"
      onClick={() => {
        const next = !dark;
        setDark(next);
        apply(next);
      }}
    >
      <span className="absolute inset-0 rounded-full bg-[var(--brand-quiet)]/70 opacity-0 transition" aria-hidden />
      <span className="relative inline-flex items-center gap-2">
        {dark ? (
          <>
            <SunIcon />
            Claro
          </>
        ) : (
          <>
            <MoonIcon />
            Oscuro
          </>
        )}
      </span>
    </button>
  );
}

function SunIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}
