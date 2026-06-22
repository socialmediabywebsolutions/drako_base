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
  HOT:  { label: "HOT",  bg: "bg-rose-100 text-rose-700",   dot: "bg-rose-500",   border: "border-rose-200" },
  WARM: { label: "WARM", bg: "bg-amber-100 text-amber-700", dot: "bg-amber-400",  border: "border-amber-200" },
  COLD: { label: "COLD", bg: "bg-sky-100 text-sky-700",     dot: "bg-sky-400",    border: "border-sky-200" },
};

const STATUS_META: Record<LeadStatus, { label: string; bg: string }> = {
  NEW:       { label: "Nuevo",      bg: "bg-slate-100 text-slate-600" },
  CONTACTED: { label: "Contactado", bg: "bg-indigo-100 text-indigo-700" },
  CONVERTED: { label: "Convertido", bg: "bg-emerald-100 text-emerald-700" },
  LOST:      { label: "Perdido",    bg: "bg-rose-50 text-rose-500" },
};

const PROVIDER_LABELS: Record<string, string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK_PAGE: "Facebook",
  LINKEDIN: "LinkedIn",
};

const PROVIDER_BG: Record<string, string> = {
  INSTAGRAM: "bg-pink-100 text-pink-700",
  FACEBOOK_PAGE: "bg-blue-100 text-blue-700",
  LINKEDIN: "bg-sky-100 text-sky-700",
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
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-1.5 rounded-full ${fill} transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className="w-6 text-right text-xs font-bold tabular-nums text-slate-500">{score}</span>
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

  // ── Derived stats ─────────────────────────────────────────────────────────
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

  // ── Filtered list ─────────────────────────────────────────────────────────
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

  // ── Actions ───────────────────────────────────────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Pipeline funnel */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <PipelineCard
          label="Activos"
          value={stats.active}
          sub={`de ${stats.total} total`}
          accent="slate"
        />
        <PipelineCard
          label="HOT"
          value={stats.hot}
          sub={stats.warm > 0 ? `+ ${stats.warm} WARM` : "leads calientes"}
          accent="rose"
          active={filterTemp === "HOT"}
          onClick={() => setFilterTemp(filterTemp === "HOT" ? null : "HOT")}
        />
        <PipelineCard
          label="Convertidos"
          value={stats.converted}
          sub={stats.convRate !== null ? `${stats.convRate}% tasa` : "sin datos aún"}
          accent="emerald"
          active={filterStatus === "CONVERTED"}
          onClick={() => setFilterStatus(filterStatus === "CONVERTED" ? null : "CONVERTED")}
        />
        <PipelineCard
          label="Perdidos"
          value={stats.lost}
          sub="no convertidos"
          accent="rose"
          muted
          active={filterStatus === "LOST"}
          onClick={() => setFilterStatus(filterStatus === "LOST" ? null : "LOST")}
        />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
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
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
          />
        </div>

        {/* Temperature tabs */}
        <FilterGroup>
          <FilterBtn active={filterTemp === null} onClick={() => setFilterTemp(null)}>Todos</FilterBtn>
          {(["HOT", "WARM", "COLD"] as LeadTemperature[]).map((t) => (
            <FilterBtn key={t} active={filterTemp === t} onClick={() => setFilterTemp(filterTemp === t ? null : t)}>
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${TEMP_META[t].dot}`} />
              {t}
            </FilterBtn>
          ))}
        </FilterGroup>

        {/* Status tabs */}
        <FilterGroup>
          <FilterBtn active={filterStatus === null} onClick={() => setFilterStatus(null)}>Estado</FilterBtn>
          {(["NEW", "CONTACTED", "CONVERTED", "LOST"] as LeadStatus[]).map((s) => (
            <FilterBtn key={s} active={filterStatus === s} onClick={() => setFilterStatus(filterStatus === s ? null : s)}>
              {STATUS_META[s].label}
            </FilterBtn>
          ))}
        </FilterGroup>
      </div>

      {/* Results count */}
      {(filterTemp || filterStatus || search) && (
        <p className="text-xs text-slate-400">
          {visible.length} resultado{visible.length !== 1 ? "s" : ""}
          {" · "}
          <button
            type="button"
            onClick={() => { setFilterTemp(null); setFilterStatus(null); setSearch(""); }}
            className="text-sky-600 hover:underline"
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
        "rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md",
        lead.temperature === "HOT" ? "border-rose-200" : "border-slate-200",
        isDone ? "opacity-70" : "",
      ].join(" ")}
    >
      {/* Card header */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
        <span className="text-sm font-semibold text-slate-900">
          {lead.senderName ?? lead.senderHandle ?? "Anónimo"}
        </span>
        {lead.senderHandle && lead.senderName && (
          <span className="text-xs text-slate-400">@{lead.senderHandle}</span>
        )}
        <span className={[
          "rounded-full px-2 py-0.5 text-[11px] font-medium",
          PROVIDER_BG[lead.provider] ?? "bg-slate-100 text-slate-600",
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
        <span className="ml-auto text-[11px] text-slate-400">{relativeTime(lead.createdAt)}</span>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Message */}
        <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-700 line-clamp-2">
          {lead.incomingMessage}
        </p>

        {/* Intent score */}
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Score de intención
          </p>
          <ScoreBar score={lead.intentScore} temp={lead.temperature} />
        </div>

        {/* Actions */}
        {!isDone && (
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            <Link
              href="/socialflow/conversations"
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Ver conversación
            </Link>
            {lead.status === "NEW" && (
              <ActionBtn
                onClick={() => onStatusChange("CONTACTED")}
                disabled={isPending}
                variant="secondary"
              >
                {isPending ? "…" : "Marcar contactado"}
              </ActionBtn>
            )}
            {(lead.status === "NEW" || lead.status === "CONTACTED") && (
              <ActionBtn
                onClick={() => onStatusChange("CONVERTED")}
                disabled={isPending}
                variant="success"
              >
                Convertido
              </ActionBtn>
            )}
            {lead.status !== "LOST" && (
              <ActionBtn
                onClick={() => onStatusChange("LOST")}
                disabled={isPending}
                variant="ghost"
              >
                Perdido
              </ActionBtn>
            )}
          </div>
        )}

        {isDone && (
          <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
            {lead.status === "CONVERTED" && (
              <span className="text-xs font-medium text-emerald-600">
                ✓ Convertido
              </span>
            )}
            {lead.status === "LOST" && (
              <span className="text-xs text-slate-400">Perdido</span>
            )}
            <ActionBtn
              onClick={() => onStatusChange("NEW")}
              disabled={isPending}
              variant="ghost"
            >
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
    ? "text-slate-400"
    : { slate: "text-slate-800", rose: "text-rose-600", emerald: "text-emerald-600" }[accent];
  const borderCls = active
    ? { slate: "border-slate-400", rose: "border-rose-400", emerald: "border-emerald-400" }[accent]
    : "border-slate-200";

  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={[
        "rounded-xl border bg-white px-4 py-3 text-left shadow-sm transition",
        onClick ? "cursor-pointer hover:shadow-md" : "",
        borderCls,
      ].join(" ")}
    >
      <p className={["text-2xl font-black tabular-nums", valueCls].join(" ")}>{value}</p>
      <p className="mt-0.5 text-xs font-semibold text-slate-700">{label}</p>
      <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>
    </Tag>
  );
}

function FilterGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5">
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
        active ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800",
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
    secondary: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    success: "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    ghost: "text-slate-400 hover:bg-slate-100 hover:text-slate-600",
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
    <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center">
      {hasLeads ? (
        <p className="text-sm text-slate-400">No hay leads con esos filtros.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-600">Sin leads aún</p>
          <p className="mx-auto max-w-xs text-xs text-slate-400">
            Los leads se detectan automáticamente cuando llegan mensajes con señales de intención de compra (precio, comprar, interesado…).
          </p>
          <Link
            href="/socialflow/conversations"
            className="mt-3 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Ver conversaciones
          </Link>
        </div>
      )}
    </div>
  );
}
