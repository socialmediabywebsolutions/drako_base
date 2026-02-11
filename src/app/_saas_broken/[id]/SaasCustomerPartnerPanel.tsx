"use client";

import { useEffect, useMemo, useState } from "react";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import Card from "@/components/ui/card";
import type { CustomerPartnerSuggestion, CustomerPartnerSnapshotResult } from "@/lib/agents/customer-partner";

type Props = {
  customerId: string;
  saasId: string;
  onClose: () => void;
};

function SuggestionsGroup({ title, items }: { title: string; items: CustomerPartnerSuggestion[] }) {
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Sin recomendaciones</p>
      ) : (
        items.map((item, idx) => (
          <div key={`${title}-${idx}`} className="rounded-lg border border-[var(--border)]/60 bg-[var(--panel-alt)] p-3 text-sm">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{item.title}</p>
              <Badge variant={item.priority === "HIGH" ? "err" : item.priority === "MEDIUM" ? "warn" : "ok"}>{item.priority}</Badge>
            </div>
            <p className="mt-1 text-[var(--muted)]">{item.description}</p>
          </div>
        ))
      )}
    </div>
  );
}

export default function SaasCustomerPartnerPanel({ customerId, saasId, onClose }: Props) {
  const [data, setData] = useState<CustomerPartnerSnapshotResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/customers/${encodeURIComponent(customerId)}/partner?saasId=${encodeURIComponent(saasId)}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { message?: string } | null;
          throw new Error(body?.message ?? "No se pudo cargar el partner");
        }
        const json = (await res.json()) as CustomerPartnerSnapshotResult;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "No se pudo cargar el partner");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [customerId, saasId]);

  const snapshot = data?.snapshot;
  const suggestionGroups = useMemo(
    () =>
      data
        ? [
            { title: "Ideas de estilo y color", items: [...data.suggestions.STYLE, ...data.suggestions.COLOR] },
            { title: "Inventario y viabilidad", items: data.suggestions.INVENTORY },
            { title: "Fidelizacion y siguiente visita", items: [...data.suggestions.LOYALTY, ...data.suggestions.SCHEDULING] },
          ]
        : [],
    [data],
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur">
      <div className="relative flex h-full w-full max-w-3xl flex-col overflow-y-auto bg-[var(--panel)] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] pb-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Customer Partner</p>
            <h2 className="text-xl font-semibold">{snapshot?.customer.fullName ?? "Cliente"}</h2>
            {snapshot?.vipLevel && <Badge variant={snapshot.vipLevel === "VVIP" ? "err" : snapshot.vipLevel === "VIP" ? "ok" : "neutral"}>{snapshot.vipLevel}</Badge>}
            {error && <p className="text-sm text-red-300">{error}</p>}
            {loading && <p className="text-sm text-[var(--muted)]">Cargando partner...</p>}
          </div>
          <Button variant="ghost" onClick={onClose} aria-label="Cerrar partner">
            Cerrar
          </Button>
        </div>

        {snapshot && !loading && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card tone="glass" title="Valor" subtitle="LTV estimado">
                <p className="text-2xl font-semibold">{snapshot.estimatedLtv.toFixed(0)} €</p>
                <p className="text-xs text-[var(--muted)]">Basado en historial de visitas</p>
              </Card>
              <Card tone="glass" title="Favoritos" subtitle="Servicios top">
                <div className="space-y-1 text-sm">
                  {snapshot.favoriteServices.length === 0 ? (
                    <p className="text-[var(--muted)]">Sin historico suficiente</p>
                  ) : (
                    snapshot.favoriteServices.map((service) => (
                      <div key={service.serviceId} className="flex items-center justify-between">
                        <span>{service.name}</span>
                        <span className="text-[var(--muted)]">{service.count}x</span>
                      </div>
                    ))
                  )}
                </div>
              </Card>
              <Card tone="glass" title="Inventario" subtitle="Alertas clave">
                <div className="space-y-1 text-sm">
                  {snapshot.inventoryWarningsRelevant.length === 0 ? (
                    <p className="text-[var(--muted)]">Sin alertas</p>
                  ) : (
                    snapshot.inventoryWarningsRelevant.slice(0, 3).map((item) => (
                      <div key={`${item.serviceId}-${item.inventoryItemId}`} className="flex items-center justify-between">
                        <span>{item.name}</span>
                        <Badge variant="warn">LOW</Badge>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>

            {suggestionGroups.map((group) => (
              <SuggestionsGroup key={group.title} title={group.title} items={group.items} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
