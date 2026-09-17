"use client";

import { useEffect, useState } from "react";

const PURPLE = "#6c47ff";
const RADIUS = 90;
const ARC_LENGTH = Math.PI * RADIUS;

function scoreTextColor(score: number): string {
  if (score >= 70) return "text-emerald-400";
  if (score >= 40) return "text-amber-400";
  return "text-rose-400";
}

export default function AuditScoreGauge({ score }: { score: number }) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const clamped = Math.max(0, Math.min(100, score));
  const offset = animated ? ARC_LENGTH * (1 - clamped / 100) : ARC_LENGTH;

  return (
    <div className="relative mx-auto w-full max-w-[280px]">
      <svg viewBox="0 0 200 110" className="w-full" aria-hidden="true">
        <path
          d="M10 100 A90 90 0 0 1 190 100"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="14"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M10 100 A90 90 0 0 1 190 100"
          stroke={PURPLE}
          strokeWidth="14"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={ARC_LENGTH}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.3s cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
        <div className={`text-5xl font-black ${scoreTextColor(clamped)}`}>{clamped}</div>
        <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.24em] text-white/35">Score global</div>
      </div>
    </div>
  );
}
