"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { LeadStatus, LeadTemperature, SocialFlowLead } from "@/lib/socialflow/leads/types";

type Props = {
  leads: SocialFlowLead[];
  saasId: string;
};

const TEMP_LABELS: Record<LeadTemperature, string> = {
  HOT: "HOT",
  WARM: "WARM",
  COLD: "COLD",
};

const TEMP_COLORS: Record<LeadTemperature, string> = {
  HOT: "bg-rose-100 text-rose-700 border-rose-200",
  WARM: "bg-amber-100 text-amber-700 border-amber-200",
  COLD: "bg-sky-100 text-sky-700 border-sky-200",
};

const TEMP_DOT: Record<LeadTemperature, string> = {
  HOT: "bg-rose-500",
  WARM: "bg-amber-400",
  COLD: "bg-sky-400",
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "Nuevo",
  CONTACTED: "Contactado",
  CONVERTED: "Convertido",
  LOST: "Perdido",
};

const STATUS_COLORS: Record<LeadStatus, string> = {
  NEW: "bg-slate-100 text-slate-600",
  CONTACTED: "bg-indigo-100 text-indigo-700",
  CONVERTED: "bg-emerald-100 text-emerald-700",
  LOST: "bg-rose-100 text-rose-500",
};

const PROVIDER_LABELS: Record<string, string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK_PAGE: "Facebook",
  LINKEDIN: "LinkedIn",
};

function ScoreBar({ score }: { score: number }) {
  const color = score >= 60 ? "bg-rose-500" : score >= 30 ? "bg-amber-400" : "bg-sky-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-slate-100">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-bold tabular-nums text-slate-500">{score}</span>
    </div>
  );
}

const ALL_TEMPS: Array<LeadTemperature | null> = [null, "HOT", "WARM", "COLD"];
const ALL_STATUSES: Array<LeadStatus | null> = [null, "NEW", "CONTACTED", "CONVERTED", "LOST"];

export default function LeadsPanel({ leads: initialLeads, saasId }: Props) {
  const [leads, setLeads] = useState(initialLeads);
  const [filterTemp, setFilterTemp] = useState<LeadTemperature | null>(null);
  const [filterStatus, setFilterStatus] = useState<LeadStatus | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visible = leads.filter((l) => {
    if (filterTemp && l.temperature !== filterTemp) return false;
    if (filterStatus && l.status !== filterStatus) return false;
    return true;
  });

  const counts = {
    HOT: leads.filter((l) => l.temperature === "HOT").length,
    WARM: leads.filter((l) => l.temperature === "WARM").length,
    COLD: leads.filter((l) => l.temperature === "COLD").length,
  };

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

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {(["HOT", "WARM", "COLD"] as LeadTemperature[]).map((t) => (
          <button
            key={t}
            onClick={() => setFilterTemp(filterTemp === t ? null : t)}
            className={[
              "rounded-2xl border p-4 text-left transition hover:shadow-sm",
              filterTemp === t ? TEMP_COLORS[t] : "border-slate-200 bg-white hover:border-slate-300",
            ].join(" ")}
          >
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${TEMP_DOT[t]}`} />
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{t}</span>
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">{counts[t]}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {ALL_TEMPS.map((t) => (
            <button
              key={t ?? "all"}
              onClick={() => setFilterTemp(t)}
              className={[
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                filterTemp === t
                  ? "bg-slate-950 text-white"
                  : "text-slate-500 hover:text-slate-800",
              ].join(" ")}
            >
              {t ?? "Todos"}
            </button>
          ))}
        </div>

        <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {ALL_STATUSES.map((s) => (
            <button
              key={s ?? "all"}
              onClick={() => setFilterStatus(s)}
              className={[
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                filterStatus === s
                  ? "bg-slate-950 text-white"
                  : "text-slate-500 hover:text-slate-800",
              ].join(" ")}
            >
              {s ? STATUS_LABELS[s] : "Estado"}
            </button>
          ))}
        </div>
      </div>

      {/* Lead list */}
      <div className="space-y-3">
        {visible.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-400">
            {leads.length === 0
              ? "No hay leads aún. Los leads se detectan automáticamente cuando llegan mensajes con señales de compra."
              : "No hay leads que coincidan con los filtros seleccionados."}
          </div>
        ) : (
          visible.map((lead) => (
            <div
              key={lead.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-3">
                  {/* Header row */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-900">
                      {lead.senderName ?? lead.senderHandle ?? "Anónimo"}
                    </span>
                    {lead.senderHandle && lead.senderName && (
                      <span className="text-xs text-slate-400">@{lead.senderHandle}</span>
                    )}
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {PROVIDER_LABELS[lead.provider] ?? lead.provider}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-bold tracking-wide ${TEMP_COLORS[lead.temperature]}`}
                    >
                      {TEMP_LABELS[lead.temperature]}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[lead.status]}`}
                    >
                      {STATUS_LABELS[lead.status]}
                    </span>
                    <span className="ml-auto text-xs text-slate-400">{formatDate(lead.createdAt)}</span>
                  </div>

                  {/* Message */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700 line-clamp-3">
                    {lead.incomingMessage}
                  </div>

                  {/* Score bar */}
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Score de intención
                    </div>
                    <ScoreBar score={lead.intentScore} />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                <Link
                  href="/socialflow/conversations"
                  className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-sky-500/25 transition hover:-translate-y-0.5 hover:bg-sky-600"
                >
                  Contactar
                </Link>

                {lead.status === "NEW" && (
                  <button
                    onClick={() => changeStatus(lead.id, "CONTACTED")}
                    disabled={isPending && pendingId === lead.id}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    {isPending && pendingId === lead.id ? "Guardando…" : "Marcar contactado"}
                  </button>
                )}

                {(lead.status === "NEW" || lead.status === "CONTACTED") && (
                  <button
                    onClick={() => changeStatus(lead.id, "CONVERTED")}
                    disabled={isPending && pendingId === lead.id}
                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                  >
                    Convertido
                  </button>
                )}

                {lead.status !== "LOST" && lead.status !== "CONVERTED" && (
                  <button
                    onClick={() => changeStatus(lead.id, "LOST")}
                    disabled={isPending && pendingId === lead.id}
                    className="rounded-xl border border-slate-100 px-4 py-2 text-sm font-medium text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50"
                  >
                    Perdido
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
