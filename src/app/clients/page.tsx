"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import { TextInput } from "@/components/ui/input";
import EmptyState from "@/components/ui/empty-state";

type Client = {
  id: string;
  owner_id: string;
  name: string;
  nif: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  created_at: string;
};

type ClientLink = {
  id: string;
  client_id: string;
  saas_id: string;
  created_at: string;
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [links, setLinks] = useState<ClientLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [nif, setNif] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [clientsRes, linksRes, ownerRes] = await Promise.all([
        fetch("/api/clients", { cache: "no-store" }),
        fetch("/api/client-saas", { cache: "no-store" }),
        fetch("/api/owners", { cache: "no-store" }),
      ]);
      const clientsData = (await clientsRes.json()) as { items?: Client[] };
      const linksData = (await linksRes.json()) as { items?: ClientLink[] };
      const ownersData = (await ownerRes.json()) as { items?: { id: string }[] };
      setClients(clientsData.items ?? []);
      setLinks(linksData.items ?? []);
      setOwnerId(ownersData.items?.[0]?.id ?? null);
    } catch (error) {
      console.error(error);
      setMessage("No se pudieron cargar los clientes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const saasCountByClient = useMemo(() => {
    return links.reduce<Record<string, number>>((acc, link) => {
      acc[link.client_id] = (acc[link.client_id] ?? 0) + 1;
      return acc;
    }, {});
  }, [links]);

  const lastActivityByClient = useMemo(() => {
    return links.reduce<Record<string, string>>((acc, link) => {
      const current = acc[link.client_id];
      if (!current || new Date(link.created_at).getTime() > new Date(current).getTime()) {
        acc[link.client_id] = link.created_at;
      }
      return acc;
    }, {});
  }, [links]);

  const handleCreate = useCallback(async () => {
    if (!ownerId) {
      setMessage("Primero configura el owner antes de crear clientes.");
      return;
    }
    if (!name.trim()) {
      setMessage("El nombre del cliente es obligatorio.");
      return;
    }
    setMessage(null);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          owner_id: ownerId,
          name: name.trim(),
          nif: nif || null,
          email: email || null,
          phone: phone || null,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok === false) {
        throw new Error(data.error ?? "No se pudo crear el cliente");
      }
      setName("");
      setNif("");
      setEmail("");
      setPhone("");
      setFormVisible(false);
      setMessage("Cliente creado correctamente.");
      await loadData();
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "Error al crear cliente");
    }
  }, [email, loadData, name, nif, ownerId, phone]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">Administración</p>
          <h1 className="text-3xl font-semibold">Clientes</h1>
          <p className="text-sm text-[var(--muted)]">Gestiona tus clientes y SaaS vinculados.</p>
        </div>
        <Button onClick={() => setFormVisible((prev) => !prev)}>
          {formVisible ? "Cerrar" : "Nuevo cliente"}
        </Button>
      </div>

      {formVisible && (
        <Card tone="glass" title="Nuevo cliente" subtitle="Registra un cliente asociado al owner">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">Nombre</span>
              <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Clínica Demo" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">NIF / CIF</span>
              <TextInput value={nif} onChange={(e) => setNif(e.target.value)} placeholder="B12345678" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">Email</span>
              <TextInput value={email} onChange={(e) => setEmail(e.target.value)} placeholder="facturacion@empresa.com" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">Teléfono</span>
              <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+34 600 000 000" />
            </label>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-[var(--muted)]">Los clientes se asignan al owner principal de DRĀKO BASE.</span>
            <Button onClick={() => void handleCreate()}>Guardar</Button>
          </div>
        </Card>
      )}

      {message && <p className="text-sm text-[var(--muted)]">{message}</p>}

      <Card tone="glass" title="Listado de clientes" subtitle="Selecciona un cliente para ver sus SaaS">
        {loading ? (
          <p className="text-sm text-[var(--muted)]">Cargando clientes...</p>
        ) : clients.length === 0 ? (
          <EmptyState title="Sin registros" subtitle="Crea tu primer cliente para comenzar" />
        ) : (
          <div className="overflow-x-auto">
            <table className="modern text-sm w-full" aria-label="Listado de clientes">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>NIF</th>
                  <th>Email</th>
                  <th>Teléfono</th>
                  <th>SaaS vinculados</th>
                  <th>Última actividad</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id}>
                    <td className="font-semibold text-[var(--foreground)]">{client.name}</td>
                    <td>{client.nif ?? "–"}</td>
                    <td>{client.email ?? "–"}</td>
                    <td>{client.phone ?? "–"}</td>
                    <td>{saasCountByClient[client.id] ?? "–"}</td>
                    <td>{lastActivityByClient[client.id] ? new Date(lastActivityByClient[client.id]).toLocaleDateString() : "—"}</td>
                    <td>
                      <Link href={`/clients/${client.id}`} className="text-[var(--brand)] text-sm font-semibold">
                        Ver ficha
                      </Link>
                    </td>
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
