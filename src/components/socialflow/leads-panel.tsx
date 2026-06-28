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

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `hace ${days}d`;
  return new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short" });
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

function LeadCard({
  lead,
  isPending,
  onStatusChange,
}: {
  lead: SocialFlowLead;
  isPending: boolean;
  onStatusChange: (s: LeadStatus) => void;
}) {
  const temp = TEMP_META[lead.temperature];
  const status = STATUS_META[lead.status];
  const isDone = lead.status === "CONVERTED" || lead.status === "LOST";

  return (
    <div
      className={[
        "rounded-xl border bg-white/4 transition hover:bg-white/6",
        lead.temperature === "HOT" ? "border-rose-500/30" : "border-white/8",
        isDone ? "opacity-70" : "",
      ].join(" ")}
    >
      {/* Card header */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/8 px-4 py-3">
        <span className="text-sm font-semibold text-white">
          {lead.senderName ?? lead.senderHandle ?? "Anónimo"}
        </span>
        {lead.senderHandle && lead.senderName && (
          <span className="text-xs text-white/35">@{lead.senderHandle}</span>
        )}
        <span className={[
          "rounded-full px-2 py-0.5 text-[11px] font-medium",
          PROVIDER_BG[lead.provider] ?? "bg-white/8 text-white/50",
        ].join(" ")}>
          {PROVIDER_LABELS[lead.provider] ?? lead.provider}
        </span>
        <span className={[
          "rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-wide",
          temp.bg, temp.border,
        ].join(" ")}>
          {temp.label}
        </span>
        <span className={[
          "rounded-full px-2 py-0.5 text-[11px] font-medium",
          status.bg,
        ].join(" ")}>
          {status.label}
        </span>
        <span className="ml-auto text-[11px] text-white/25">{relativeTime(lead.createdAt)}</span>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Message */}
        <p className="rounded-lg bg-white/5 px-3 py-2.5 text-sm text-white/65 line-clamp-2">
          {lead.incomingMessage}
        </p>

        {/* Intent score */}
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/35">
            Score de intención
          </p>
          <ScoreBar score={lead.intentScore} temp={lead.temperature} />
        </div>

        {/* Actions */}
        {!isDone && (
          <div className="flex flex-wrap gap-2 border-t border-white/8 pt-3">
            <Link
              href="/socialflow/conversations"
              className="rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 py-1.5 text-sm font-medium text-white shadow-md shadow-violet-500/20 transition hover:brightness-110"
            >
              Ver conversación
            </Link>
            {lead.status === "NEW" && (
              <ActionBtn onClick={() => onStatusChange("CONTACTED")} disabled={isPending} variant="secondary">
                {isPending ? "…" : "Marcar contactado"}
              </ActionBtn>
            )}
            {(lead.status === "NEW" || lead.status === "CONTACTED") && (
              <ActionBtn onClick={() => onStatusChange("CONVERTED")} disabled={isPending} variant="success">
                Convertido
              </ActionBtn>
            )}
            {lead.status !== "LOST" && (
              <ActionBtn onClick={() => onStatusChange("LOST")} disabled={isPending} variant="ghost">
                Perdido
              </ActionBtn>
            )}
          </div>
        )}

        {isDone && (
          <div className="flex items-center gap-2 border-t border-white/8 pt-3">
            {lead.status === "CONVERTED" && (
              <span className="text-xs font-medium text-emerald-400">✓ Convertido</span>
            )}
            {lead.status === "LOST" && (
              <span className="text-xs text-white/30">Perdido</span>
            )}
            <ActionBtn onClick={() => onStatusChange("NEW")} disabled={isPending} variant="ghost">
              Reactivar
            </ActionBtn>
          </div>
        )}
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

function ActionBtn({
  children,
  onClick,
  disabled,
  variant,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  variant: "secondary" | "success" | "ghost";
}) {
  const cls = {
    secondary: "border border-white/10 bg-white/6 text-white/65 hover:bg-white/10 hover:text-white",
    success: "border border-emerald-500/25 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15",
    ghost: "text-white/30 hover:bg-white/6 hover:text-white/55",
  }[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-40",
        cls,
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
