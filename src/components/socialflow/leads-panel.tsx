"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import type { LeadStatus, LeadTemperature, SocialFlowLead } from "@/lib/socialflow/leads/types";

type Props = {
  leads: SocialFlowLead[];
  saasId: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const TEMP_META: Record<LeadTemperature, { label: string; bg: string; dot: string; border: string }> = {
  HOT:  { label: "HOT",  bg: "bg-rose-500/15 text-rose-300",   dot: "bg-rose-500",   border: "border-rose-500/25" },
  WARM: { label: "WARM", bg: "bg-amber-500/15 text-amber-300", dot: "bg-amber-400",  border: "border-amber-500/25" },
  COLD: { label: "COLD", bg: "bg-sky-500/15 text-sky-300",     dot: "bg-sky-400",    border: "border-sky-500/25" },
};

const STATUS_META: Record<LeadStatus, { label: string; bg: string }> = {
  NEW:       { label: "Nuevo",      bg: "bg-white/8 text-white/50" },
  CONTACTED: { label: "Contactado", bg: "bg-indigo-500/15 text-indigo-300" },
  CONVERTED: { label: "Convertido", bg: "bg-emerald-500/15 text-emerald-300" },
  LOST:      { label: "Perdido",    bg: "bg-rose-500/10 text-rose-400" },
};

const PROVIDER_LABELS: Record<string, string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK_PAGE: "Facebook",
  LINKEDIN: "LinkedIn",
};

