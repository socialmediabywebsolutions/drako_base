"use client";

import { useCallback, useMemo, useState } from "react";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/input";

type OrchestratorReply = {
  intent: string;
  summary: string;
  facts: unknown;
  evidence: unknown | null;
  snapshotKpis: {
    totalMRR: number;
    totalSaas: number;
    vendorFixedMonthly: number;
    approxMarginMonthly: number;
    approxMarginRate: number;
    activeSubscriptions?: number;
  };
};

export default function CampamentoBaseOrchestratorChatPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthError, setIsAuthError] = useState(false);
  const [reply, setReply] = useState<OrchestratorReply | null>(null);

  const suggestions = useMemo(
    () => [
      { q: "evolución 30 días", label: "Evolución 30d" },
      { q: "mejor saas", label: "Mejor SaaS" },
      { q: "alertas críticas", label: "Alertas" },
      { q: "qué revisar primero", label: "Prioridades" },
    ],
    [],
  );

  const ask = useCallback(async (text: string) => {
    const q = (text ?? "").trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setIsAuthError(false);
    setReply(null);
    try {
      const url = "/api/campamento-base/orchestrator?q=" + encodeURIComponent(q);
      const res = await fetch(url, { cache: "no-store", credentials: "include" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as any;
        const errMsg = String(body?.error ?? "");
        if (res.status === 401 || res.status === 403 || errMsg.includes("SESSION_REQUIRED")) {
          setIsAuthError(true);
          setError("Necesitas iniciar sesión como owner para usar el copiloto.");
          return;
        }
        throw new Error(errMsg || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as OrchestratorReply;
      setReply(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo contactar con el orquestador";
      if (msg.includes("SESSION_REQUIRED")) {
        setIsAuthError(true);
        setError("Necesitas iniciar sesión como owner para usar el copiloto.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const onSend = useCallback(() => ask(query), [ask, query]);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <Card title="ORQUESTADOR" subtitle="Campamento Base" tone="glass">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <Button key={s.q} size="sm" variant="secondary" onClick={() => ask(s.q)} disabled={loading}>
                {s.label}
              </Button>
            ))}
          </div>

          <Field>
            <TextInput
              placeholder="Escribe tu pregunta..."
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) onSend();
              }}
            />
            <Button className="ml-2" onClick={onSend} loading={loading} disabled={loading || !query.trim()}>
              Enviar
            </Button>
          </Field>

          {error && (
            <div className="text-red-600 text-sm space-y-2">
              <div>{error}</div>
              {isAuthError && (
                <a
                  href={`/auth/login?callbackUrl=${encodeURIComponent("/campamento-base/orchestrator")}`}
                  className="inline-block text-xs px-3 py-1.5 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent hover:border-slate-200"
                >
                  Iniciar sesión
                </a>
              )}
            </div>
          )}

          {loading && (
            <div className="text-slate-500 text-sm animate-pulse">Pensando...</div>
          )}

          {reply && (
            <div className="space-y-4">
              <div className="text-xs uppercase tracking-widest text-slate-500 font-black">INTENT</div>
              <div className="text-sm font-semibold">{reply.intent}</div>

              <div className="text-xs uppercase tracking-widest text-slate-500 font-black">RESPUESTA</div>
              <div className="whitespace-pre-wrap leading-relaxed">{reply.summary}</div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card title="KPIs" tone="default">
                  <div className="text-sm grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-xs text-slate-500">MRR</div>
                      <div className="font-semibold">€{Math.round(reply.snapshotKpis.totalMRR)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">SaaS</div>
                      <div className="font-semibold">{reply.snapshotKpis.totalSaas}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Coste Fijo</div>
                      <div className="font-semibold">€{Math.round(reply.snapshotKpis.vendorFixedMonthly)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Margen Aprox</div>
                      <div className="font-semibold">€{Math.round(reply.snapshotKpis.approxMarginMonthly)} ({Math.round(reply.snapshotKpis.approxMarginRate * 100)}%)</div>
                    </div>
                    {typeof reply.snapshotKpis.activeSubscriptions === "number" && (
                      <div className="col-span-2">
                        <div className="text-xs text-slate-500">Suscripciones Activas</div>
                        <div className="font-semibold">{reply.snapshotKpis.activeSubscriptions}</div>
                      </div>
                    )}
                  </div>
                </Card>

                <Card title="Datos" subtitle="Facts / Evidence" tone="default">
                  <div className="space-y-3 text-xs">
                    <div>
                      <div className="text-slate-500">Facts</div>
                      <pre className="bg-slate-50 border border-slate-200 p-3 rounded-xl overflow-auto max-h-64">
                        {JSON.stringify(reply.facts, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <div className="text-slate-500">Evidence</div>
                      <pre className="bg-slate-50 border border-slate-200 p-3 rounded-xl overflow-auto max-h-64">
                        {JSON.stringify(reply.evidence ?? {}, null, 2)}
                      </pre>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
