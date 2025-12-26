"use client";

import { useEffect, useMemo, useState } from "react";
import { ClinicNoSubscriptionState } from "@/components/clinic/no-subscription-state";
import { isNoSubscriptionError, unwrapClinicResponse } from "@/app/clinic/api-client";
import type { ClinicMetrics, ClinicProfile } from "@/lib/clinic/types";

type Recommendation = { title: string; description: string };

export default function ClinicDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ClinicProfile | null>(null);
  const [metrics, setMetrics] = useState<ClinicMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noSubscription, setNoSubscription] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const [profileJson, metricsJson] = await Promise.all([
          unwrapClinicResponse<{ profile: ClinicProfile | null }>(
            await fetch("/api/clinic/profile"),
            { fallbackMessage: "No se pudo cargar el perfil de la clínica" },
          ),
          unwrapClinicResponse<{ metrics: ClinicMetrics | null }>(
            await fetch("/api/clinic/metrics"),
            { fallbackMessage: "No se pudieron cargar las métricas" },
          ),
        ]);
        if (!mounted) return;
        setProfile(profileJson.profile ?? null);
        setMetrics(metricsJson.metrics ?? null);
        setError(null);
        setNoSubscription(false);
      } catch (err) {
        if (!mounted) return;
        if (isNoSubscriptionError(err)) {
          setNoSubscription(true);
          setProfile(null);
          setMetrics(null);
          setError(null);
        } else {
          setError((err as Error).message);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const recommendations = useMemo<Recommendation[]>(() => {
    if (!metrics) return [];
    const recs: Recommendation[] = [];
    if (metrics.noShowRate > 0.12) {
      recs.push({
        title: "Refuerza recordatorios",
        description: "La tasa de no-show es alta. Activa un flujo de WhatsApp + email 24h antes.",
      });
    }
    if (metrics.leadToBookingRate < 0.3) {
      recs.push({
        title: "Optimiza llamadas",
        description: "Convierte más leads asignando a ClinicSalesAgent el guion inicial y agendando al instante.",
      });
    }
    if (metrics.appointmentsPerWeek < 15) {
      recs.push({
        title: "Campaña de relleno",
        description: "Activa mensajes a clientes inactivos hace 45 días con incentivo de reactivación.",
      });
    }
    if (metrics.revenueCurrentMonth === 0) {
      recs.push({
        title: "Registra cobros",
        description: "No hay ingresos registrados este mes. Usa FinanceLite para disparar alertas y control.",
      });
    }
    if (recs.length === 0) {
      recs.push({
        title: "Mantén el pulso",
        description: "Todo está estable. Revisa leads calientes y prepara activaciones de fidelización.",
      });
    }
    return recs;
  }, [metrics]);

  const cards = [
    {
      title: "Leads esta semana",
      value: metrics ? metrics.totalLeads : "--",
      detail: "Últimos 7 días",
    },
    {
      title: "Citas confirmadas",
      value: metrics ? metrics.appointmentsPerWeek : "--",
      detail: "Semana actual",
    },
    {
      title: "No-show rate",
      value: metrics ? `${Math.round(metrics.noShowRate * 100)}%` : "--",
      detail: "Promedio mensual",
    },
    {
      title: "Ingresos del mes",
      value: metrics ? `${(metrics.revenueCurrentMonth / 100).toFixed(2)} €` : "--",
      detail: "FinanceLite",
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/80 p-6 shadow-xl shadow-black/10">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Drako Clinic Pack</p>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">
            {profile?.displayName ?? "Tu clínica"} {profile?.city ? `· ${profile.city}` : ""}
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Starter · objetivo: {profile?.primaryGoal === "loyalty" ? "Fidelización" : "Agenda llena"}
          </p>
        </div>
      </div>

      {noSubscription ? (
        <ClinicNoSubscriptionState />
      ) : (
        <>
          {error && <div className="rounded-2xl border border-red-400/40 bg-red-900/20 px-4 py-3 text-sm text-red-100">{error}</div>}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <div key={card.title} className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{card.title}</p>
                <p className="mt-2 text-3xl font-semibold">{loading ? "..." : card.value}</p>
                <p className="text-xs text-[var(--muted)]">{card.detail}</p>
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/70 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">Recommendations by Drako</p>
                <h2 className="text-xl font-semibold">Acciones sugeridas</h2>
              </div>
              {loading && <span className="text-xs text-[var(--muted)]">Actualizando...</span>}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {recommendations.map((rec) => (
                <div key={rec.title} className="rounded-2xl border border-[var(--border)] bg-[var(--background)]/70 p-4">
                  <p className="text-sm font-semibold">{rec.title}</p>
                  <p className="text-sm text-[var(--muted)]">{rec.description}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
