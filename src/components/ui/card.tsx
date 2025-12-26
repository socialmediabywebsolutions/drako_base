import { clsx } from "clsx";
import type { PropsWithChildren, ReactNode } from "react";

type CardTone = "default" | "brand" | "glass";

type CardProps = PropsWithChildren<{
  title?: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  tone?: CardTone;
}>;

const toneClass: Record<CardTone, string> = {
  default: "card",
  brand: "card bg-[var(--brand-quiet)]/80 border border-[var(--brand)]/30",
  glass: "glass-panel",
};

const actionToneClass: Record<CardTone, string> = {
  default: "border-t border-[var(--border)]/70",
  brand: "border-t border-[var(--brand)]/50",
  glass: "border-t border-white/30 bg-white/5",
};

export default function Card({ title, subtitle, right, icon, actions, children, className, bodyClassName, tone = "default" }: CardProps) {
  const showHeader = title || subtitle || right || icon;
  const showActions = actions;

  return (
    <section className={clsx(toneClass[tone], "group transition", className)}>
      {showHeader && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)]/70 px-5 py-4">
          <div className="space-y-1">
            {icon && (
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--background-alt)] text-[var(--brand)] shadow-inner shadow-white/40">
                {icon}
              </span>
            )}
            {title && <h2 className="text-base font-semibold text-[var(--foreground)]">{title}</h2>}
            {subtitle && <p className="text-sm text-[var(--muted)]">{subtitle}</p>}
          </div>
          {right && <div className="flex items-center gap-2 text-sm text-[var(--muted)]">{right}</div>}
        </header>
      )}
      <div className={clsx("p-5", bodyClassName)}>{children}</div>
      {showActions && (
        <div className={clsx("flex flex-wrap items-center justify-end gap-2 p-5", actionToneClass[tone])}>{actions}</div>
      )}
    </section>
  );
}
