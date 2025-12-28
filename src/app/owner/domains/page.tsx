"use client";
import { useEffect, useState } from "react";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import { TextInput } from "@/components/ui/input";
import EmptyState from "@/components/ui/empty-state";

type DomainRow = {
  id: string;
  saas_id: string | null;
  domain: string;
  status: string;
  verification_status?: string | null;
  last_error?: string | null;
};

export default function DomainsPage() {
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newDomain, setNewDomain] = useState("");
  const [newSaas, setNewSaas] = useState("");

  async function loadDomains() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/owner/domains", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { domains?: DomainRow[] };
      setDomains(data.domains ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los dominios");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDomains();
  }, []);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-[var(--muted)]">Campamento Base · Admin</p>
          <h1 className="text-xl font-semibold">Dominios</h1>
        </div>
        <Button variant="secondary" onClick={loadDomains}>Recargar</Button>
      </div>

      <Card title="Agregar dominio" subtitle="Crea el mapping para un SaaS">
        <div className="grid gap-2 md:grid-cols-[2fr,1fr,auto]">
          <TextInput placeholder="dominio (ej. drako.systems)" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} />
          <TextInput placeholder="saas_id (opcional)" value={newSaas} onChange={(e) => setNewSaas(e.target.value)} />
          <Button
            onClick={async () => {
              setError(null);
              const res = await fetch("/api/owner/domains", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ domain: newDomain.trim(), saasId: newSaas || null }),
              });
              if (!res.ok) {
                setError("No se pudo crear el dominio");
                return;
              }
              setNewDomain("");
              setNewSaas("");
              await loadDomains();
            }}
          >
            Crear
          </Button>
        </div>
        <p className="text-xs text-[var(--muted)] mt-2">Úsalo para registrar drako.systems o base.drako.systems en local/staging.</p>
      </Card>

      <Card title="Listado de dominios" subtitle="Estado y verificación">
        {loading ? (
          <p className="text-sm text-[var(--muted)]">Cargando...</p>
        ) : error ? (
          <p className="text-sm text-rose-400">{error}</p>
        ) : domains.length === 0 ? (
          <EmptyState title="Sin dominios" subtitle="Crea el primero para mapear tu SaaS." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--muted)]">
                  <th className="py-2 pr-4">Dominio</th>
                  <th className="py-2 pr-4">SaaS</th>
                  <th className="py-2 pr-4">Estado</th>
                  <th className="py-2 pr-4">Verificación</th>
                  <th className="py-2 pr-4">Error</th>
                </tr>
              </thead>
              <tbody>
                {domains.map((d) => (
                  <tr key={d.id} className="border-t border-[var(--border)]/50">
                    <td className="py-2 pr-4 font-semibold">{d.domain}</td>
                    <td className="py-2 pr-4">{d.saas_id ?? "—"}</td>
                    <td className="py-2 pr-4">{d.status}</td>
                    <td className="py-2 pr-4">{d.verification_status ?? "—"}</td>
                    <td className="py-2 pr-4 text-rose-400">{d.last_error ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
