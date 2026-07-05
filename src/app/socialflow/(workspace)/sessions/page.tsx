"use client";

import { useCallback, useEffect, useState } from "react";

type SessionRecord = {
  id: string;
  issued_at: string;
  expires_at: string;
  status: string;
  created_at: string;
  updated_at: string;
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return "Hace un momento";
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days}d`;
}

function expiresLabel(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Expirada";
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "Expira en menos de 1h";
  if (hours < 24) return `Expira en ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Expira en ${days}d`;
}

export default function SocialFlowSessionsPage() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/socialflow/sessions");
      const data = (await res.json()) as { ok: boolean; sessions?: SessionRecord[]; error?: string };
      if (!data.ok) {
        setError(data.error ?? "Error al cargar sesiones");
        return;
      }
      setSessions(data.sessions ?? []);
    } catch {
      setError("Error de red al cargar sesiones");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadSessions(); }, [loadSessions]);

  const revokeSession = async (id: string) => {
    setRevoking(id);
    try {
      const res = await fetch(`/api/socialflow/sessions/${id}`, { method: "DELETE" });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (data.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== id));
      } else {
        setError(data.error ?? "Error al cerrar sesión");
      }
    } catch {
      setError("Error de red al cerrar sesión");
    } finally {
      setRevoking(null);
    }
  };

  const revokeAll = async () => {
    const others = sessions.slice(1);
    for (const s of others) {
      await revokeSession(s.id);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-400">Socialcors · Cuenta</p>
        <h1 className="mt-1.5 text-2xl font-black tracking-tight text-white">Sesiones activas</h1>
        <p className="mt-1.5 max-w-xl text-sm text-white/50">
          Sesiones abiertas en tu cuenta. Cierra cualquiera que no reconozcas.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-white/8 bg-white/5" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-xl border border-white/8 bg-white/4 px-6 py-10 text-center">
          <p className="text-sm font-medium text-white/45">Sin sesiones activas registradas.</p>
          <p className="mt-1 text-xs text-white/25">Las sesiones aparecen aquí cuando inicias sesión.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.length > 1 && (
            <div className="flex justify-end">
              <button
                onClick={revokeAll}
                disabled={revoking !== null}
                className="rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-1.5 text-[11px] font-semibold text-red-300 transition hover:border-red-500/30 hover:bg-red-500/12 disabled:opacity-40"
              >
                Cerrar todas las demás
              </button>
            </div>
          )}

          <div className="divide-y divide-white/6 overflow-hidden rounded-xl border border-white/8 bg-white/4">
            {sessions.map((s, idx) => (
              <div key={s.id} className="flex items-center justify-between px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex-shrink-0">
                    <div className={`h-2 w-2 rounded-full ${idx === 0 ? "bg-emerald-400" : "bg-white/20"}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white/85">
                        {idx === 0 ? "Esta sesión" : "Otra sesión"}
                      </span>
                      {idx === 0 && (
                        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                          ACTUAL
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-white/35">
                      Iniciada {relativeTime(s.issued_at)} · {expiresLabel(s.expires_at)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => revokeSession(s.id)}
                  disabled={revoking !== null}
                  className={`ml-4 flex-shrink-0 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition disabled:opacity-40 ${
                    idx === 0
                      ? "border-white/10 bg-white/5 text-white/55 hover:border-red-500/30 hover:bg-red-500/8 hover:text-red-400"
                      : "border-red-500/20 bg-red-500/8 text-red-300 hover:bg-red-500/15"
                  }`}
                >
                  {revoking === s.id ? "Cerrando…" : idx === 0 ? "Cerrar sesión" : "Revocar"}
                </button>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-white/30">
            {sessions.length} sesión{sessions.length !== 1 ? "es" : ""} activa
            {sessions.length > 1 && " — la primera es la sesión actual de este navegador"}.
          </p>
        </div>
      )}
    </div>
  );
}
