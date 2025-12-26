"use client";

import { useCallback, useEffect, useState } from "react";
import { ClinicNoSubscriptionState } from "@/components/clinic/no-subscription-state";
import { isNoSubscriptionError, unwrapClinicResponse } from "@/app/clinic/api-client";
import type { ClinicAppointment } from "@/lib/clinic/types";

type FormState = {
  patientName: string;
  startsAt: string;
  durationMinutes: number;
  service: string;
};

const STATUS_OPTIONS: ClinicAppointment["status"][] = ["booked", "done", "no-show", "cancelled"];

export default function ClinicAgendaPage() {
  const [items, setItems] = useState<ClinicAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    patientName: "",
    startsAt: "",
    durationMinutes: 60,
    service: "",
  });
  const [saving, setSaving] = useState(false);
  const [noSubscription, setNoSubscription] = useState(false);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const json = await unwrapClinicResponse<{ items: ClinicAppointment[] }>(
        await fetch("/api/clinic/appointments"),
        { fallbackMessage: "No se pudieron cargar las citas" },
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
    loadAppointments();
  }, [loadAppointments]);

  async function addAppointment(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const endsAt = new Date(form.startsAt).getTime() + form.durationMinutes * 60 * 1000;
      await unwrapClinicResponse(
        await fetch("/api/clinic/appointments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientName: form.patientName,
            startsAt: form.startsAt,
            endsAt: new Date(endsAt).toISOString(),
            serviceId: null,
            roomLabel: null,
            staffName: null,
          }),
        }),
        { fallbackMessage: "No se pudo crear la cita" },
      );
      setForm({ patientName: "", startsAt: "", durationMinutes: 60, service: "" });
      await loadAppointments();
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

  async function updateAppointment(id: string, status: ClinicAppointment["status"]) {
    try {
      await unwrapClinicResponse(
        await fetch(`/api/clinic/appointments/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }),
        { fallbackMessage: "No se pudo actualizar la cita" },
      );
      await loadAppointments();
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
      {noSubscription ? (
        <ClinicNoSubscriptionState />
      ) : (
        <>
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/70 p-5">
            <h1 className="text-xl font-semibold mb-4">Agenda semanal</h1>
            {error && <div className="rounded-2xl border border-red-400/40 bg-red-900/20 px-4 py-3 text-sm text-red-100">{error}</div>}
            <div className="space-y-3">
              {(loading ? [] : items).map((appt) => (
                <div key={appt.id} className="rounded-2xl border border-[var(--border)] bg-[var(--background)]/80 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{appt.patientName}</p>
                      <p className="text-xs text-[var(--muted)]">{new Date(appt.startsAt).toLocaleString()}</p>
                    </div>
                    <div className="flex gap-2 text-xs">
                      {STATUS_OPTIONS.map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => updateAppointment(appt.id, status)}
                          className={[
                            "rounded-full border px-3 py-1 capitalize",
                            appt.status === status
                              ? "border-[var(--brand)] text-[var(--brand)]"
                              : "border-[var(--border)] text-[var(--muted)]",
                          ].join(" ")}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              {!loading && items.length === 0 && <p className="text-sm text-[var(--muted)]">No hay citas registradas.</p>}
            </div>
          </div>

          <form onSubmit={addAppointment} className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/70 p-5 space-y-4">
            <h2 className="text-lg font-semibold">Añadir cita rápida</h2>
            <label className="text-sm block">
              Paciente
              <input
                className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                value={form.patientName}
                onChange={(e) => setForm((prev) => ({ ...prev, patientName: e.target.value }))}
                required
              />
            </label>
            <label className="text-sm block">
              Fecha y hora
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                value={form.startsAt}
                onChange={(e) => setForm((prev) => ({ ...prev, startsAt: e.target.value }))}
                required
              />
            </label>
            <label className="text-sm block">
              Duración (min)
              <input
                type="number"
                min={15}
                className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                value={form.durationMinutes}
                onChange={(e) => setForm((prev) => ({ ...prev, durationMinutes: Number(e.target.value) }))}
              />
            </label>
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-strong)] disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Añadir cita"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
