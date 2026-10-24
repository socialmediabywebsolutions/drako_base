"use client";

import { useEffect, useRef, useState } from "react";

// Número de las stats del hero: cuenta de 0 al objetivo (ease-out, 1.1s) cuando entra
// en pantalla, una sola vez. El sufijo aparece al final. El HTML del servidor ya trae el
// valor final, así sin JS (o con reduced motion) se ve la cifra correcta.

const DURATION_MS = 1100;

export function StatCounter({ value, prefix = "", suffix = "", className }: { value: number; prefix?: string; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [text, setText] = useState(`${prefix}${value}${suffix}`);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    setText(`${prefix}0`);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const t0 = performance.now();
        const tick = (now: number) => {
          const p = Math.min((now - t0) / DURATION_MS, 1);
          const current = Math.round((1 - Math.pow(1 - p, 3)) * value);
          setText(`${prefix}${current}${p > 0.92 ? suffix : ""}`);
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, prefix, suffix]);

  return (
    <span ref={ref} className={className}>
      {text}
    </span>
  );
}
