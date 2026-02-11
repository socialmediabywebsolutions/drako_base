"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/card";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import type { EmailClassification, EmailIntakeSnapshot, EmailStatus, SaasEmailMessage } from "@/lib/email-intake/types";
import type { EmailIntakeSuggestion } from "@/lib/email-intake/types";
import type { SaasInventoryItem } from "@/lib/economy/types";

type Props = {
  saasId: string | null;
};

const classificationLabels: Record<EmailClassification, string> = {
  INVOICE: "Factura",
  QUOTE: "Presupuesto",
  SUPPLIER: "Proveedor",
  LEAD: "Lead",
  OTHER: "Otro",
};

const statusLabels: Record<EmailStatus, string> = {
  NEW: "Nuevo",
  REVIEWED: "Revisado",
  ARCHIVED: "Archivado",
  CONVERTED_TO_EXPENSE: "Gasto creado",
  CONVERTED_TO_LEAD: "Lead creado",
};

function formatCurrency(value?: number | null) {
  if (typeof value !== "number") return "—";
  return `${value.toFixed(2)} €`;
}

export default function SaasInboxSection({ saasId }: Props) {
  const [messages, setMessages] = useState<SaasEmailMessage[]>([]);
  const [snapshot, setSnapshot] = useState<EmailIntakeSnapshot | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [classificationFilter, setClassificationFilter] = useState<EmailClassification | "">("");
  const [statusFilter, setStatusFilter] = useState<EmailStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<{ message: SaasEmailMessage; suggestions: EmailIntakeSuggestion[] } | null>(null);
  const [inventoryItems, setInventoryItems] = useState<SaasInventoryItem[]>([]);
  const [seeding, setSeeding] = useState(false);
  const [updatingDetail, setUpdatingDetail] = useState(false);
  const [prioritizeSavings, setPrioritizeSavings] = useState(false);
  const [savingsMap, setSavingsMap] = useState<Record<string, number>>({});
  const [savingsLoading, setSavingsLoading] = useState(false);

  const selectedMessage = useMemo(() => messages.find((item) => item.id === selectedId) ?? null, [messages, selectedId]);

  const loadInventory = useCallback(async () => {
    if (!saasId) return;
    try {
      const res = await fetch(`/api/economy/inventory?saasId=${encodeURIComponent(saasId)}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items?: SaasInventoryItem[] };
      setInventoryItems(data.items ?? []);
    } catch {
      setInventoryItems([]);
    }
  }, [saasId]);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (saasId) params.set("saasId", saasId);
    if (classificationFilter) params.set("classification", classificationFilter);
    if (statusFilter) params.set("status", statusFilter);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [classificationFilter, saasId, statusFilter]);

  const loadMessages = useCallback(async () => {
    if (!saasId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/email-intake/messages${buildQuery()}`, { cache: "no-store" });
      const data = (await res.json()) as { items?: SaasEmailMessage[]; snapshot?: EmailIntakeSnapshot };
      setMessages(data.items ?? []);
      setSnapshot(data.snapshot ?? null);
      setSelectedId((prev) => {
        if (prev && data.items?.some((item) => item.id === prev)) return prev;
        return data.items?.[0]?.id ?? null;
      });
    } finally {
      setLoading(false);
    }
  }, [buildQuery, saasId]);

  const loadDetail = useCallback(async () => {
    if (!saasId || !selectedId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/email-intake/messages/${encodeURIComponent(selectedId)}?saasId=${encodeURIComponent(saasId)}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as { message?: SaasEmailMessage; suggestions?: EmailIntakeSuggestion[] };
      if (data.message) {
        setDetail({
          message: data.message,
          suggestions: data.suggestions ?? [],
        });
      } else {
        setDetail(null);
      }
    } finally {
      setDetailLoading(false);
    }
  }, [saasId, selectedId]);

  const loadSavingsEstimates = useCallback(async () => {
    if (!saasId || messages.length === 0) {
      setSavingsMap({});
      return;
    }
    setSavingsLoading(true);
    try {
      const entries = await Promise.all(
        messages.map(async (message) => {
          const res = await fetch(
            `/api/email-intake/messages/${encodeURIComponent(message.id)}?saasId=${encodeURIComponent(saasId)}`,
            { cache: "no-store" },
          );
          const data = (await res.json().catch(() => null)) as { suggestions?: EmailIntakeSuggestion[] } | null;
          const best = (data?.suggestions ?? [])
            .filter((suggestion) => suggestion.type === "SUPPLIER")
            .map((suggestion) => suggestion.monthlySavingsEstimate ?? suggestion.estimatedMonthlySaving ?? 0)
            .reduce((acc, value) => Math.max(acc, value), 0);
          return [message.id, best] as const;
        }),
      );
      setSavingsMap(Object.fromEntries(entries));
    } finally {
      setSavingsLoading(false);
    }
  }, [messages, saasId]);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (!prioritizeSavings) return;
    void loadSavingsEstimates();
  }, [loadSavingsEstimates, prioritizeSavings]);

  const totalEmails = useMemo(() => messages.length, [messages.length]);

  const supplierSavingsCount = useMemo(() => {
    if (!inventoryItems.length) return 0;
    return messages.filter((message) => {
      if (!["SUPPLIER", "QUOTE"].includes(message.classification)) return false;
      if (!message.parsedAmount) return false;
      const text = `${message.subject ?? ""} ${message.body ?? ""}`.toLowerCase();
      return inventoryItems.some((item) => text.includes(item.name.toLowerCase()) && message.parsedAmount! < item.costPerUnit);
    }).length;
  }, [inventoryItems, messages]);

  const leadCount = snapshot?.countsByClassification.LEAD ?? 0;
  const invoiceCount = snapshot?.countsByClassification.INVOICE ?? 0;
  const hasSavings = useMemo(() => Object.values(savingsMap).some((value) => value > 0), [savingsMap]);

  const orderedMessages = useMemo(() => {
    if (!prioritizeSavings) return messages;
    return [...messages].sort((a, b) => (savingsMap[b.id] ?? 0) - (savingsMap[a.id] ?? 0));
  }, [messages, prioritizeSavings, savingsMap]);

  async function updateMessage(values: { status?: EmailStatus; classification?: EmailClassification }) {
    if (!saasId || !selectedMessage) return;
    setUpdatingDetail(true);
    await fetch(`/api/email-intake/messages/${encodeURIComponent(selectedMessage.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ saasId, ...values }),
    });
    await loadMessages();
    await loadDetail();
    setUpdatingDetail(false);
  }

  async function seedDemoEmails() {
    if (!saasId) return;
    setSeeding(true);
    try {
      await fetch(`/api/email-intake/seed?saasId=${encodeURIComponent(saasId)}`, { method: "POST" });
      await loadMessages();
    } finally {
      setSeeding(false);
    }
  }

  return (
    <section className="space-y-4" aria-label="Inbox">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Inbox</p>
          <h2 className="text-xl font-semibold">Email Intake</h2>
          <p className="text-sm text-[var(--muted)]">Facturas, proveedores y leads desde email.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={loadMessages}>Refrescar</Button>
          <Button variant="outline" onClick={seedDemoEmails} disabled={seeding}>
            {seeding ? "Añadiendo..." : "Demo / Seed"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        <Card tone="glass" title="Total emails" className="!p-3">
          <p className="text-2xl font-semibold">{totalEmails}</p>
        </Card>
        <Card tone="glass" title="Facturas" className="!p-3">
          <p className="text-2xl font-semibold">{invoiceCount}</p>
        </Card>
        <Card tone="glass" title="Ofertas con ahorro" className="!p-3">
          <p className="text-2xl font-semibold">{supplierSavingsCount}</p>
        </Card>
        <Card tone="glass" title="Leads" className="!p-3">
          <p className="text-2xl font-semibold">{leadCount}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card tone="glass" title="Bandeja" className="xl:col-span-1">
          <div className="flex flex-col gap-2 text-sm">
            <label className="flex flex-col gap-1">
              Clasificacion
              <select
                className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-sm"
                value={classificationFilter}
                onChange={(event) => setClassificationFilter(event.target.value as EmailClassification | "")}
              >
                <option value="">Todas</option>
                {Object.entries(classificationLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              Estado
              <select
                className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-sm"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as EmailStatus | "")}
              >
                <option value="">Todos</option>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <input
                type="checkbox"
                checked={prioritizeSavings}
                onChange={(event) => setPrioritizeSavings(event.target.checked)}
              />
              Ver primero oportunidades de ahorro
            </label>
          </div>

          {loading ? (
            <p className="mt-3 text-sm text-[var(--muted)]">Cargando emails...</p>
          ) : messages.length === 0 ? (
            <EmptyState title="Sin emails" subtitle="Usa la API de ingesta para simular correos." />
          ) : (
            <div className="mt-3 space-y-2">
              {prioritizeSavings && savingsLoading && (
                <p className="text-xs text-[var(--muted)]">Calculando oportunidades...</p>
              )}
              {prioritizeSavings && !savingsLoading && !hasSavings && (
                <p className="text-xs text-[var(--muted)]">No hay oportunidades de ahorro con datos suficientes por ahora.</p>
              )}
              {orderedMessages.map((message) => (
                <button
                  key={message.id}
                  className={`w-full rounded-xl border border-[var(--border)] px-3 py-2 text-left transition ${selectedId === message.id ? "bg-[var(--panel-alt)]" : ""}`}
                  onClick={() => setSelectedId(message.id)}
                >
                  <p className="text-sm font-semibold">{message.subject ?? "Sin asunto"}</p>
                  <p className="text-xs text-[var(--muted)]">{message.fromName ?? message.fromAddress}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <Badge variant="neutral">{classificationLabels[message.classification]}</Badge>
                    <Badge variant="info">{statusLabels[message.status]}</Badge>
                    {message.parsedAmount ? <span>{formatCurrency(message.parsedAmount)}</span> : null}
                    {prioritizeSavings && (savingsMap[message.id] ?? 0) > 0 ? (
                      <Badge variant="ok">Ahorro</Badge>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card tone="glass" title="Detalle" className="xl:col-span-2">
          {detailLoading && <p className="text-sm text-[var(--muted)]">Cargando detalle...</p>}
          {!selectedMessage && !detailLoading && <EmptyState title="Selecciona un email" subtitle="Elige un correo para ver el detalle." />}
          {detail?.message && !detailLoading && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">{detail.message.subject ?? "Sin asunto"}</h3>
                <p className="text-sm text-[var(--muted)]">
                  {detail.message.fromName ?? detail.message.fromAddress} · {new Date(detail.message.receivedAt).toLocaleString()}
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-alt)] p-3 text-sm">
                <p className="font-semibold">Texto</p>
                <p className="mt-2 text-[var(--muted)]">{detail.message.body ?? detail.message.snippet ?? "Sin contenido"}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <label className="flex flex-col gap-1">
                  Clasificacion
                  <select
                    className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-sm"
                    value={detail.message.classification}
                    onChange={(event) => updateMessage({ classification: event.target.value as EmailClassification })}
                    disabled={updatingDetail}
                  >
                    {Object.entries(classificationLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  Estado
                  <select
                    className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-sm"
                    value={detail.message.status}
                    onChange={(event) => updateMessage({ status: event.target.value as EmailStatus })}
                    disabled={updatingDetail}
                  >
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="rounded-2xl border border-[var(--border)] p-3 text-sm">
                <p className="font-semibold">Acciones automaticas</p>
                {detail.message.linkedExpenseId ? (
                  <p className="mt-2 text-[var(--muted)]">Gasto creado en Economy ({detail.message.linkedExpenseId}).</p>
                ) : (
                  <p className="mt-2 text-[var(--muted)]">Sin acciones automaticas aplicadas.</p>
                )}
                <Button variant="ghost" className="mt-2">Ver en Economy</Button>
              </div>

              <div className="rounded-2xl border border-[var(--border)] p-3 text-sm">
                <p className="font-semibold">Sugerencias</p>
                {detail.suggestions.length === 0 ? (
                  <p className="mt-2 text-[var(--muted)]">Sin sugerencias.</p>
                ) : (
                  <ul className="mt-2 space-y-2 text-[var(--muted)]">
                    {detail.suggestions.map((suggestion, idx) => {
                      if (suggestion.type !== "SUPPLIER") {
                        return <li key={`${suggestion.title}-${idx}`}>{suggestion.description}</li>;
                      }
                      const usage = suggestion.monthlyUsageEstimate ?? suggestion.estimatedMonthlyUsage ?? 0;
                      const saving = suggestion.monthlySavingsEstimate ?? suggestion.estimatedMonthlySaving ?? 0;
                      const currentCost = suggestion.currentUnitCost;
                      const offeredCost = suggestion.offeredUnitCost;
                      const level =
                        saving >= 50 ? "High" : saving >= 10 ? "Medium" : saving > 0 ? "Low" : null;
                      return (
                        <li key={`${suggestion.title}-${idx}`} className="rounded-xl border border-[var(--border)]/60 bg-[var(--panel-alt)] p-3">
                          <p className="font-semibold">{suggestion.title}</p>
                          <p className="mt-1 text-[var(--muted)]">{suggestion.description}</p>
                          {usage > 0 && saving > 0 ? (
                            <div className="mt-2 text-xs text-[var(--muted)]">
                              <p>Uso estimado: ~{usage.toFixed(1)} unidades/mes</p>
                              <p>Ahorro potencial: ~{saving.toFixed(1)} €/mes si cambias a este proveedor</p>
                              {typeof currentCost === "number" && typeof offeredCost === "number" ? (
                                <p>Precio actual: {currentCost.toFixed(2)} €/unidad · Oferta: {offeredCost.toFixed(2)} €/unidad</p>
                              ) : null}
                            </div>
                          ) : (
                            <p className="mt-2 text-xs text-[var(--muted)]">
                              Oferta detectada, pero aún no hay datos suficientes de consumo para estimar el ahorro mensual.
                            </p>
                          )}
                          {level ? (
                            <Badge
                              className="mt-2 inline-flex"
                              variant={level === "High" ? "err" : level === "Medium" ? "warn" : "neutral"}
                            >
                              {level}
                            </Badge>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => updateMessage({ status: "REVIEWED" })} disabled={updatingDetail}>Marcar revisado</Button>
                <Button variant="ghost" onClick={() => updateMessage({ status: "ARCHIVED" })} disabled={updatingDetail}>Archivar</Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
