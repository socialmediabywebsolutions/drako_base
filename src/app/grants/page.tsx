"use client";
import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Select from "@/components/ui/select";
import { TextInput } from "@/components/ui/input";
import { TableWrap, Table, THead, TBody, TH, TD } from "@/components/ui/table";
import EmptyState from "@/components/ui/empty-state";

type Grant = {
  id: string;
  title: string;
  region: string | null;
  deadline: string | null;
  budget_cents: number | null;
  requirements: string | null;
  link: string | null;
  status: string;
  created_at: string;
};

export default function GrantsPage() {
  const [items, setItems] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("");

  // form state
  const [title, setTitle] = useState("");
  const [region, setRegion] = useState("");
  const [deadline, setDeadline] = useState("");
  const [budget, setBudget] = useState<number>(0);
  const [requirements, setRequirements] = useState("");
  const [link, setLink] = useState("");
  const [gstatus, setGStatus] = useState("new");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = status ? `?status=${encodeURIComponent(status)}` : "";
      const res = await fetch(`/api/grants${q}`, { cache: "no-store" });
      const data = (await res.json()) as { items?: Grant[] };
      setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-6">
      <Card
        tone="glass"
        title="Ayudas y subvenciones"
        subtitle="Explora, registra y actualiza oportunidades de financiación"
        right={
          <div className="flex gap-2 items-center">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos</option>
              <option value="new">nuevo</option>
              <option value="candidate">candidato</option>
              <option value="submitted">enviado</option>
              <option value="won">ganado</option>
              <option value="lost">perdido</option>
            </Select>
            <Button variant="outline" onClick={() => setStatus("")}>Limpiar</Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <TextInput placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
          <TextInput placeholder="Región" value={region} onChange={(e) => setRegion(e.target.value)} />
          <TextInput placeholder="Fecha límite (YYYY-MM-DD)" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          <TextInput placeholder="Presupuesto (centavos)" type="number" value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
          <TextInput placeholder="Enlace" value={link} onChange={(e) => setLink(e.target.value)} />
          <Select value={gstatus} onChange={(e) => setGStatus(e.target.value)}>
            <option value="new">nuevo</option>
            <option value="candidate">candidato</option>
            <option value="submitted">enviado</option>
            <option value="won">ganado</option>
            <option value="lost">perdido</option>
          </Select>
          <TextInput className="md:col-span-2" placeholder="Requisitos" value={requirements} onChange={(e) => setRequirements(e.target.value)} />
          <div className="md:col-span-2 flex gap-2">
            <Button
              onClick={async () => {
                if (!title) return;
                await fetch("/api/grants", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    title,
                    region: region || null,
                    deadline: deadline || null,
                    budget_cents: Number.isFinite(budget) ? budget : null,
                    requirements: requirements || null,
                    link: link || null,
                    status: gstatus,
                  }),
                });
                setTitle(""); setRegion(""); setDeadline(""); setBudget(0); setRequirements(""); setLink(""); setGStatus("new");
                void load();
              }}
            >Guardar</Button>
            <Button variant="outline" onClick={() => { setTitle(""); setRegion(""); setDeadline(""); setBudget(0); setRequirements(""); setLink(""); setGStatus("new"); }}>Limpiar</Button>
          </div>
        </div>
      </Card>

      <Card title="Pipeline" subtitle="Ayudas registradas">
        {loading ? (
          <div className="text-sm text-[var(--muted)]">Cargando...</div>
        ) : items.length === 0 ? (
          <EmptyState title="Sin ayudas" subtitle="Registra una oportunidad para comenzar" />
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH>Creado</TH>
                  <TH>Título</TH>
                  <TH>Región</TH>
                  <TH>Fecha límite</TH>
                  <TH>Presupuesto (€)</TH>
                  <TH>Estado</TH>
                  <TH>Enlace</TH>
                </tr>
              </THead>
              <TBody>
                {items.map((g) => (
                  <tr key={g.id}>
                    <TD>{new Date(g.created_at).toLocaleString()}</TD>
                    <TD className="font-medium">{g.title}</TD>
                    <TD>{g.region ?? "-"}</TD>
                    <TD>{g.deadline ?? "-"}</TD>
                    <TD>{g.budget_cents != null ? (g.budget_cents / 100).toFixed(2) : "-"}</TD>
                    <TD>{g.status}</TD>
                    <TD>{g.link ? <a className="text-[var(--brand)] hover:underline" href={g.link} target="_blank">abrir</a> : "-"}</TD>
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
