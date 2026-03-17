import React from "react";

export type OpsPanelVariant = "base" | "elevated" | "flat";

const panelStyles: Record<OpsPanelVariant, string> = {
  base: "rounded-lg border border-[#1D2433] bg-[#0F1116] shadow-none hover:border-[#2A3448] hover:bg-[#111724] transition-colors duration-150",
  elevated: "rounded-lg border border-[#2A3448] bg-[#121622] shadow-[0_0_50px_rgba(46,231,166,0.15)] hover:border-[#3a4864] hover:bg-[#151a28] transition-colors duration-150",
  flat: "rounded-lg border border-[#1D2433] bg-[#0B0D11] shadow-none",
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
  RUNNING: { border: "border-emerald-400/60", bg: "bg-emerald-500/20", text: "text-emerald-200", dot: "bg-emerald-300" },
  BUILD: { border: "border-amber-400/60", bg: "bg-amber-500/20", text: "text-amber-200", dot: "bg-amber-300" },
  RESEARCH: { border: "border-sky-400/60", bg: "bg-sky-500/20", text: "text-sky-200", dot: "bg-sky-300" },
};

export const StatusBadge: React.FC<{ state: OpsState; label?: string; className?: string }> = ({ state, label, className = "" }) => {
  const c = badgeColors[state];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full ${c.border} ${c.bg} px-2 py-0.5 text-[11px] font-semibold uppercase ${c.text} ${className}`}>
      <span className={`h-2 w-2 rounded-full ${c.dot}`} />
      {label ?? state}
    </span>
  );
};

export const StateBlock: React.FC<{ state: OpsState; count: number; className?: string }> = ({ state, count, className = "" }) => {
  const c = badgeColors[state];
  return (
    <div className={`flex items-center gap-2 rounded border px-3 py-2 ${c.border} ${c.bg} ${className}`}>
      <span className="text-xs font-semibold uppercase text-slate-50">{state}</span>
      <span className="text-lg font-bold text-slate-50">{count}</span>
    </div>
  );
};

export const ProductList: React.FC<{ items: { name: string; desc: string; state: OpsState }[] }> = ({ items }) => (
  <div className="mt-2 divide-y divide-slate-800 text-sm">
    {items.length === 0 ? (
      <div className="py-3 text-slate-400">Sin servicios públicos</div>
    ) : (
      items.map((item) => (
        <div key={`${item.state}-${item.name}`} className="relative flex items-center gap-3 py-2 pl-3 hover:border-emerald-400/50 hover:shadow-[0_0_20px_rgba(46,231,166,0.18)]">
          <span className={`absolute left-0 top-0 h-full w-[3px] rounded ${badgeColors[item.state].dot}`} />
          <StatusBadge state={item.state} />
          <div className="flex flex-1 items-baseline justify-between gap-2">
            <span className="font-semibold text-slate-100">{item.name}</span>
            <span className="text-slate-400 text-xs line-clamp-1">{item.desc}</span>
          </div>
        </div>
      ))
    )}
  </div>
);

export const LogList: React.FC<{ lines: string[]; highlightFirst?: boolean }> = ({ lines, highlightFirst = true }) => (
  <div className="mt-2 space-y-1 text-[12px] font-medium text-slate-200 font-mono">
    {lines.map((line, idx) => (
      <div key={`${line}-${idx}`} className="flex items-start gap-2 hover:text-slate-50">
        <span className={`h-1.5 w-1.5 rounded-full ${idx === 0 && highlightFirst ? "bg-emerald-400" : "bg-slate-600"} mt-1`} />
        <span className={`${idx === 0 && highlightFirst ? "text-slate-50" : "text-slate-200"}`}>{line}</span>
      </div>
    ))}
  </div>
);

export const HeroModule: React.FC<{
  title: string;
  subtitle: string;
  tags: string[];
  ctaHref: string;
}> = ({ title, subtitle, tags, ctaHref }) => (
  <OpsPanel variant="elevated" className="relative overflow-hidden p-6 sm:p-7">
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      <div className="absolute inset-y-6 left-2 w-[2px] bg-emerald-500/40" />
      <div className="absolute right-[-30%] top-[-30%] h-[60%] w-[60%] rounded-full bg-emerald-500/10 blur-3xl" />
    </div>
    <div className="relative flex items-center gap-2 text-sm text-slate-300">
      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
      <StatusBadge state="RUNNING" />
      <span className="text-slate-500">{subtitle}</span>
    </div>
    <div className="relative mt-4 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight text-slate-50">{title}</h1>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-300">
          {tags.slice(0, 4).map((tag) => (
            <span key={tag} className="rounded border border-[#2A3448] bg-[#0F1116] px-2 py-0.5">
              {tag}
            </span>
          ))}
        </div>
      </div>
      <a
        href={ctaHref}
        className="h-9 rounded border border-[#2A3448] bg-[#121622] px-3 text-sm font-semibold text-slate-100 hover:border-emerald-300/60 hover:text-emerald-100"
      >
        Ver panel
      </a>
    </div>
  </OpsPanel>
);
