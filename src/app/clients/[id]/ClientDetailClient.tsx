"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Badge from "@/components/ui/badge";
import Select from "@/components/ui/select";
import { TextInput, TextArea } from "@/components/ui/input";
import EmptyState from "@/components/ui/empty-state";
import { setOrchestratorContext } from "@/lib/orchestrator-context";

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

type Saas = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

type ClientLink = {
  id: string;
  client_id: string;
  saas_id: string;
  status: string;
  plan: string | null;
};

type ClientSaasSubscriptionRecord = {
  id: string;
  saasId: string;
  planCode: string;
  status: string;
  currentPeriodEnd: number | null;
  updatedAt: string;
};

type ClientOverview = {
  clientId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  saas: Array<{
    saasId: string;
    name: string;
    verticalPack?: { id: string; label: string };
    keyMetrics: {
      marginPercent?: number;
      hrFairnessStatus?: "OK" | "WARNING" | "CRITICAL";
      employeesRoiStatus?: "HEALTHY" | "TIGHT" | "LOW_ACTIVITY";
      socialRoiStatus?: "GOOD" | "NEUTRAL" | "POOR";
    };
    tasksSummary?: { openTasks: number };
  }>;
};

type Invoice = {
  id: string;
  client_id: string;
  saas_id: string;
  number: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
  notes?: string | null;
};

type Ticket = {
  id: string;
  client_id: string;
  saas_id: string;
  subject: string;
  description?: string | null;
  status: string;
  priority: string;
  channel: string | null;
  created_at: string;
};

const invoiceStatusOptions = ["draft", "sent", "paid", "overdue", "cancelled"];
const ticketStatusOptions = ["open", "in_progress", "resolved", "closed"];
const ticketPriorityOptions = ["low", "normal", "high", "urgent"];
const subscriptionStatusVariant: Record<string, "ok" | "info" | "warn" | "err"> = {
  active: "ok",
  trialing: "info",
  past_due: "warn",
  canceled: "err",
  cancelled: "err",
};

type ClientDetailClientProps = {
  clientId: string;
};

