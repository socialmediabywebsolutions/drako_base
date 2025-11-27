"use client";
import { useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import { TextInput } from "@/components/ui/input";
import EmptyState from "@/components/ui/empty-state";

export default function SaasCreatePage() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [domain, setDomain] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name || !slug) {
      setError("Nombre y slug son obligatorios");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/saas", { method: "POST", body: JSON.stringify({ name, slug, domain: domain || null }), headers: { "content-type": "application/json" } });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "No se pudo crear el SaaS");
      }
      window.location.href = "/saas";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card tone="glass" title="Nuevo SaaS" subtitle="Provisiona un proyecto con gobernanza base" right={<Link href="/saas"><Button variant="outline">Volver</Button></Link>}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <TextInput placeholder="Nombre comercial" value={name} onChange={(e) => setName(e.target.value)} />
            <TextInput placeholder="Slug (sin espacios)" value={slug} onChange={(e) => setSlug(e.target.value)} />
            <TextInput placeholder="Dominio (opcional)" value={domain} onChange={(e) => setDomain(e.target.value)} />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-2">
              <Button onClick={handleCreate} loading={creating}>Crear SaaS</Button>
              <Button variant="outline" onClick={() => { setName(""); setSlug(""); setDomain(""); }}>Limpiar</Button>
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--panel)]/60 p-4 space-y-2 text-sm text-[var(--muted)]">
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Checklist</p>
            <ul className="space-y-2">
              <li>• DRĀKO creará alertas y timeline de provisión automáticamente.</li>
              <li>• Los agentes base se clonarán en cuestión de segundos.</li>
              <li>• El Chat Orquestador tendrá contexto inmediato del nuevo SaaS.</li>
            </ul>
          </div>
        </div>
      </Card>

      <EmptyState title="¿Qué ocurre tras crear el SaaS?" subtitle="El orquestador coordina DNS, Cloudflare Pages y agentes IA. Puedes supervisarlo desde la lista principal." />
    </div>
  );
}
