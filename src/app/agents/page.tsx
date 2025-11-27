"use client";
import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Select from "@/components/ui/select";
import { TextInput } from "@/components/ui/input";
import Badge from "@/components/ui/badge";

type Department = { id: string; name: string };
type Agent = { id: string; name: string; department_id: string; provider: string | null; model: string | null; active: number; created_at: string };

export default function AgentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [items, setItems] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDept, setFilterDept] = useState<string>("");

  // form
  const [name, setName] = useState("");
  const [dept, setDept] = useState<string>("");
  const [provider, setProvider] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [active, setActive] = useState<boolean>(true);

  const loadDepts = useCallback(async () => {
    const res = await fetch("/api/departments", { cache: "no-store" });
    const data = (await res.json()) as { items?: Department[] };
    setDepartments(data.items ?? []);
  }, []);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      const q = filterDept ? `?department_id=${encodeURIComponent(filterDept)}` : "";
      const res = await fetch(`/api/agents${q}`, { cache: "no-store" });
      const data = (await res.json()) as { items?: Agent[] };
      setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [filterDept]);

  useEffect(() => { void loadDepts(); }, [loadDepts]);
  useEffect(() => { void loadAgents(); }, [loadAgents]);

  return (
    <div className="space-y-6">
      <Card
        tone="glass"
        title="Agentes IA base"
        subtitle="Configura roles y modelos por departamento"
        right={
          <div className="flex gap-2 items-center">
            <Select aria-label="Filtrar por departamento" value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
              <option value="">Todos los departamentos</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
            <Button variant="outline" onClick={() => setFilterDept("")}>Limpiar</Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <TextInput aria-label="Nombre del agente" placeholder="Nombre del agente" value={name} onChange={(e) => setName(e.target.value)} />
          <Select aria-label="Departamento del agente" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">Selecciona departamento</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>
          <TextInput aria-label="Proveedor" placeholder="Proveedor (fireworks, deepseek, gemini)" value={provider} onChange={(e) => setProvider(e.target.value)} />
          <TextInput aria-label="Modelo" placeholder="Modelo" value={model} onChange={(e) => setModel(e.target.value)} />
          <label className="flex items-center gap-2 text-sm text-[var(--muted)] md:col-span-2" htmlFor="agent-active">
            <input id="agent-active" type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Agente activo
          </label>
          <div className="md:col-span-2 flex gap-2">
            <Button
              onClick={async () => {
                if (!name || !dept) return;
                await fetch("/api/agents", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ name, department_id: dept, provider: provider || null, model: model || null, active }),
                });
                setName(""); setDept(""); setProvider(""); setModel(""); setActive(true);
                void loadAgents();
              }}
            >Registrar agente</Button>
            <Button variant="outline" onClick={() => { setName(""); setDept(""); setProvider(""); setModel(""); setActive(true); }}>Limpiar</Button>
          </div>
        </div>
      </Card>

      <Card title="Listado operativo" subtitle={filterDept ? `Filtrando por: ${departments.find((d)=>d.id===filterDept)?.name ?? filterDept}` : "Todos los agentes"}>
        {loading ? (
          <div className="text-sm text-[var(--muted)]">Cargando...</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-[var(--muted)]">No hay agentes registrados.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" role="list" aria-label="Agentes IA">
            {items.map((a) => (
              <section key={a.id} className="rounded-2xl border border-[var(--border)]/70 bg-[var(--panel)]/70 p-4 space-y-2" role="listitem" aria-live="polite">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{a.name}</h3>
                  {a.active ? <Badge>activo</Badge> : <Badge variant="warn">pausado</Badge>}
                </div>
                <p className="text-sm text-[var(--muted)]">Depto: {departments.find((d) => d.id === a.department_id)?.name ?? a.department_id}</p>
                <p className="text-xs text-[var(--muted)]">Proveedor: {a.provider ?? "-"} • Modelo: {a.model ?? "-"}</p>
                <p className="text-xs text-[var(--muted)]">Desde: {new Date(a.created_at).toLocaleDateString()}</p>
              </section>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
