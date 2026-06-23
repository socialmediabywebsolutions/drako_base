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

export default function SocialFlowSetupPage() {
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
    return () => { active = false; };
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
      label: "Borrador listo para revisión",
      done: Boolean(status?.hasDraft),
      actionHref: `/socialflow?saasId=${encodeURIComponent(saasId)}`,
      actionLabel: "Crear borrador",
    },
  ]), [status, saasId]);

  const completed = checklist.filter((item) => item.done).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-2xl border border-white/10 bg-white/4 p-6">
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-400">SocialFlow Setup</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-white">Checklist mínimo para piloto privado</h1>
        <p className="mt-2 max-w-3xl text-sm text-white/45">
          Antes de cualquier publicación real, confirma perfil, cuenta social y revisión humana. Este flujo no publica contenido automáticamente.
        </p>
      </section>

      {/* Status cards */}
      <section className="grid gap-4 md:grid-cols-3">
        <StatusCard label="Perfil configurado" ok={Boolean(status?.profileConfigured)} />
        <StatusCard label="LinkedIn conectado" ok={Boolean(status?.linkedInConnected)} />
        <StatusCard label="Borrador disponible" ok={Boolean(status?.hasDraft)} />
      </section>

      {/* Account status */}
      <section className="rounded-xl border border-white/10 bg-white/4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight text-white">Estado de cuenta</h2>
          <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[11px] font-semibold text-white/55">
            {completed}/3 completado
          </span>
        </div>

        {loading && <p className="mt-3 text-sm text-white/45">Cargando estado...</p>}
        {error && (
          <div className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/8 p-3 text-xs text-amber-300">
            No se pudo leer el estado mínimo de setup ({error}).
          </div>
        )}

        {!loading && !error && (
          <div className="mt-4 space-y-3">
            {checklist.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/4 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white/90">{item.label}</p>
                  <p className={`text-xs ${item.done ? "text-emerald-400" : "text-white/35"}`}>
                    {item.done ? "Listo" : "Pendiente"}
                  </p>
                </div>
                <Link
                  href={item.actionHref}
                  className="inline-flex shrink-0 items-center rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/65 transition hover:border-violet-500/30 hover:bg-violet-500/8 hover:text-violet-300"
                >
                  {item.actionLabel}
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Human review notice */}
      <section className="rounded-xl border border-indigo-500/20 bg-indigo-500/8 p-4">
        <h3 className="text-sm font-semibold text-indigo-300">Revisión humana obligatoria</h3>
        <p className="mt-1 text-xs text-indigo-300/70">
          Publicar en vivo requiere aprobación humana explícita (`confirmPublish=true`) y rol admin.
        </p>
        <p className="mt-1 text-xs text-indigo-300/70">
          {status?.publishBlockedByPilotMode
            ? "Modo piloto privado activo: autopublish está bloqueado por política."
            : "El modo piloto privado no bloquea autopublish, pero la aprobación humana sigue siendo obligatoria."}
        </p>
      </section>
    </div>
  );
}

function StatusCard(props: { label: string; ok: boolean }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/4 p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-white/35">{props.label}</p>
      <p className={`mt-2 text-lg font-semibold ${props.ok ? "text-emerald-400" : "text-amber-400"}`}>
        {props.ok ? "Sí" : "No"}
      </p>
    </div>
  );
}