export default function ClientDetailClient({ clientId }: ClientDetailClientProps) {
  const [client, setClient] = useState<Client | null>(null);
  const [saasLinks, setSaasLinks] = useState<ClientLink[]>([]);
  const [saasList, setSaasList] = useState<Saas[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [linking, setLinking] = useState(false);
  const [selectedSaas, setSelectedSaas] = useState<string>("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [invoiceAmount, setInvoiceAmount] = useState("0");
  const [invoiceCurrency, setInvoiceCurrency] = useState("EUR");
  const [invoiceStatus, setInvoiceStatus] = useState("draft");
  const [invoiceSaasId, setInvoiceSaasId] = useState<string>("");
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");
  const [ticketStatus, setTicketStatus] = useState("open");
  const [ticketPriority, setTicketPriority] = useState("normal");
  const [ticketSaasId, setTicketSaasId] = useState<string>("");
  const [saasSubscriptions, setSaasSubscriptions] = useState<ClientSaasSubscriptionRecord[]>([]);
  const [saasSubscriptionsLoading, setSaasSubscriptionsLoading] = useState(true);
  const [overview, setOverview] = useState<ClientOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  const saasNameMap = useMemo(() => {
    const map = new Map<string, string>();
    saasList.forEach((saas) => map.set(saas.id, saas.name));
    return map;
  }, [saasList]);

  const formatSubscriptionRenewal = useCallback((value: number | null) => {
    if (!value) return "Sin fecha";
    return new Date(value * 1000).toLocaleDateString();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [clientRes, saasRes] = await Promise.all([
        fetch(`/api/clients?id=${encodeURIComponent(clientId)}`, { cache: "no-store" }),
        fetch("/api/operator/saas", { cache: "no-store" }),
      ]);
      const clientData = (await clientRes.json()) as { items?: Client[] };
      const saasData = (await saasRes.json()) as { items?: Saas[] };
      setClient(clientData.items?.[0] ?? null);
      setSaasLinks([]);
      setSaasList(saasData.items ?? []);
    } catch (error) {
      console.error(error);
      setMessage("No se pudo cargar la ficha de cliente.");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  const loadInvoices = useCallback(async () => {
    setInvoicesLoading(true);
    try {
      const res = await fetch(`/api/invoices?client_id=${encodeURIComponent(clientId)}`, { cache: "no-store" });
      const data = (await res.json()) as { items?: Invoice[] };
      setInvoices(data.items ?? []);
    } catch (error) {
      console.error(error);
      setMessage("No se pudieron cargar las facturas.");
    } finally {
      setInvoicesLoading(false);
    }
  }, [clientId]);

  const loadTickets = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const res = await fetch(`/api/tickets?client_id=${encodeURIComponent(clientId)}`, { cache: "no-store" });
      const data = (await res.json()) as { items?: Ticket[] };
      setTickets(data.items ?? []);
    } catch (error) {
      console.error(error);
      setMessage("No se pudieron cargar los tickets.");
    } finally {
      setTicketsLoading(false);
    }
  }, [clientId]);

  const loadSaasSubscriptions = useCallback(async () => {
    setSaasSubscriptionsLoading(true);
    setSaasSubscriptions([]);
    setSaasSubscriptionsLoading(false);
  }, []);

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}/overview`, { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as ClientOverview | null;
      setOverview(data);
    } catch (error) {
      console.error(error);
      setOverview(null);
    } finally {
      setOverviewLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void loadData();
    void loadInvoices();
    void loadTickets();
    void loadSaasSubscriptions();
    void loadOverview();
  }, [loadData, loadInvoices, loadTickets, loadSaasSubscriptions, loadOverview]);

  useEffect(() => {
    if (!client) return;
    const totalAmount = invoices.reduce((acc, inv) => acc + inv.amount_cents, 0);
    const paid = invoices.filter((inv) => inv.status === "paid").length;
    const pending = invoices.filter((inv) => inv.status !== "paid" && inv.status !== "cancelled").length;
    const overdue = invoices.filter((inv) => inv.status === "overdue").length;
    const openTickets = tickets.filter((ticket) => ticket.status === "open" || ticket.status === "in_progress").length;
    const resolvedTickets = tickets.filter((ticket) => ticket.status === "resolved" || ticket.status === "closed").length;
    const highPriority = tickets.filter((ticket) => ticket.priority === "high" || ticket.priority === "urgent").length;
    setOrchestratorContext({
      scope: "client",
      client: {
        id: client.id,
        name: client.name,
        nif: client.nif ?? null,
        email: client.email ?? null,
        phone: client.phone ?? null,
      },
      billing: {
        total: invoices.length,
        paid,
        pending,
        overdue,
        amount_cents: totalAmount,
      },
      support: {
        total: tickets.length,
        open: openTickets,
        resolved: resolvedTickets,
        high_priority: highPriority,
      },
      detalle: {
        saas: saasLinks
          .map((link) => {
            const saas = saasList.find((s) => s.id === link.saas_id);
            if (!saas) return null;
            return { id: saas.id, name: saas.name, slug: saas.slug, status: saas.status };
          })
          .filter(Boolean) as { id: string; name: string; slug: string; status: string }[],
      },
    });
  }, [client, invoices, tickets, saasLinks, saasList]);

  const dominantPack = useMemo(() => {
    const counts = new Map<string, number>();
    overview?.saas.forEach((item) => {
      if (item.verticalPack?.label) {
        counts.set(item.verticalPack.label, (counts.get(item.verticalPack.label) ?? 0) + 1);
      }
    });
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] ?? null;
  }, [overview]);

  const overviewAlerts = useMemo(() => {
    return (
      overview?.saas.flatMap((item) => {
        const alerts: string[] = [];
        if (item.keyMetrics.hrFairnessStatus === "CRITICAL") {
          alerts.push(`Revisa HR en ${item.name} (Fairness crítica).`);
        }
        if (typeof item.keyMetrics.marginPercent === "number" && item.keyMetrics.marginPercent < 20) {
          alerts.push(`Margen bajo en ${item.name}. Ajusta precios o costes.`);
        }
        if (item.keyMetrics.socialRoiStatus === "POOR") {
          alerts.push(`Social ROI bajo en ${item.name}. Revisa campañas.`);
        }
        return alerts;
      }) ?? []
    );
  }, [overview]);

  useEffect(() => {
    return () => setOrchestratorContext(null);
  }, []);

  const handleSaveClient = useCallback(async () => {
    if (!client) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/clients", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: client.id,
          name: client.name,
          nif: client.nif,
          email: client.email,
          phone: client.phone,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok === false) {
        throw new Error(data.error ?? "No se pudo guardar el cliente");
      }
      setMessage("Cambios guardados.");
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }, [client]);

  const handleLinkSaas = useCallback(async () => {
    void client;
    void selectedSaas;
    setMessage("La vinculación desde /clients ahora debe hacerse desde operator; /api/client-saas fue deshabilitado.");
  }, [client, selectedSaas]);

  const linkedSaas = useMemo(() => {
    return saasLinks
      .map((link) => {
        const saas = saasList.find((s) => s.id === link.saas_id);
        if (!saas) return null;
        return { ...saas, linkId: link.id };
      })
      .filter(Boolean) as (Saas & { linkId: string })[];
  }, [saasLinks, saasList]);

  const invoicesBySaas = useMemo(() => {
    const map = new Map<string, Invoice[]>();
    for (const invoice of invoices) {
      const key = invoice.saas_id ?? "__none";
      map.set(key, [...(map.get(key) ?? []), invoice]);
    }
    return map;
  }, [invoices]);

  const ticketsBySaas = useMemo(() => {
    const map = new Map<string, Ticket[]>();
    for (const ticket of tickets) {
      const key = ticket.saas_id ?? "__none";
      map.set(key, [...(map.get(key) ?? []), ticket]);
    }
    return map;
  }, [tickets]);

  const findSaasLabel = useCallback(
    (saasId: string | null) => {
      if (!saasId) return "Sin SaaS específico";
      const saas = saasList.find((s) => s.id === saasId);
      return saas ? `${saas.name} (${saas.slug})` : "SaaS desconocido";
    },
    [saasList]
  );

  const handleCreateInvoice = useCallback(async () => {
    if (!client) {
      setMessage("Cliente no cargado.");
      return;
    }
    if (!invoiceSaasId) {
      setMessage("Selecciona un SaaS para la factura.");
      return;
    }
    const amountNumber = Number(invoiceAmount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setMessage("Introduce un importe válido.");
      return;
    }
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_id: client.id,
          saas_id: invoiceSaasId,
          amount_cents: Math.round(amountNumber * 100),
          currency: invoiceCurrency,
          status: invoiceStatus,
          notes: invoiceNotes || null,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok === false) {
        throw new Error(data.error ?? "No se pudo crear la factura");
      }
      setInvoiceAmount("0");
      setInvoiceNotes("");
      setInvoiceStatus("draft");
      await loadInvoices();
      setMessage("Factura creada correctamente.");
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "Error guardando factura");
    }
  }, [client, invoiceAmount, invoiceCurrency, invoiceNotes, invoiceSaasId, invoiceStatus, loadInvoices]);

  const handleUpdateInvoiceStatus = useCallback(
    async (invoiceId: string, status: string) => {
      try {
        const res = await fetch("/api/invoices", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: invoiceId, status }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (data.ok === false) {
          throw new Error(data.error ?? "No se pudo actualizar la factura");
        }
        await loadInvoices();
      } catch (error) {
        console.error(error);
        setMessage(error instanceof Error ? error.message : "Error actualizando factura");
      }
    },
    [loadInvoices]
  );

  const handleCreateTicket = useCallback(async () => {
    if (!client) {
      setMessage("Cliente no cargado.");
      return;
    }
    if (!ticketSubject.trim()) {
      setMessage("El título del ticket es obligatorio.");
      return;
    }
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_id: client.id,
          saas_id: ticketSaasId || null,
          subject: ticketSubject.trim(),
          description: ticketDescription || null,
          status: ticketStatus,
          priority: ticketPriority,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok === false) {
        throw new Error(data.error ?? "No se pudo crear el ticket");
      }
      setTicketSubject("");
      setTicketDescription("");
      setTicketStatus("open");
      setTicketPriority("normal");
      await loadTickets();
      setMessage("Ticket registrado.");
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "Error guardando ticket");
    }
  }, [client, loadTickets, ticketDescription, ticketPriority, ticketSaasId, ticketStatus, ticketSubject]);

  const handleUpdateTicketStatus = useCallback(
    async (ticketId: string, status: string) => {
      try {
        const res = await fetch("/api/tickets", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: ticketId,
            status,
            closed_at: status === "closed" || status === "resolved" ? new Date().toISOString() : null,
          }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (data.ok === false) {
          throw new Error(data.error ?? "No se pudo actualizar el ticket");
        }
        await loadTickets();
      } catch (error) {
        console.error(error);
        setMessage(error instanceof Error ? error.message : "Error actualizando ticket");
      }
    },
    [loadTickets]
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[var(--muted)]">Cargando ficha...</p>
      </div>
    );
  }

  if (!client) {
    return <EmptyState title="Cliente no encontrado" subtitle="Comprueba el enlace o vuelve al listado" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">Administración</p>
          <h1 className="text-3xl font-semibold">{client.name}</h1>
          <p className="text-sm text-[var(--muted)]">Ficha del cliente</p>
        </div>
        <Link href="/clients">
          <Button variant="outline">Volver</Button>
        </Link>
      </div>

      {message && <p className="text-sm text-[var(--muted)]">{message}</p>}

      <Card tone="glass" title="Clients 360" subtitle="Resumen de SaaS y estado operativo">
        {overviewLoading ? (
          <p className="text-sm text-[var(--muted)]">Cargando overview...</p>
        ) : !overview ? (
          <p className="text-sm text-[var(--muted)]">Sin overview disponible.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-[var(--muted)]">Pack dominante:</span>
              <Badge variant="outline">{dominantPack ?? "Sin detectar"}</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {overview.saas.map((item) => (
                <div key={item.saasId} className="rounded-2xl border border-[var(--border)]/60 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-xs text-[var(--muted)]">{item.verticalPack?.label ?? "Sin pack"}</p>
                    </div>
                    <Link href={`/saas/${item.saasId}`} className="text-xs font-semibold text-[var(--brand)]">
                      Abrir SaaS
                    </Link>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--muted)]">
                    <div>Margen: {typeof item.keyMetrics.marginPercent === "number" ? `${item.keyMetrics.marginPercent.toFixed(0)}%` : "—"}</div>
                    <div>Fairness: {item.keyMetrics.hrFairnessStatus ?? "—"}</div>
                    <div>ROI empleados: {item.keyMetrics.employeesRoiStatus ?? "—"}</div>
                    <div>Social ROI: {item.keyMetrics.socialRoiStatus ?? "—"}</div>
                  </div>
                  <div className="mt-2 text-xs text-[var(--muted)]">
                    Tareas abiertas: {item.tasksSummary?.openTasks ?? 0}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {overviewAlerts.length > 0 && (
        <Card tone="glass" title="Alertas & recomendaciones" subtitle="Prioriza ajustes por cliente">
          <ul className="space-y-2 text-sm text-[var(--muted)]">
            {overviewAlerts.map((alert, idx) => (
              <li key={`${alert}-${idx}`} className="rounded-xl border border-[var(--border)]/60 p-2">
                {alert}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card tone="glass" title="Datos de facturación" subtitle="Edita la información principal del cliente">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Nombre</span>
            <TextInput value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">NIF / CIF</span>
            <TextInput value={client.nif ?? ""} onChange={(e) => setClient({ ...client, nif: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Email</span>
            <TextInput value={client.email ?? ""} onChange={(e) => setClient({ ...client, email: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Teléfono</span>
            <TextInput value={client.phone ?? ""} onChange={(e) => setClient({ ...client, phone: e.target.value })} />
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => void handleSaveClient()} disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </Card>

      <Card tone="glass" title="SaaS vinculados" subtitle="Proyectos asociados a este cliente">
        {linkedSaas.length === 0 ? (
          <EmptyState title="Sin SaaS vinculados" subtitle="Asocia un SaaS existente" />
        ) : (
          <div className="space-y-3">
            {linkedSaas.map((saas) => (
              <div key={saas.linkId} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)]/60 p-4">
                <div>
                  <p className="font-semibold">{saas.name}</p>
                  <p className="text-xs text-[var(--muted)]">Slug: {saas.slug}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[var(--muted)]">Estado {saas.status}</span>
                  <Link href={`/saas/${saas.id}`} className="text-sm font-semibold text-[var(--brand)]">
                    Ver SaaS
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 space-y-2">
          <p className="text-sm text-[var(--muted)]">Vincular SaaS existente</p>
          <div className="flex flex-wrap gap-2">
            <Select value={selectedSaas} onChange={(e) => setSelectedSaas(e.target.value)}>
              <option value="">Selecciona un SaaS</option>
              {saasList.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.slug})
                </option>
              ))}
            </Select>
            <Button onClick={() => void handleLinkSaas()} disabled={linking}>
              {linking ? "Vinculando..." : "Vincular"}
            </Button>
          </div>
        </div>
      </Card>

      <Card tone="glass" title="Suscripciones SaaS activas" subtitle="Estado de cada SaaS conectado">
        {saasSubscriptionsLoading ? (
          <p className="text-sm text-[var(--muted)]">Cargando suscripciones...</p>
        ) : saasSubscriptions.length === 0 ? (
          <EmptyState title="Sin suscripciones" subtitle="Aún no hay suscripciones activas para este cliente" />
        ) : (
          <div className="space-y-3">
            {saasSubscriptions.map((subscription) => (
              <div key={subscription.id} className="rounded-2xl border border-[var(--border)]/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold">{saasNameMap.get(subscription.saasId) ?? subscription.saasId}</p>
                    <p className="text-xs text-[var(--muted)]">Plan {subscription.planCode}</p>
                  </div>
                  <Badge variant={subscriptionStatusVariant[subscription.status] ?? "info"}>{subscription.status}</Badge>
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">Renovación: {formatSubscriptionRenewal(subscription.currentPeriodEnd)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card tone="glass" title="Facturas" subtitle="Seguimiento de facturación del cliente">
        {invoicesLoading ? (
          <p className="text-sm text-[var(--muted)]">Cargando facturas...</p>
        ) : invoices.length === 0 ? (
          <EmptyState title="Sin facturas" subtitle="Registra la primera factura para este cliente" />
        ) : (
          <div className="space-y-4">
            {Array.from(invoicesBySaas.entries()).map(([saasId, list]) => (
              <div key={saasId} className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  {findSaasLabel(saasId === "__none" ? null : saasId)}
                </p>
                <div className="overflow-x-auto rounded-2xl border border-[var(--border)]/60">
                  <table className="modern text-sm w-full">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Importe</th>
                        <th>Estado</th>
                        <th>Número</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((invoice) => (
                        <tr key={invoice.id}>
                          <td>{new Date(invoice.created_at).toLocaleDateString()}</td>
                          <td>{`${(invoice.amount_cents / 100).toFixed(2)} ${invoice.currency}`}</td>
                          <td>
                            <Select value={invoice.status} onChange={(e) => void handleUpdateInvoiceStatus(invoice.id, e.target.value)}>
                              {invoiceStatusOptions.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </Select>
                          </td>
                          <td>{invoice.number ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 space-y-3">
          <p className="text-sm text-[var(--muted)]">Crear factura</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-sm flex flex-col gap-1">
              <span className="text-[var(--muted)]">Importe</span>
              <TextInput value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} type="number" min="0" step="0.01" />
            </label>
            <label className="text-sm flex flex-col gap-1">
              <span className="text-[var(--muted)]">Estado</span>
              <Select value={invoiceStatus} onChange={(e) => setInvoiceStatus(e.target.value)}>
                {invoiceStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm flex flex-col gap-1">
              <span className="text-[var(--muted)]">SaaS</span>
              <Select value={invoiceSaasId} onChange={(e) => setInvoiceSaasId(e.target.value)}>
                <option value="">Selecciona SaaS</option>
                {saasList.map((saas) => (
                  <option key={saas.id} value={saas.id}>
                    {saas.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm flex flex-col gap-1">
              <span className="text-[var(--muted)]">Moneda</span>
              <TextInput value={invoiceCurrency} onChange={(e) => setInvoiceCurrency(e.target.value)} />
            </label>
            <label className="text-sm flex flex-col gap-1 md:col-span-2">
              <span className="text-[var(--muted)]">Notas</span>
              <TextArea value={invoiceNotes} onChange={(e) => setInvoiceNotes(e.target.value)} rows={3} />
            </label>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => void handleCreateInvoice()}>Guardar factura</Button>
          </div>
        </div>
      </Card>

      <Card tone="glass" title="Tickets de soporte" subtitle="Incidencias asociadas al cliente">
        {ticketsLoading ? (
          <p className="text-sm text-[var(--muted)]">Cargando tickets...</p>
        ) : tickets.length === 0 ? (
          <EmptyState title="Sin tickets" subtitle="No existen incidencias registradas" />
        ) : (
          <div className="space-y-4">
            {Array.from(ticketsBySaas.entries()).map(([saasId, list]) => (
              <div key={saasId} className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  {findSaasLabel(saasId === "__none" ? null : saasId)}
                </p>
                <div className="space-y-3">
                  {list.map((ticket) => (
                    <div key={ticket.id} className="rounded-2xl border border-[var(--border)]/60 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold">{ticket.subject}</p>
                          <p className="text-xs text-[var(--muted)]">Prioridad {ticket.priority}</p>
                        </div>
                        <Select value={ticket.status} onChange={(e) => void handleUpdateTicketStatus(ticket.id, e.target.value)}>
                          {ticketStatusOptions.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        Creado el {new Date(ticket.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 space-y-3">
          <p className="text-sm text-[var(--muted)]">Registrar ticket</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-sm flex flex-col gap-1">
              <span className="text-[var(--muted)]">Título</span>
              <TextInput value={ticketSubject} onChange={(e) => setTicketSubject(e.target.value)} />
            </label>
            <label className="text-sm flex flex-col gap-1">
              <span className="text-[var(--muted)]">SaaS</span>
              <Select value={ticketSaasId} onChange={(e) => setTicketSaasId(e.target.value)}>
                <option value="">General</option>
                {saasList.map((saas) => (
                  <option key={saas.id} value={saas.id}>
                    {saas.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm flex flex-col gap-1">
              <span className="text-[var(--muted)]">Estado</span>
              <Select value={ticketStatus} onChange={(e) => setTicketStatus(e.target.value)}>
                {ticketStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm flex flex-col gap-1">
              <span className="text-[var(--muted)]">Prioridad</span>
              <Select value={ticketPriority} onChange={(e) => setTicketPriority(e.target.value)}>
                {ticketPriorityOptions.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm flex flex-col gap-1 md:col-span-2">
              <span className="text-[var(--muted)]">Descripción</span>
              <TextArea value={ticketDescription} onChange={(e) => setTicketDescription(e.target.value)} rows={3} />
            </label>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => void handleCreateTicket()}>Registrar ticket</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
