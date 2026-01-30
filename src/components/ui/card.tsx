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
  glass: "glass-panel-elite relative overflow-hidden group/card",
};

const actionToneClass: Record<CardTone, string> = {
  default: "border-t border-[var(--border)]/70",
  brand: "border-t border-[var(--brand)]/50",
  glass: "border-t border-white/10 bg-white/5",
};

export default function Card({ title, subtitle, right, icon, actions, children, className, bodyClassName, tone = "default" }: CardProps) {
  const showHeader = title || subtitle || right || icon;
  const showActions = actions;

  return (
    <section className={clsx(toneClass[tone], "transition-all duration-500", className)}>
      {tone === "glass" && (
        <>
          {/* Decorative Brackets */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-brand/20 rounded-tl-2xl pointer-events-none group-hover/card:border-brand/50 transition-colors" />
          <div className="absolute bottom-4 right-4 opacity-5 font-black italic select-none text-2xl text-white pointer-events-none">MOD-ALPHA</div>
          <div className="absolute -right-20 -top-20 w-40 h-40 bg-brand/5 blur-[80px] rounded-full group-hover/card:bg-brand/10 transition-all duration-700" />
        </>
      )}

      {showHeader && (
        <header className={clsx(
          "flex flex-wrap items-start justify-between gap-4 px-8 py-6",
          tone === "glass" ? "border-b border-white/10" : "border-b border-[var(--border)]/70"
        )}>
          <div className="space-y-3">
            {icon && (
              <span className={clsx(
                "inline-flex h-12 w-12 items-center justify-center rounded-xl text-xl transition-transform group-hover/card:scale-110 shadow-lg",
                tone === "glass" ? "bg-brand/10 border border-brand/30 text-brand shadow-brand/20" : "bg-[var(--background-alt)] text-[var(--brand)] shadow-inner shadow-white/40"
              )}>
                {icon}
              </span>
            )}
            <div>
              {title && <h2 className="text-lg font-black text-white uppercase tracking-tight italic">{title}</h2>}
              {subtitle && <p className="text-[10px] text-brand font-black uppercase tracking-[0.2em] mt-1 opacity-70">{subtitle}</p>}
            </div>
          </div>
          {right && <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">{right}</div>}
        </header>
      )}
      <div className={clsx("px-8 py-6", bodyClassName)}>{children}</div>
      {showActions && (
        <div className={clsx("flex flex-wrap items-center justify-end gap-3 px-8 py-6", actionToneClass[tone])}>{actions}</div>
      )}
    </section>
  );
}
