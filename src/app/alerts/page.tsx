"use client";
import { useEffect, useState } from "react";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Badge from "@/components/ui/badge";
import Select from "@/components/ui/select";
import { TextInput } from "@/components/ui/input";
import EmptyState from "@/components/ui/empty-state";

type Alert = { id: string; severity: string; source: string; message: string; created_at: string };

export default function AlertsPage() {
  const [items, setItems] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState("info");
  const [source, setSource] = useState("Consola");
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/alerts", { cache: "no-store" });
      const data = (await res.json()) as { items?: Alert[] };
      setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  return (
    <div className="space-y-6">
      <Card tone="glass" title="Alertas del sistema" subtitle="Registra incidentes y coordina la respuesta">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3" aria-label="Formulario de altas de alertas">
          <Select aria-label="Severidad" value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="info">Informativa</option>
            <option value="warning">Aviso</option>
            <option value="error">Crítica</option>
          </Select>
          <TextInput aria-label="Origen" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Origen (p. ej. Ingeniería)" />
          <TextInput aria-label="Mensaje" className="md:col-span-2" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe la alerta" />
          <Button
            onClick={async () => {
              if (!message) return;
              await fetch("/api/alerts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ severity, source, message }) });
              setMessage("");
              void load();
            }}
          >Registrar alerta</Button>
        </div>
      </Card>

      <Card title="Histórico" subtitle="Últimas alertas registradas">
        {loading ? (
          <div className="text-sm text-[var(--muted)]">Cargando...</div>
        ) : items.length === 0 ? (
          <EmptyState title="Sin alertas" subtitle="Crea una alerta para comenzar" />
        ) : (
          <div className="space-y-3" role="list" aria-label="Histórico de alertas">
            {items.map((a) => (
              <div key={a.id} className="rounded-2xl border border-[var(--border)]/70 bg-[var(--panel)]/70 p-4 flex items-center justify-between" role="listitem" aria-live="polite">
                <div>
                  <p className="text-sm font-semibold">{a.message}</p>
                  <p className="text-xs text-[var(--muted)]">{a.source} • {new Date(a.created_at).toLocaleString()}</p>
                </div>
                {a.severity === "warning" ? (
                  <Badge variant="warn">aviso</Badge>
                ) : a.severity === "error" ? (
                  <Badge variant="err">crítica</Badge>
                ) : (
                  <Badge>info</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
