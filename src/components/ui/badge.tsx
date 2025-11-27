import { clsx } from "clsx";
import type { PropsWithChildren } from "react";

type BadgeTone = "info" | "warn" | "err" | "ok" | "neutral";

const toneClass: Record<BadgeTone, string> = {
  info: "bg-[var(--brand-quiet)] text-[var(--brand)] border border-[var(--brand)]/30",
  warn: "bg-amber-100 text-amber-800 border border-amber-300/60",
  err: "bg-rose-100 text-rose-700 border border-rose-200",
  ok: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  neutral: "bg-[var(--panel-alt)] text-[var(--muted)] border border-[var(--border)]",
};

export default function Badge({ variant = "info", children, className }: PropsWithChildren<{ variant?: BadgeTone; className?: string }>) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide transition",
        toneClass[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
