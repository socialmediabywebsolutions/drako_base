"use client";

import { useState, useEffect, useCallback } from "react";
import type { SocialFlowProspect, SocialFlowCampaign, ProspectStatus } from "@/lib/socialflow/prospector/types";

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ProspectStatus, { label: string; color: string }> = {
  DISCOVERED:  { label: "Descubierto",  color: "bg-gray-100 text-gray-600" },
  EMAIL_SENT:  { label: "Email enviado", color: "bg-blue-100 text-blue-700" },
  WA_SENT:     { label: "WA enviado",    color: "bg-green-100 text-green-700" },
  REPLIED:     { label: "Respondió",     color: "bg-sky-100 text-sky-700" },
  DEMO_BOOKED: { label: "Demo agendada", color: "bg-purple-100 text-purple-700" },
  CONVERTED:   { label: "Cliente ✓",     color: "bg-emerald-100 text-emerald-700" },
  LOST:        { label: "Perdido",       color: "bg-red-100 text-red-600" },
};

const VALID_STATUSES: ProspectStatus[] = [
  "DISCOVERED", "EMAIL_SENT", "WA_SENT", "REPLIED", "DEMO_BOOKED", "CONVERTED", "LOST",
];

function StatusBadge({ status }: { status: ProspectStatus }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

// ── API helpers ────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(err.error ?? "ERROR");
  }
  return res.json() as Promise<T>;
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function ProspectorPage() {
  const [campaigns, setCampaigns] = useState<SocialFlowCampaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [prospects, setProspects] = useState<SocialFlowProspect[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingProspects, setLoadingProspects] = useState(false);

  // New campaign form
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [form, setForm] = useState({ name: "", niche: "", location: "" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Prospect actions
  const [outreachLoading, setOutreachLoading] = useState<Record<string, boolean>>({});
  const [statusLoading, setStatusLoading] = useState<Record<string, boolean>>({});
  const [toastMsg, setToastMsg] = useState("");

  // Filter
  const [filterStatus, setFilterStatus] = useState<ProspectStatus | "">("");

  // Discovery polling
  const [discovering, setDiscovering] = useState(false);
  const [discoverSeconds, setDiscoverSeconds] = useState(0);

  // ── Data fetching ──────────────────────────────────────────────────────

  const fetchCampaigns = useCallback(async () => {
    setLoadingCampaigns(true);
    try {
      const data = await apiFetch<{ campaigns: SocialFlowCampaign[] }>("/api/socialflow/prospector/campaigns");
      setCampaigns(data.campaigns ?? []);
      if (!selectedCampaign && data.campaigns.length > 0) {
        setSelectedCampaign(data.campaigns[0]!.id);
      }
    } catch {
      // silently ignore
    } finally {
      setLoadingCampaigns(false);
    }
  }, [selectedCampaign]);

  const fetchProspects = useCallback(async (campaignId: string) => {
    setLoadingProspects(true);
    try {
      const qs = new URLSearchParams({ campaignId, limit: "200" });
      if (filterStatus) qs.set("status", filterStatus);
      const data = await apiFetch<{ prospects: SocialFlowProspect[] }>(`/api/socialflow/prospector/prospects?${qs}`);
      setProspects(data.prospects ?? []);
    } catch {
      // silently ignore
    } finally {
      setLoadingProspects(false);
    }
  }, [filterStatus]);

  useEffect(() => { void fetchCampaigns(); }, [fetchCampaigns]);

  useEffect(() => {
    if (selectedCampaign) void fetchProspects(selectedCampaign);
    else setProspects([]);
  }, [selectedCampaign, fetchProspects]);

  // ── Actions ────────────────────────────────────────────────────────────

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3500);
  };

  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError("");
    try {
      const data = await apiFetch<{ campaign: SocialFlowCampaign }>("/api/socialflow/prospector/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      setCampaigns((prev) => [data.campaign, ...prev]);
      setSelectedCampaign(data.campaign.id);
      setForm({ name: "", niche: "", location: "" });
      setShowNewCampaign(false);
      showToast("🚀 Campaña creada — buscando prospectos…");

      // Polling: cada 3s durante máx. 60s hasta que aparezcan prospectos
      const campaignId = data.campaign.id;
      setDiscovering(true);
      setDiscoverSeconds(0);
      let elapsed = 0;
      const interval = setInterval(async () => {
        elapsed += 3;
        setDiscoverSeconds(elapsed);
        try {
          const qs = new URLSearchParams({ campaignId, limit: "200" });
          const pd = await apiFetch<{ prospects: SocialFlowProspect[] }>(`/api/socialflow/prospector/prospects?${qs}`);
          const found = pd.prospects ?? [];
          if (found.length > 0 || elapsed >= 60) {
            clearInterval(interval);
            setDiscovering(false);
            setProspects(found);
            if (found.length > 0) showToast(`✅ ${found.length} prospecto${found.length > 1 ? "s" : ""} encontrado${found.length > 1 ? "s" : ""}`);
          }
        } catch { /* silently ignore */ }
      }, 3000);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Error al crear campaña");
    } finally {
      setCreating(false);
    }
  }

  async function handleOutreach(prospect: SocialFlowProspect, channel: "EMAIL" | "WHATSAPP") {
    const key = `${prospect.id}-${channel}`;
    setOutreachLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const data = await apiFetch<{ ok: boolean; results: Record<string, unknown>; waLink?: string }>(
        `/api/socialflow/prospector/${prospect.id}/outreach`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ channel, senderName: "El equipo de Socialcors" }),
        }
      );

      if (channel === "WHATSAPP" && data.waLink) {
        window.open(data.waLink as string, "_blank");
        showToast("💬 Abriendo WhatsApp con el mensaje listo");
      } else if (data.ok) {
        showToast(channel === "EMAIL" ? "📧 Email enviado correctamente" : "💬 WhatsApp enviado");
      } else {
        showToast("⚠️ No se pudo enviar — revisa los datos del prospecto");
      }

      if (selectedCampaign) void fetchProspects(selectedCampaign);
    } catch {
      showToast("❌ Error al enviar mensaje");
    } finally {
      setOutreachLoading((prev) => ({ ...prev, [key]: false }));
    }
  }

  async function handleStatusChange(prospect: SocialFlowProspect, newStatus: ProspectStatus) {
    setStatusLoading((prev) => ({ ...prev, [prospect.id]: true }));
    try {
      await apiFetch(`/api/socialflow/prospector/${prospect.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      setProspects((prev) =>
        prev.map((p) => p.id === prospect.id ? { ...p, status: newStatus } : p)
      );
      if (newStatus === "CONVERTED") showToast("🎉 ¡Nuevo cliente! Prospecto marcado como convertido");
    } catch {
      showToast("❌ Error al actualizar estado");
    } finally {
      setStatusLoading((prev) => ({ ...prev, [prospect.id]: false }));
    }
  }

  // ── Derived state ──────────────────────────────────────────────────────

  const activeCampaign = campaigns.find((c) => c.id === selectedCampaign);
  const filteredProspects = filterStatus
    ? prospects.filter((p) => p.status === filterStatus)
    : prospects;

  const funnel = {
    discovered: prospects.filter((p) => p.status === "DISCOVERED").length,
    contacted:  prospects.filter((p) => ["EMAIL_SENT", "WA_SENT"].includes(p.status)).length,
    replied:    prospects.filter((p) => p.status === "REPLIED").length,
    converted:  prospects.filter((p) => p.status === "CONVERTED").length,
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white shadow-xl">
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">
            🎯 Captación de Clientes
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Agentes IA que buscan prospectos y les contactan por email y WhatsApp
          </p>
        </div>
        <button
          onClick={() => setShowNewCampaign(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] px-5 py-2.5 text-sm font-black text-white shadow-md transition hover:opacity-90"
        >
          + Nueva Campaña
        </button>
      </div>

      {/* New campaign modal */}
      {showNewCampaign && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-black text-gray-900">Nueva campaña de captación</h2>
            <form onSubmit={(e) => void handleCreateCampaign(e)} className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Nombre de la campaña
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Restaurantes Madrid Q4"
                  required
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Nicho / sector
                </label>
                <input
                  value={form.niche}
                  onChange={(e) => setForm((f) => ({ ...f, niche: e.target.value }))}
                  placeholder="Ej: restaurantes, clínicas dentales, academias de idiomas…"
                  required
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Ciudad / zona
                </label>
                <input
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="Ej: Madrid, Barcelona, Valencia…"
                  required
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              {createError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{createError}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] py-2.5 text-sm font-black text-white disabled:opacity-60"
                >
                  {creating ? "Creando…" : "🚀 Crear y buscar prospectos"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewCampaign(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loadingCampaigns && campaigns.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-20 text-center">
          <div className="mb-4 text-5xl">🎯</div>
          <h2 className="text-xl font-black text-gray-900">Sin campañas todavía</h2>
          <p className="mt-2 max-w-sm text-sm text-gray-500">
            Crea tu primera campaña y el agente IA buscará prospectos en tu nicho y zona automáticamente.
          </p>
          <button
            onClick={() => setShowNewCampaign(true)}
            className="mt-6 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] px-6 py-3 text-sm font-black text-white shadow-md"
          >
            + Crear primera campaña
          </button>
        </div>
      )}

      {campaigns.length > 0 && (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* ── Campaign sidebar ──────────────────────────────────────── */}
          <div className="lg:w-64 xl:w-72">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400">
              Campañas
            </h2>
            <div className="flex flex-col gap-2">
              {campaigns.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCampaign(c.id)}
                  className={`rounded-xl border p-4 text-left transition ${
                    selectedCampaign === c.id
                      ? "border-blue-300 bg-blue-50 ring-2 ring-blue-200"
                      : "border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50/40"
                  }`}
                >
                  <p className="font-bold text-gray-900 text-sm leading-tight">{c.name}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{c.niche} · {c.location}</p>
                  <div className="mt-2 flex gap-3 text-xs text-gray-500">
                    <span>👥 {c.prospectCount}</span>
                    <span>📧 {c.emailSentCount}</span>
                    <span>💬 {c.repliedCount}</span>
                    <span className="font-bold text-emerald-600">✓ {c.convertedCount}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Main content ──────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            {/* Funnel metrics */}
            {activeCampaign && (
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Descubiertos",  value: funnel.discovered, icon: "🔍", color: "text-gray-700" },
                  { label: "Contactados",   value: funnel.contacted,  icon: "📤", color: "text-blue-600" },
                  { label: "Respondieron",  value: funnel.replied,    icon: "💬", color: "text-sky-600" },
                  { label: "Convertidos",   value: funnel.converted,  icon: "🎉", color: "text-emerald-600" },
                ].map((m) => (
                  <div key={m.label} className="rounded-xl bg-white border border-gray-200 px-4 py-3">
                    <p className="text-xs text-gray-500">{m.icon} {m.label}</p>
                    <p className={`text-2xl font-black ${m.color}`}>{m.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Filter row */}
            {activeCampaign && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filtrar:</span>
                {(["", ...VALID_STATUSES] as (ProspectStatus | "")[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      filterStatus === s
                        ? "bg-blue-500 text-white"
                        : "bg-white border border-gray-200 text-gray-600 hover:border-blue-300"
                    }`}
                  >
                    {s === "" ? "Todos" : (STATUS_CONFIG[s]?.label ?? s)}
                  </button>
                ))}
              </div>
            )}

            {/* Prospect list */}
            {loadingProspects ? (
              <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
                Cargando prospectos…
              </div>
            ) : filteredProspects.length === 0 && activeCampaign ? (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-14 text-center">
                {discovering ? (
                  <>
                    <div className="mb-3 flex justify-center">
                      <svg className="h-8 w-8 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-gray-700">Buscando prospectos con IA…</p>
                    <p className="mt-1 text-xs text-gray-400">{discoverSeconds}s — puede tardar hasta 60 segundos</p>
                    <div className="mx-auto mt-3 h-1.5 w-40 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] transition-all duration-1000"
                        style={{ width: `${Math.min(100, (discoverSeconds / 60) * 100)}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <>
                <p className="text-2xl mb-2">🔍</p>
                <p className="text-sm text-gray-500">
                  {prospects.length === 0
                    ? "El agente IA está buscando prospectos… puede tardar unos segundos."
                    : "No hay prospectos con este filtro."}
                </p>
                {prospects.length === 0 && (
                  <button
                    onClick={() => selectedCampaign && void fetchProspects(selectedCampaign)}
                    className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-100"
                  >
                    Actualizar
                  </button>
                )}
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredProspects.map((prospect) => (
                  <ProspectCard
                    key={prospect.id}
                    prospect={prospect}
                    onOutreach={handleOutreach}
                    onStatusChange={handleStatusChange}
                    outreachLoading={outreachLoading}
                    statusLoading={statusLoading[prospect.id] ?? false}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Prospect Card ──────────────────────────────────────────────────────────

function ProspectCard({
  prospect,
  onOutreach,
  onStatusChange,
  outreachLoading,
  statusLoading,
}: {
  prospect: SocialFlowProspect;
  onOutreach: (p: SocialFlowProspect, ch: "EMAIL" | "WHATSAPP") => Promise<void>;
  onStatusChange: (p: SocialFlowProspect, s: ProspectStatus) => Promise<void>;
  outreachLoading: Record<string, boolean>;
  statusLoading: boolean;
}) {
  const emailKey = `${prospect.id}-EMAIL`;
  const waKey = `${prospect.id}-WHATSAPP`;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 transition hover:border-blue-200 hover:shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-gray-900 text-sm leading-tight">
              {prospect.businessName}
            </h3>
            <StatusBadge status={prospect.status} />
          </div>

          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
            {prospect.niche && <span>📌 {prospect.niche}</span>}
            {prospect.location && <span>📍 {prospect.location}</span>}
            {prospect.rating && <span>⭐ {prospect.rating} ({prospect.reviewCount ?? 0} reseñas)</span>}
            {prospect.outreachCount > 0 && <span>📤 {prospect.outreachCount} contactos</span>}
          </div>

          {prospect.description && (
            <p className="mt-1.5 text-xs text-gray-500 line-clamp-2">{prospect.description}</p>
          )}

          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {prospect.email && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-blue-600 font-medium">
                📧 {prospect.email}
              </span>
            )}
            {(prospect.phone || prospect.whatsapp) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-green-600 font-medium">
                📱 {prospect.whatsapp ?? prospect.phone}
              </span>
            )}
            {prospect.website && (
              <a
                href={prospect.website.startsWith("http") ? prospect.website : `https://${prospect.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-gray-600 hover:text-blue-600"
              >
                🌐 Web
              </a>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-row flex-wrap gap-2 sm:flex-col sm:items-end">
          {/* Email button */}
          <button
            onClick={() => void onOutreach(prospect, "EMAIL")}
            disabled={!prospect.email || outreachLoading[emailKey]}
            title={!prospect.email ? "Sin email" : "Enviar email de prospección"}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {outreachLoading[emailKey] ? "…" : "📧"} Email
          </button>

          {/* WhatsApp button */}
          <button
            onClick={() => void onOutreach(prospect, "WHATSAPP")}
            disabled={!prospect.phone && !prospect.whatsapp}
            title={(!prospect.phone && !prospect.whatsapp) ? "Sin teléfono" : "Enviar WhatsApp"}
            className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 border border-green-200 px-3 py-1.5 text-xs font-semibold text-green-700 transition hover:bg-green-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {outreachLoading[waKey] ? "…" : "💬"} WhatsApp
          </button>

          {/* Status selector */}
          <select
            value={prospect.status}
            onChange={(e) => void onStatusChange(prospect, e.target.value as ProspectStatus)}
            disabled={statusLoading}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-semibold text-gray-600 focus:border-blue-300 focus:outline-none disabled:opacity-50"
          >
            {VALID_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_CONFIG[s]?.label ?? s}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