const PROVIDER_BG: Record<string, string> = {
  INSTAGRAM: "bg-pink-500/15 text-pink-300",
  FACEBOOK_PAGE: "bg-blue-500/15 text-blue-300",
  LINKEDIN: "bg-sky-500/15 text-sky-300",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(ts: number | string): string {
  const ms = Number(ts) * 1000;
  const diffMs = Date.now() - ms;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `hace ${days}d`;
  return new Date(ms).toLocaleDateString("es", { day: "numeric", month: "short" });
}

function ScoreBar({ score, temp }: { score: number; temp: LeadTemperature }) {
  const fill = temp === "HOT" ? "bg-rose-500" : temp === "WARM" ? "bg-amber-400" : "bg-sky-400";
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
        <div className={`h-1.5 rounded-full ${fill} transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className="w-6 text-right text-xs font-bold tabular-nums text-white/35">{score}</span>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function LeadsPanel({ leads: initialLeads, saasId }: Props) {
  const [leads, setLeads] = useState(initialLeads);
  const [filterTemp, setFilterTemp] = useState<LeadTemperature | null>(null);
  const [filterStatus, setFilterStatus] = useState<LeadStatus | null>(null);
  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const stats = useMemo(() => {
    const hot  = leads.filter((l) => l.temperature === "HOT").length;
    const warm = leads.filter((l) => l.temperature === "WARM").length;
    const cold = leads.filter((l) => l.temperature === "COLD").length;
    const converted = leads.filter((l) => l.status === "CONVERTED").length;
    const lost      = leads.filter((l) => l.status === "LOST").length;
    const closed = converted + lost;
    const convRate = closed > 0 ? Math.round((converted / closed) * 100) : null;
    const active = leads.filter((l) => l.status !== "CONVERTED" && l.status !== "LOST").length;
    return { hot, warm, cold, converted, lost, convRate, active, total: leads.length };
  }, [leads]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (filterTemp && l.temperature !== filterTemp) return false;
      if (filterStatus && l.status !== filterStatus) return false;
      if (q) {
        const haystack = [l.senderName, l.senderHandle, l.incomingMessage].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [leads, filterTemp, filterStatus, search]);

  function changeStatus(leadId: string, status: LeadStatus) {
    setPendingId(leadId);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/socialflow/leads/${leadId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ saasId, status }),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; lead?: SocialFlowLead };
        if (res.ok && data.ok && data.lead) {
          setLeads((prev) => prev.map((l) => (l.id === leadId ? data.lead! : l)));
        }
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <div className="space-y-5">

      {/* Pipeline funnel */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <PipelineCard label="Activos"     value={stats.active}    sub={`de ${stats.total} total`}                             accent="slate" />
        <PipelineCard label="HOT"         value={stats.hot}       sub={stats.warm > 0 ? `+ ${stats.warm} WARM` : "leads calientes"} accent="rose"    active={filterTemp === "HOT"}       onClick={() => setFilterTemp(filterTemp === "HOT" ? null : "HOT")} />
        <PipelineCard label="Convertidos" value={stats.converted} sub={stats.convRate !== null ? `${stats.convRate}% tasa` : "sin datos aún"} accent="emerald" active={filterStatus === "CONVERTED"} onClick={() => setFilterStatus(filterStatus === "CONVERTED" ? null : "CONVERTED")} />
        <PipelineCard label="Perdidos"    value={stats.lost}      sub="no convertidos"                                        accent="rose"    muted active={filterStatus === "LOST"}     onClick={() => setFilterStatus(filterStatus === "LOST" ? null : "LOST")} />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o mensaje…"
            className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-8 pr-3 text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
          />
        </div>

        <FilterGroup>
          <FilterBtn active={filterTemp === null} onClick={() => setFilterTemp(null)}>Todos</FilterBtn>
          {(["HOT", "WARM", "COLD"] as LeadTemperature[]).map((t) => (
            <FilterBtn key={t} active={filterTemp === t} onClick={() => setFilterTemp(filterTemp === t ? null : t)}>
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${TEMP_META[t].dot}`} />
              {t}
            </FilterBtn>
          ))}
        </FilterGroup>

        <FilterGroup>
          <FilterBtn active={filterStatus === null} onClick={() => setFilterStatus(null)}>Estado</FilterBtn>
          {(["NEW", "CONTACTED", "CONVERTED", "LOST"] as LeadStatus[]).map((s) => (
            <FilterBtn key={s} active={filterStatus === s} onClick={() => setFilterStatus(filterStatus === s ? null : s)}>
              {STATUS_META[s].label}
            </FilterBtn>
          ))}
        </FilterGroup>
      </div>

      {(filterTemp || filterStatus || search) && (
        <p className="text-xs text-white/30">
          {visible.length} resultado{visible.length !== 1 ? "s" : ""}
          {" · "}
          <button
            type="button"
            onClick={() => { setFilterTemp(null); setFilterStatus(null); setSearch(""); }}
            className="text-violet-400 hover:underline"
          >
            Limpiar filtros
          </button>
        </p>
      )}

      {/* Lead cards */}
      <div className="space-y-3">
        {visible.length === 0 ? (
          <EmptyState hasLeads={leads.length > 0} />
        ) : (
          visible.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              isPending={isPending && pendingId === lead.id}
              onStatusChange={(s) => changeStatus(lead.id, s)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Lead card ─────────────────────────────────────────────────────────────────

const TEMP_BADGE: Record<LeadTemperature, string> = {
  HOT:  "bg-red-500/20 text-red-400",
  WARM: "bg-amber-500/20 text-amber-400",
  COLD: "bg-blue-500/20 text-blue-400",
};

function detectOpportunityType(message: string): { label: string; cls: string } {
  const m = message.toLowerCase();
  if (/colabor|collab|sponsor|patrocinio/.test(m))
    return { label: "🤝 Colaboración", cls: "bg-purple-500/20 text-purple-400" };
  if (/coach|entrena|rutina|plan/.test(m))
    return { label: "💪 Servicio", cls: "bg-green-500/20 text-green-400" };
  if (/precio|comprar|adquirir|pagar/.test(m))
    return { label: "🛒 Venta", cls: "bg-blue-500/20 text-blue-400" };
  return { label: "💬 Consulta", cls: "bg-gray-500/20 text-gray-400" };
}

function initials(name: string | null, handle: string | null): string {
  const src = name ?? handle ?? "?";
  return src.trim().charAt(0).toUpperCase();
}

function LeadCard({
  lead,
  isPending,
  onStatusChange,
}: {
  lead: SocialFlowLead;
  isPending: boolean;
  onStatusChange: (s: LeadStatus) => void;
}) {
  const isDone = lead.status === "CONVERTED" || lead.status === "LOST";
  const opportunity = detectOpportunityType(lead.incomingMessage);

  return (
    <div
      className={[
        "rounded-xl border bg-white/4 transition hover:bg-white/6",
        lead.temperature === "HOT" ? "border-rose-500/30" : "border-white/8",
        isDone ? "opacity-60" : "",
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">
          {initials(lead.senderName, lead.senderHandle)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">
            {lead.senderName ?? lead.senderHandle ?? "Anónimo"}
          </p>
          {lead.senderHandle && (
            <p className="truncate text-xs text-white/40">@{lead.senderHandle}</p>
          )}
        </div>
        <span className={["rounded-full px-2.5 py-0.5 text-[11px] font-bold", TEMP_BADGE[lead.temperature]].join(" ")}>
          {lead.temperature}
        </span>
      </div>

      <div className="px-4 pb-4 space-y-3">
        {/* Opportunity type + provider */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={["rounded-full px-2.5 py-0.5 text-[11px] font-medium", opportunity.cls].join(" ")}>
            {opportunity.label}
          </span>
          <span className={["rounded-full px-2 py-0.5 text-[11px] font-medium", PROVIDER_BG[lead.provider] ?? "bg-white/8 text-white/50"].join(" ")}>
            {PROVIDER_LABELS[lead.provider] ?? lead.provider}
          </span>
          <span className="ml-auto text-xs text-white/30">{relativeTime(lead.createdAt)}</span>
        </div>

        {/* Message */}
        <p className="rounded-lg bg-white/5 px-3 py-2.5 text-sm italic text-white/60 line-clamp-3">
          "{lead.incomingMessage}"
        </p>

        {/* Intent score */}
        <ScoreBar score={lead.intentScore} temp={lead.temperature} />

        {/* Footer actions */}
        <div className="flex flex-wrap items-center gap-2 border-t border-white/8 pt-3">
          {!isDone ? (
            <>
              <button
                type="button"
                onClick={() => onStatusChange("CONTACTED")}
                disabled={isPending}
                className="rounded-lg bg-violet-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-violet-500 disabled:opacity-40"
              >
                Contactar
              </button>
              <button
                type="button"
                onClick={() => onStatusChange("CONVERTED")}
                disabled={isPending}
                className="rounded-lg bg-green-600/20 px-3 py-1 text-xs font-medium text-green-400 transition hover:bg-green-600/30 disabled:opacity-40"
              >
                Convertido ✓
              </button>
              <button
                type="button"
                onClick={() => onStatusChange("LOST")}
                disabled={isPending}
                className="px-3 py-1 text-xs text-white/30 transition hover:text-white/55 disabled:opacity-40"
              >
                Descartar
              </button>
            </>
          ) : (
            <>
              {lead.status === "CONVERTED" && (
                <span className="text-xs font-medium text-emerald-400">✓ Convertido</span>
              )}
              {lead.status === "LOST" && (
                <span className="text-xs text-white/30">Descartado</span>
              )}
              <button
                type="button"
                onClick={() => onStatusChange("NEW")}
                disabled={isPending}
                className="ml-auto px-3 py-1 text-xs text-white/30 transition hover:text-white/55 disabled:opacity-40"
              >
                Reactivar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PipelineCard({
  label,
  value,
  sub,
  accent,
  muted = false,
  active = false,
  onClick,
}: {
  label: string;
  value: number;
  sub: string;
  accent: "slate" | "rose" | "emerald";
  muted?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  const valueCls = muted
    ? "text-white/30"
    : { slate: "text-white", rose: "text-rose-400", emerald: "text-emerald-400" }[accent];
  const borderCls = active
    ? { slate: "border-white/25", rose: "border-rose-500/40", emerald: "border-emerald-500/40" }[accent]
    : "border-white/8";

  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={[
        "rounded-xl border bg-white/4 px-4 py-3 text-left transition",
        onClick ? "cursor-pointer hover:bg-white/6" : "",
        borderCls,
      ].join(" ")}
    >
      <p className={["text-2xl font-black tabular-nums", valueCls].join(" ")}>{value}</p>
      <p className="mt-0.5 text-xs font-semibold text-white/60">{label}</p>
      <p className="mt-0.5 text-[11px] text-white/30">{sub}</p>
    </Tag>
  );
}

function FilterGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-0.5 rounded-lg border border-white/10 bg-white/4 p-0.5">
      {children}
    </div>
  );
}

function FilterBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
        active ? "bg-violet-500 text-white" : "text-white/45 hover:text-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}


function EmptyState({ hasLeads }: { hasLeads: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 py-16 text-center">
      {hasLeads ? (
        <p className="text-sm text-white/35">No hay leads con esos filtros.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium text-white/60">Sin oportunidades aún</p>
          <p className="mx-auto max-w-xs text-xs text-white/35">
            Cuando un seguidor pregunte por colaboraciones, servicios o productos, aparecerá aquí automáticamente.
          </p>
          <Link
            href="/socialflow/conversations"
            className="mt-3 inline-block rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-medium text-white shadow-md shadow-violet-500/20 transition hover:brightness-110"
          >
            Ver mi comunidad
          </Link>
        </div>
      )}
    </div>
  );
}
