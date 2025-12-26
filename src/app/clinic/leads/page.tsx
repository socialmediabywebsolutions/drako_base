"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClinicNoSubscriptionState } from "@/components/clinic/no-subscription-state";
import { isNoSubscriptionError, unwrapClinicResponse } from "@/app/clinic/api-client";
import type { ClinicLead } from "@/lib/clinic/types";

const STATUSES: ClinicLead["status"][] = ["new", "contacted", "booked", "lost"];

export default function ClinicLeadsPage() {
  const [items, setItems] = useState<ClinicLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ClinicLead["status"] | "all">("all");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    source: "web",
    interest: "",
    priority: "medium",
  });
  const [saving, setSaving] = useState(false);
  const [noSubscription, setNoSubscription] = useState(false);

  const loadLeads = useCallback(async (status: string | null = null) => {
    setLoading(true);
    try {
      const url = status ? `/api/clinic/leads?status=${status}` : "/api/clinic/leads";
      const json = await unwrapClinicResponse<{ items: ClinicLead[] }>(
        await fetch(url),
        { fallbackMessage: "No se pudieron cargar los leads" },
      );
      setItems(json?.items ?? []);
      setError(null);
      setNoSubscription(false);
    } catch (err) {
      if (isNoSubscriptionError(err)) {
        setNoSubscription(true);
        setItems([]);
        setError(null);
      } else {
        setError((err as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeads(statusFilter === "all" ? null : statusFilter);
  }, [loadLeads, statusFilter]);

  const grouped = useMemo(() => {
    const map: Record<string, ClinicLead[]> = { new: [], contacted: [], booked: [], lost: [] };
    items.forEach((lead) => {
      map[lead.status]?.push(lead);
    });
    return map;
  }, [items]);

  async function addLead(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await unwrapClinicResponse(
        await fetch("/api/clinic/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            email: form.email || null,
            phone: form.phone || null,
            source: form.source,
            interest: form.interest || null,
            priority: form.priority,
          }),
        }),
        { fallbackMessage: "No se pudo crear el lead" },
      );
      setForm({ name: "", email: "", phone: "", source: "web", interest: "", priority: "medium" });
      await loadLeads(statusFilter === "all" ? null : statusFilter);
    } catch (err) {
      if (isNoSubscriptionError(err)) {
        setNoSubscription(true);
        setError(null);
      } else {
        setError((err as Error).message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function updateLead(id: string, payload: Partial<ClinicLead>) {
    try {
      await unwrapClinicResponse(
        await fetch(`/api/clinic/leads/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
        { fallbackMessage: "No se pudo actualizar el lead" },
      );
      await loadLeads(statusFilter === "all" ? null : statusFilter);
    } catch (err) {
      if (isNoSubscriptionError(err)) {
        setNoSubscription(true);
        setError(null);
      } else {
        setError((err as Error).message);
      }
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/70 p-5">
        <h1 className="text-xl font-semibold mb-3">Pipeline de leads</h1>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={[
              "rounded-full px-4 py-1 text-sm",
              statusFilter === "all" ? "bg-[var(--brand)] text-white" : "bg-[var(--panel)] text-[var(--foreground)]",
            ].join(" ")}
          >
            Todos
          </button>
          {STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={[
                "rounded-full px-4 py-1 text-sm capitalize",
                statusFilter === status ? "bg-[var(--brand)] text-white" : "bg-[var(--panel)] text-[var(--foreground)]",
              ].join(" ")}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {noSubscription ? (
        <ClinicNoSubscriptionState />
      ) : (
        <>
          {error && <div className="rounded-2xl border border-red-500/40 bg-red-900/20 px-4 py-3 text-sm text-red-100">{error}</div>}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {STATUSES.map((status) => (
              <div key={status} className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/70 p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold capitalize">{status}</p>
                  <span className="text-xs text-[var(--muted)]">{grouped[status].length}</span>
                </div>
                <div className="space-y-3">
                  {(loading ? [] : grouped[status]).map((lead) => (
                    <div key={lead.id} className="rounded-2xl border border-[var(--border)] bg-[var(--background)]/80 p-3 text-sm">
                      <p className="font-semibold">{lead.name}</p>
                      {lead.interest && <p className="text-[var(--muted)]">{lead.interest}</p>}
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                        <span className="rounded-full border border-[var(--border)] px-2 py-0.5">{lead.source}</span>
                        <span className="rounded-full border border-[var(--border)] px-2 py-0.5">{lead.priority}</span>
                      </div>
                      <div className="mt-3 flex gap-2 text-xs">
                        {status !== "booked" && (
                          <button
                            type="button"
                            onClick={() => updateLead(lead.id, { status: "booked" })}
                            className="rounded-full border border-[var(--brand)]/40 px-3 py-1 text-[var(--brand)]"
                          >
                            Marcar booked
                          </button>
                        )}
                        {status !== "lost" && (
                          <button
                            type="button"
                            onClick={() => updateLead(lead.id, { status: "lost" })}
                            className="rounded-full border border-red-400/40 px-3 py-1 text-red-300"
                          >
                            Marcar perdido
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {!loading && grouped[status].length === 0 && (
                    <p className="text-xs text-[var(--muted)]">Sin leads en esta etapa.</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={addLead} className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/70 p-5 space-y-4">
            <h2 className="text-lg font-semibold">Añadir lead manual</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                Nombre completo
                <input
                  className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </label>
              <label className="text-sm">
                Email
                <input
                  className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </label>
              <label className="text-sm">
                Teléfono
                <input
                  className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </label>
              <label className="text-sm">
                Origen
                <select
                  className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  value={form.source}
                  onChange={(e) => setForm((prev) => ({ ...prev, source: e.target.value }))}
                >
                  <option value="web">Web</option>
                  <option value="instagram">Instagram</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="referral">Referido</option>
                </select>
              </label>
            </div>
            <label className="text-sm block">
              Interés / servicio
              <input
                className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                value={form.interest}
                onChange={(e) => setForm((prev) => ({ ...prev, interest: e.target.value }))}
              />
            </label>
            <label className="text-sm block">
              Prioridad
              <select
                className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                value={form.priority}
                onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-strong)] disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Añadir lead"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
