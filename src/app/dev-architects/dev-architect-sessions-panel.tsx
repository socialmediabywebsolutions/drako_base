"use client";

import { useEffect, useState } from "react";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import Card from "@/components/ui/card";
import { parseAuditSummary } from "@/lib/dev-architects/audit";
import type { DevArchitectSession } from "@/lib/dev-architects/types";

type DevArchitectSessionsPanelProps = {
  open: boolean;
  projectId?: string | null;
  projectName?: string | null;
  onClose: () => void;
};

type SessionsResponse = {
  items?: DevArchitectSession[];
};

function formatDateTime(value?: string | null) {
  if (!value) return "Sin registros";
  try {
    return new Date(value).toLocaleString("es-ES", { hour12: false });
  } catch {
    return value;
  }
}

export default function DevArchitectSessionsPanel({ open, projectId, projectName, onClose }: DevArchitectSessionsPanelProps) {
  const [sessions, setSessions] = useState<DevArchitectSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (!projectId) {
      setSessions([]);
      setSelectedId(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const fetchSessions = async () => {
      try {
        const query = new URLSearchParams({ projectId });
        const res = await fetch(`/api/dev-architects/sessions?${query.toString()}`, { cache: "no-store" });
        if (!res.ok) throw new Error("No se pudieron cargar las sesiones");
        const data = (await res.json()) as SessionsResponse;
        if (cancelled) return;
        const items = data.items ?? [];
        setSessions(items);
        setSelectedId((prev) => {
          if (prev && items.some((session) => session.id === prev)) return prev;
          return items[0]?.id ?? null;
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error sincronizando bitácora");
          setSessions([]);
          setSelectedId(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void fetchSessions();
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  useEffect(() => {
    if (!open) {
      setSelectedId(null);
      return;
    }
    if (!selectedId && sessions.length > 0) {
      setSelectedId(sessions[0].id);
    }
  }, [open, selectedId, sessions]);

  if (!open) return null;

  const selectedSession = sessions.find((session) => session.id === selectedId) ?? null;
  const selectedAudit = selectedSession ? parseAuditSummary(selectedSession.summary) : null;
  const okCount = selectedAudit ? selectedAudit.rules.filter((rule) => rule.status === "ok").length : 0;
  const pendingCount = selectedAudit ? selectedAudit.rules.filter((rule) => rule.status !== "ok").length : 0;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <button
        type="button"
        aria-label="Cerrar bitácora"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-50 w-full max-w-6xl px-4 py-6">
        <Card
          tone="glass"
          title="Bitácora DevArchitect"
          subtitle={projectName ? `Sesiones para ${projectName}` : "Sin proyecto seleccionado"}
          actions={<Button variant="outline" size="sm" onClick={onClose}>Cerrar</Button>}
          bodyClassName="space-y-4"
        >
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <section className="rounded-2xl border border-[var(--border)]/40 bg-[var(--panel)]/60 p-3">
              {loading ? (
                <p className="text-sm text-[var(--muted)]">Cargando sesiones...</p>
              ) : sessions.length === 0 ? (
                <div className="space-y-2 text-sm text-[var(--muted)]">
                  <p>No se encontraron sesiones para este proyecto.</p>
                  <p>Ejecuta <code className="font-mono text-xs">npm run devarchitect:audit</code> para generar la primera auditoría.</p>
                </div>
              ) : (
                <ul className="space-y-2 overflow-y-auto max-h-[70vh] pr-1">
                  {sessions.map((session) => {
                    const parsed = parseAuditSummary(session.summary);
                    const sessionOk = parsed ? parsed.statusGlobal === "OK" : null;
                    const auditOkCount = parsed ? parsed.rules.filter((rule) => rule.status === "ok").length : 0;
                    const auditPendingCount = parsed ? parsed.rules.filter((rule) => rule.status !== "ok").length : 0;
                    const isSelected = selectedId === session.id;
                    return (
                      <li key={session.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(session.id)}
                          className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                            isSelected
                              ? "border-[var(--brand)] bg-[var(--brand-quiet)]/30"
                              : "border-[var(--border)]/60 bg-[var(--panel)]/80 hover:border-[var(--brand)]/60"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold">{session.title}</p>
                            <Badge variant={session.mode === "Audit" ? "warn" : "info"}>
                              {session.mode}
                            </Badge>
                          </div>
                          <p className="text-xs text-[var(--muted)]">{formatDateTime(session.last_interaction_at)}</p>
                          {parsed ? (
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                              <Badge variant={sessionOk ? "ok" : "warn"}>
                                {sessionOk ? "OK" : "WARNING"}
                              </Badge>
                              <span>{auditOkCount} OK · {auditPendingCount} Pending</span>
                            </div>
                          ) : (
                            <p className="mt-2 text-xs text-[var(--muted)]">Sesión sin resumen estructurado.</p>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-[var(--border)]/40 bg-[var(--panel)]/80 p-4 space-y-4">
              {!selectedSession ? (
                <p className="text-sm text-[var(--muted)]">Selecciona una sesión para ver el detalle.</p>
              ) : selectedAudit ? (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold">{selectedSession.title}</h3>
                    <Badge variant={selectedAudit.statusGlobal === "OK" ? "ok" : "warn"}>
                      {selectedAudit.statusGlobal}
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--muted)]">Última interacción: {formatDateTime(selectedSession.last_interaction_at)}</p>
                  <div className="text-xs text-[var(--muted)]">
                    <span className="font-semibold text-[var(--foreground)]">{okCount} reglas OK</span>
                    <span className="mx-2 text-[var(--muted)]">·</span>
                    <span className="font-semibold text-amber-400">{pendingCount} pendientes</span>
                  </div>
                  <div className="space-y-3">
                    {selectedAudit.rules.map((rule) => (
                      <div key={rule.key} className="rounded-xl border border-[var(--border)]/60 bg-[var(--background-alt)]/50 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold">{rule.label}</p>
                          <Badge variant={rule.status === "ok" ? "ok" : "warn"}>
                            {rule.status === "ok" ? "OK" : "Pending"}
                          </Badge>
                        </div>
                        {rule.notes && rule.notes.length > 0 && (
                          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-[var(--muted)]">
                            {rule.notes.map((note, index) => (
                              <li key={`${rule.key}-note-${index}`}>{note}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold">{selectedSession.title}</h3>
                  <p className="text-sm text-[var(--muted)]">
                    Esta sesión no tiene un resumen de auditoría. Registra notas manuales o ejecuta una nueva auditoría OLIMPO.
                  </p>
                </>
              )}
            </section>
          </div>
        </Card>
      </div>
    </div>
  );
}
