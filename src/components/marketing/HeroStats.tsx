"use client";

import { useEffect, useRef, useState } from "react";

// Stats del hero de drako.systems: count-up cuando entran en pantalla (una sola vez).
// "∞" no se cuenta, aparece con un fundido.

type Stat = { value: number | null; display?: string; label: string };

const STATS: Stat[] = [
  { value: 5, label: "SaaS activos" },
  { value: 26, label: "agentes IA" },
  { value: null, display: "∞", label: "automatizaciones" },
];

const DURATION_MS = 1400;

function useCountUp(target: number, start: boolean): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let frame = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / DURATION_MS);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, start]);
  return value;
}

function StatItem({ stat, visible }: { stat: Stat; visible: boolean }) {
  const counted = useCountUp(stat.value ?? 0, visible && stat.value !== null);
  return (
    <div className="text-center">
      <p
        className={`text-4xl font-bold text-[#3b82f6] tabular-nums transition-opacity duration-700 ${
          stat.value === null && !visible ? "opacity-0" : "opacity-100"
        }`}
      >
        {stat.value === null ? stat.display : counted}
      </p>
      <p className="mt-1 text-sm text-slate-500">{stat.label}</p>
    </div>
  );
}

export function HeroStats() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="mx-auto mb-12 flex max-w-xl items-start justify-center gap-10 sm:gap-16">
      {STATS.map((stat) => (
        <StatItem key={stat.label} stat={stat} visible={visible} />
      ))}
    </div>
  );
}
