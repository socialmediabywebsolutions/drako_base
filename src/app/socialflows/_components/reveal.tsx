"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Entrada al hacer scroll: fade + slide-up de 14px, una sola vez. Sin JS, con
// prefers-reduced-motion o si el bloque ya está a la vista al hidratar, no se oculta nunca
// (evita parpadeos y contenido invisible). Añade .sc-in para las barras .sc-grow-view.
export default function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !("IntersectionObserver" in window)) {
      el.classList.add("sc-in");
      return;
    }
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) {
      el.classList.add("sc-in");
      return;
    }

    el.classList.add("sc-pre");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.remove("sc-pre");
          el.classList.add("sc-in");
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`sc-reveal sc-onview ${className}`}
      style={delay ? { transitionDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}
