import React from "react";
import { clsx } from "clsx";
import type { PropsWithChildren, ReactNode } from "react";

type CardTone = "default" | "brand" | "glass" | "danger" | "success";

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
  default: "bg-white border-2 border-sky-100 shadow-md hover:shadow-lg transition-shadow rounded-3xl",
  brand: "bg-sky-50 border-2 border-sky-300 shadow-lg rounded-3xl",
  glass: "bg-white/90 backdrop-blur-xl border-2 border-sky-200 shadow-xl rounded-3xl relative overflow-hidden group/card",
  danger: "bg-red-50 border-2 border-red-200 shadow-lg rounded-3xl",
  success: "bg-green-50 border-2 border-green-200 shadow-lg rounded-3xl",
};

const actionToneClass: Record<CardTone, string> = {
  default: "border-t-2 border-sky-100",
  brand: "border-t-2 border-sky-300",
  glass: "border-t-2 border-sky-200 bg-sky-50/50",
  danger: "border-t-2 border-red-200",
  success: "border-t-2 border-green-200",
};

export default function Card({ title, subtitle, right, icon, actions, children, className, bodyClassName, tone = "default" }: CardProps) {
  const showHeader = title || subtitle || right || icon;
  const showActions = actions;

  return (
    <section className={clsx(toneClass[tone], "transition-all duration-500", className)}>
      {tone === "glass" && (
        <>
          {/* Decorative Brackets */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-sky-300 rounded-tl-2xl pointer-events-none group-hover/card:border-sky-500 transition-colors" />
          <div className="absolute bottom-4 right-4 opacity-5 font-black italic select-none text-2xl text-slate-300 pointer-events-none">MOD-ALPHA</div>
          <div className="absolute -right-20 -top-20 w-40 h-40 bg-sky-200/20 blur-[80px] rounded-full group-hover/card:bg-sky-300/30 transition-all duration-700" />
        </>
      )}

      {showHeader && (
        <header className={clsx(
          "flex flex-wrap items-start justify-between gap-4 px-8 py-6",
          tone === "glass" ? "border-b-2 border-sky-200" : "border-b-2 border-sky-100"
        )}>
          <div className="space-y-3">
            {icon && (
              <span className={clsx(
                "inline-flex h-12 w-12 items-center justify-center rounded-xl text-xl transition-transform group-hover/card:scale-110 shadow-lg",
                tone === "glass" ? "bg-sky-100 border-2 border-sky-300 text-sky-700" : "bg-sky-50 text-sky-600 border-2 border-sky-200"
              )}>
                {icon}
              </span>
            )}
            <div>
              {title && <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight italic">{title}</h2>}
              {subtitle && <p className="text-[10px] text-sky-600 font-black uppercase tracking-[0.2em] mt-1">{subtitle}</p>}
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
