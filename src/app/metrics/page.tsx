"use client";
import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import { TextInput } from "@/components/ui/input";
import { TableWrap, Table, THead, TBody, TH, TD } from "@/components/ui/table";
import EmptyState from "@/components/ui/empty-state";

type Metric = { id: number; scope: string; token_count: number; ai_cost_cents: number; roi: number; captured_at: string };

export default function MetricsPage() {
  const [items, setItems] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<string>("");
  const [mScope, setMScope] = useState<string>("todos");
  const [tokens, setTokens] = useState<number>(0);
  const [cost, setCost] = useState<number>(0);
  const [roi, setRoi] = useState<number>(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = scope ? `?scope=${encodeURIComponent(scope)}` : "";
      const res = await fetch(`/api/metrics${q}`, { cache: "no-store" });
      const data = (await res.json()) as { items?: Metric[] };
      setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-6">
      <Card
        tone="glass"
        title="Métricas IA"
        subtitle="Registra tokens, coste y ROI por scope"
        right={
          <div className="flex gap-2 items-center">
            <TextInput aria-label="Filtrar por scope" placeholder="Filtrar por scope (p. ej.: saas:ID)" value={scope} onChange={(e) => setScope(e.target.value)} />
            <Button variant="outline" onClick={() => setScope("")}>Limpiar</Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3" aria-label="Formulario de métricas">
          <TextInput aria-label="Scope" placeholder="Scope" value={mScope} onChange={(e) => setMScope(e.target.value)} />
          <TextInput aria-label="Tokens" type="number" placeholder="Tokens" value={tokens} onChange={(e) => setTokens(Number(e.target.value))} />
          <TextInput aria-label="Coste" type="number" placeholder="Coste (cent)" value={cost} onChange={(e) => setCost(Number(e.target.value))} />
          <TextInput aria-label="ROI" type="number" step="0.01" placeholder="ROI" value={roi} onChange={(e) => setRoi(Number(e.target.value))} />
          <Button
            onClick={async () => {
              await fetch("/api/metrics", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scope: mScope, token_count: tokens, ai_cost_cents: cost, roi }) });
              void load();
            }}
          >Registrar</Button>
        </div>
      </Card>

      <Card title="Histórico" subtitle={scope ? `Filtrado por: ${scope}` : "Todas las métricas"}>
        {loading ? (
          <div className="text-sm text-[var(--muted)]">Cargando...</div>
        ) : items.length === 0 ? (
          <EmptyState title="Sin métricas" subtitle="Inserta una métrica para comenzar" />
        ) : (
          <TableWrap>
            <Table aria-label="Tabla de métricas registradas">
              <THead>
                <tr>
                  <TH>Captura</TH>
                  <TH>Scope</TH>
                  <TH>Tokens</TH>
                  <TH>Coste (€)</TH>
                  <TH>ROI</TH>
                </tr>
              </THead>
              <TBody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <TD>{new Date(r.captured_at).toLocaleString()}</TD>
                    <TD>{r.scope}</TD>
                    <TD>{r.token_count}</TD>
                    <TD>{(r.ai_cost_cents / 100).toFixed(2)}</TD>
                    <TD>{r.roi.toFixed(2)}</TD>
                  </tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
