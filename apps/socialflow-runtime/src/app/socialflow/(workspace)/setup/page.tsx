"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type SetupStatusResponse = {
  ok: boolean;
  status?: {
    saasId: string;
    tenantId: string;
    profileConfigured: boolean;
    linkedInConnected: boolean;
    hasDraft: boolean;
    publishBlockedByPilotMode: boolean;
    requiresHumanApprovalForPublish: boolean;
  };
  error?: string;
};

export default function SocialFlowRuntimeSetupPage() {
  const searchParams = useSearchParams();
  const saasId = searchParams.get("saasId") ?? "socialflow";

  const [status, setStatus] = useState<SetupStatusResponse["status"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/socialflow/setup/status?saasId=${encodeURIComponent(saasId)}`);
        const payload = await response.json().catch(() => null) as SetupStatusResponse | null;
        if (!response.ok || !payload?.ok || !payload.status) {
          throw new Error(payload?.error || "SETUP_STATUS_FAILED");
        }
        if (!active) return;
        setStatus(payload.status);
      } catch (fetchError) {
        if (!active) return;
        setStatus(null);
        setError(fetchError instanceof Error ? fetchError.message : "SETUP_STATUS_FAILED");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [saasId]);

  const checklist = useMemo(() => ([
    {
      key: "profile",
      label: "Perfil de marca",
      done: Boolean(status?.profileConfigured),
      actionHref: "/socialflow/profile",
      actionLabel: "Completar perfil",
    },
    {
      key: "linkedin",
      label: "LinkedIn conectado",
      done: Boolean(status?.linkedInConnected),
      actionHref: `/socialflow/profile?saasId=${encodeURIComponent(saasId)}`,
      actionLabel: "Conectar LinkedIn",
    },
    {
      key: "draft",
      label: "Borrador listo para revision",
      done: Boolean(status?.hasDraft),
      actionHref: `/socialflow?saasId=${encodeURIComponent(saasId)}`,
      actionLabel: "Crear borrador",
    },
  ]), [status, saasId]);

  const completed = checklist.filter((item) => item.done).length;

  return (
    <div className="space-y-6 bg-gradient-to-b from-slate-50 via-white to-white p-6">
      <section className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">SocialFlow Runtime Setup</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          Checklist minimo para private pilot
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Este flujo confirma el estado operativo minimo del tenant sin publicar contenido en vivo.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatusCard label="Perfil configurado" ok={Boolean(status?.profileConfigured)} />
        <StatusCard label="LinkedIn conectado" ok={Boolean(status?.linkedInConnected)} />
        <StatusCard label="Borrador disponible" ok={Boolean(status?.hasDraft)} />
      </section>

      <section className="rounded-xl border border-slate-200/70 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">Estado de cuenta</h2>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
            {completed}/3 completado
          </span>
        </div>

        {loading && <p className="mt-3 text-sm text-slate-500">Cargando estado...</p>}
        {error && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
            No se pudo leer el estado minimo de setup ({error}).
          </div>
        )}

        {!loading && !error && (
          <div className="mt-4 space-y-3">
            {checklist.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{item.label}</p>
                  <p className="text-xs text-slate-500">{item.done ? "Listo" : "Pendiente"}</p>
                </div>
                <Link
                  href={item.actionHref}
                  className="inline-flex shrink-0 items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  {item.actionLabel}
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-blue-200/70 bg-blue-50/60 p-4">
        <h3 className="text-sm font-semibold text-blue-900">Human review obligatorio</h3>
        <p className="mt-1 text-xs text-blue-800">
          Publicar en vivo requiere aprobacion humana explicita (`confirmPublish=true`) y rol admin.
        </p>
        <p className="mt-1 text-xs text-blue-800">
          {status?.publishBlockedByPilotMode
            ? "Private pilot mode activo: autopublish esta bloqueado por politica."
            : "Private pilot mode no bloquea autopublish, pero la aprobacion humana sigue siendo obligatoria."}
        </p>
      </section>
    </div>
  );
}

function StatusCard(props: { label: string; ok: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200/70 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{props.label}</p>
      <p className={props.ok ? "mt-2 text-lg font-semibold text-emerald-700" : "mt-2 text-lg font-semibold text-amber-700"}>
        {props.ok ? "SI" : "NO"}
      </p>
    </div>
  );
}
