import React from "react";

export type OpsPanelVariant = "base" | "elevated" | "flat";

const panelStyles: Record<OpsPanelVariant, string> = {
  base: "rounded-xl border border-[#dce3ee] bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)] hover:shadow-[0_14px_40px_rgba(15,23,42,0.07)] transition-all duration-200",
  elevated: "rounded-xl border border-[#cfd8ea] bg-white shadow-[0_25px_70px_rgba(15,23,42,0.08)] hover:shadow-[0_30px_90px_rgba(15,23,42,0.12)] transition-all duration-200",
  flat: "rounded-xl border border-transparent bg-transparent",
};

export const OpsPanel: React.FC<React.HTMLAttributes<HTMLDivElement> & { variant?: OpsPanelVariant }> = ({
  variant = "base",
  className = "",
  children,
  ...props
}) => (
  <div className={`${panelStyles[variant]} ${className}`} {...props}>
    {children}
  </div>
);

export type OpsState = "RUNNING" | "BUILD" | "RESEARCH";

const badgeColors: Record<OpsState, { border: string; bg: string; text: string; dot: string }> = {
  RUNNING: { border: "border-sky-200", bg: "bg-sky-50", text: "text-sky-700", dot: "bg-sky-400" },
  BUILD: { border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-400" },
  RESEARCH: { border: "border-indigo-200", bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-400" },
};

export const StatusBadge: React.FC<{ state: OpsState; label?: string; className?: string }> = ({ state, label, className = "" }) => {
  const c = badgeColors[state];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full ${c.border} ${c.bg} px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${c.text} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {label ?? state}
    </span>
  );
};

export const StateBlock: React.FC<{ state: OpsState; count: number; className?: string }> = ({ state, count, className = "" }) => {
  const c = badgeColors[state];
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${c.border} ${c.bg} ${className}`}>
      <span className="text-[11px] font-semibold uppercase text-slate-700">{state}</span>
      <span className="text-lg font-semibold text-slate-900">{count}</span>
    </div>
  );
};

export const ProductList: React.FC<{ items: { name: string; desc: string; state: OpsState }[] }> = ({ items }) => (
  <div className="mt-3 divide-y divide-[#e3e9f3] text-sm text-slate-800">
    {items.length === 0 ? (
      <div className="py-3 text-slate-500">Sin servicios públicos</div>
    ) : (
      items.map((item) => (
        <div
          key={`${item.state}-${item.name}`}
          className="relative flex items-center gap-3 py-2.5 pl-3 pr-2 rounded-lg hover:border hover:border-sky-100 hover:bg-sky-50/60 transition-colors"
        >
          <span className={`absolute left-0 top-0 h-full w-[3px] rounded ${badgeColors[item.state].dot}`} />
          <StatusBadge state={item.state} />
          <div className="flex flex-1 items-baseline justify-between gap-2">
            <span className="font-semibold text-slate-900">{item.name}</span>
            <span className="text-slate-500 text-xs line-clamp-1">{item.desc}</span>
          </div>
        </div>
      ))
    )}
  </div>
);

export const LogList: React.FC<{ lines: string[]; highlightFirst?: boolean }> = ({ lines, highlightFirst = true }) => (
  <div className="mt-2 space-y-1.5 text-[12px] font-medium text-slate-700 font-mono">
    {lines.map((line, idx) => (
      <div key={`${line}-${idx}`} className="flex items-start gap-2 rounded-md px-1 py-0.5 hover:bg-slate-100">
        <span className={`h-1.5 w-1.5 rounded-full ${idx === 0 && highlightFirst ? "bg-sky-400" : "bg-slate-300"} mt-1`} />
        <span className={`${idx === 0 && highlightFirst ? "text-slate-900" : "text-slate-700"}`}>{line}</span>
      </div>
    ))}
  </div>
);

export const HeroModule: React.FC<{
  title: string;
  subtitle: string;
  tags: string[];
  ctaHref: string;
  ctaLabel?: string;
}> = ({ title, subtitle, tags, ctaHref, ctaLabel = "Learn more" }) => (
  <OpsPanel variant="elevated" className="relative overflow-hidden p-6 sm:p-7 bg-gradient-to-br from-white via-white to-sky-50/60">
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      <div className="absolute inset-y-6 left-3 w-[2px] bg-sky-200" />
      <div className="absolute right-[-25%] top-[-25%] h-[60%] w-[60%] rounded-full bg-sky-200/40 blur-3xl" />
    </div>
    <div className="relative flex items-center gap-2 text-sm text-slate-500">
      <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
      <StatusBadge state="RUNNING" />
      <span className="text-slate-500">{subtitle}</span>
    </div>
    <div className="relative mt-4 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <div className="mt-4 flex flex-wrap gap-2 text-[12px] text-slate-600">
          {tags.slice(0, 4).map((tag) => (
            <span key={tag} className="rounded-full border border-slate-200 bg-white/80 px-3 py-1">
              {tag}
            </span>
          ))}
        </div>
      </div>
      <a
        href={ctaHref}
        className="h-10 rounded-full border border-sky-200 bg-sky-500 px-4 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(56,189,248,0.35)] transition hover:bg-sky-600"
      >
        {ctaLabel}
      </a>
    </div>
  </OpsPanel>
);
