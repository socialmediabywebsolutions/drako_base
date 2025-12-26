"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Badge from "@/components/ui/badge";
import Select from "@/components/ui/select";
import EmptyState from "@/components/ui/empty-state";
import { setOrchestratorContext } from "@/lib/orchestrator-context";
import { Mail, MessageCircle, RefreshCcw } from "lucide-react";

const channelOptions = [
  { value: "", label: "Todos los canales" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
];

const statusOptions = [
  { value: "", label: "Todos los estados" },
  { value: "nuevo", label: "Pendiente" },
  { value: "en_proceso", label: "En proceso" },
  { value: "resuelto", label: "Resuelto" },
  { value: "archivado", label: "Archivado" },
  { value: "error", label: "Error" },
];

const statusLabels: Record<string, string> = {
  nuevo: "Pendiente",
  en_proceso: "En proceso",
  resuelto: "Resuelto",
  archivado: "Archivado",
  error: "Error",
};

const statusVariants: Record<string, "info" | "warn" | "ok" | "err"> = {
  nuevo: "info",
  en_proceso: "warn",
  resuelto: "ok",
  archivado: "info",
  error: "err",
};

type InboxMessage = {
  id: string;
  channel: "email" | "whatsapp";
  direction: "inbound" | "outbound";
  from_address: string;
  to_address: string;
  subject: string | null;
  body_preview: string;
  full_body: string;
  status: string;
  saas_id: string | null;
  department_id: string | null;
  tags: string | null;
  created_at: string;
  updated_at: string;
};

type SaasSummary = { id: string; name: string; slug: string };
type CoreDepartment = { id: string; nombre: string };

const formatDate = (value: string) => new Date(value).toLocaleString();

export default function InboxPage() {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [channelFilter, setChannelFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [saasFilter, setSaasFilter] = useState<string>("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("");

  const [saasList, setSaasList] = useState<SaasSummary[]>([]);
  const [departments, setDepartments] = useState<CoreDepartment[]>([]);
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const departmentSelectRef = useRef<HTMLSelectElement | null>(null);
  const quickDepartments = useMemo(() => departments.slice(0, 6), [departments]);

  const saasMap = useMemo(() => {
    const map: Record<string, SaasSummary> = {};
    saasList.forEach((s) => { map[s.id] = s; });
    return map;
  }, [saasList]);

  const departmentMap = useMemo(() => {
    const map: Record<string, string> = {};
    departments.forEach((d) => { map[d.id] = d.nombre; });
    return map;
  }, [departments]);

  const selectedMessage = useMemo(() => messages.find((msg) => msg.id === selectedId) ?? null, [messages, selectedId]);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (channelFilter) params.set("channel", channelFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (saasFilter) params.set("saas_id", saasFilter);
    if (departmentFilter) params.set("department_id", departmentFilter);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [channelFilter, statusFilter, saasFilter, departmentFilter]);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/inbox${buildQuery()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("No se pudo obtener la bandeja");
      const data = (await res.json()) as { items?: InboxMessage[] };
      setMessages(data.items ?? []);
      if (data.items && data.items.length > 0 && !selectedId) {
        setSelectedId(data.items[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado cargando la bandeja");
    } finally {
      setLoading(false);
    }
  }, [buildQuery, selectedId]);

  const loadSaas = useCallback(async () => {
    const res = await fetch("/api/saas", { cache: "no-store" });
    const data = (await res.json()) as { items?: SaasSummary[] };
    setSaasList(data.items ?? []);
  }, []);

  const loadDepartments = useCallback(async () => {
    const res = await fetch("/api/core-departments", { cache: "no-store" });
    const data = (await res.json()) as { items?: CoreDepartment[] };
    setDepartments(data.items ?? []);
  }, []);

  useEffect(() => { void loadMessages(); }, [loadMessages]);
  useEffect(() => { void loadSaas(); }, [loadSaas]);
  useEffect(() => { void loadDepartments(); }, [loadDepartments]);

  useEffect(() => () => { setOrchestratorContext(null); }, []);

  useEffect(() => {
    if (!selectedMessage) return;
    const deptLabel = selectedMessage.department_id ? (departmentMap[selectedMessage.department_id] ?? selectedMessage.department_id) : null;
    const saasLabel = selectedMessage.saas_id ? (saasMap[selectedMessage.saas_id]?.name ?? null) : null;
    setOrchestratorContext({
      scope: "inbox",
      inbox: {
        id: selectedMessage.id,
        channel: selectedMessage.channel,
        status: selectedMessage.status,
        department_id: selectedMessage.department_id,
        department_label: deptLabel,
        subject: selectedMessage.subject,
        preview: selectedMessage.body_preview,
        saas_id: selectedMessage.saas_id,
        saas_name: saasLabel,
      },
    });
  }, [departmentMap, saasMap, selectedMessage]);

  const refresh = useCallback(() => { void loadMessages(); }, [loadMessages]);

  const handleStatusChange = useCallback(async (newStatus: string) => {
    if (!selectedMessage) return;
    setUpdating(true);
    try {
      await fetch("/api/inbox", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: selectedMessage.id, status: newStatus }),
      });
      await loadMessages();
    } finally {
      setUpdating(false);
    }
  }, [loadMessages, selectedMessage]);

  const handleDepartmentChange = useCallback(async (newDepartment: string | null) => {
    if (!selectedMessage) return;
    setUpdating(true);
    try {
      await fetch("/api/inbox", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: selectedMessage.id, department_id: newDepartment ?? null }),
      });
      await loadMessages();
    } finally {
      setUpdating(false);
    }
  }, [loadMessages, selectedMessage]);

  const renderChannelIcon = (channel: string) => {
    if (channel === "email") return <Mail className="h-4 w-4" />;
    if (channel === "whatsapp") return <MessageCircle className="h-4 w-4" />;
    return <Mail className="h-4 w-4" />;
  };

  const handleQuickStatus = useCallback((value: string) => {
    void handleStatusChange(value);
  }, [handleStatusChange]);

  const handleReply = useCallback(() => {
    if (!selectedMessage) return;
    const subject = encodeURIComponent(`Re: ${selectedMessage.subject ?? "Consulta"}`);
    const body = encodeURIComponent("Gracias por contactar con Campamento Base. Te respondemos en breve.");
    window.open(`mailto:${selectedMessage.from_address}?subject=${subject}&body=${body}`);
  }, [selectedMessage]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">Campamento Base • Bandeja</p>
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">Bandeja unificada</h1>
          <p className="text-sm text-[var(--muted)]">Email y WhatsApp coordinados por departamento</p>
        </div>
        <Button variant="outline" onClick={refresh} className="inline-flex items-center gap-2" aria-label="Refrescar bandeja">
          <RefreshCcw className="h-4 w-4" />
          Refrescar
        </Button>
      </div>

      <Card tone="glass" title="Filtros activos" subtitle="Refina la bandeja para enfocarte en lo crítico">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <Select aria-label="Filtrar por canal" value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
            {channelOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
          <Select aria-label="Filtrar por estado" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
          <Select aria-label="Filtrar por SaaS" value={saasFilter} onChange={(e) => setSaasFilter(e.target.value)}>
            <option value="">Todos los SaaS</option>
            {saasList.map((saas) => (
              <option key={saas.id} value={saas.id}>{saas.name}</option>
            ))}
          </Select>
          <Select aria-label="Filtrar por departamento" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
            <option value="">Todos los departamentos</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>{dept.nombre}</option>
            ))}
          </Select>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <Card title="Mensajes" subtitle="Ordenados del más reciente al más antiguo">
          {loading ? (
            <div className="text-sm text-[var(--muted)]">Cargando bandeja...</div>
          ) : error ? (
            <div className="text-sm text-red-500">{error}</div>
          ) : messages.length === 0 ? (
            <EmptyState title="Sin mensajes" subtitle="Cuando llegue el primer mensaje aparecerá aquí" />
          ) : (
            <ul className="space-y-2" role="list" aria-live="polite">
              {messages.map((msg) => {
                const active = msg.id === selectedId;
                return (
                  <li
                    key={msg.id}
                    className={`rounded-2xl border p-3 cursor-pointer transition focus:outline-none focus:ring-2 focus:ring-[var(--brand)] ${active ? "border-[var(--brand)] bg-[var(--brand-quiet)]/70" : "border-[var(--border)] bg-[var(--panel)]/60 hover:border-[var(--brand)]/60"}`}
                    role="button"
                    tabIndex={0}
                    aria-pressed={active}
                    onClick={() => setSelectedId(msg.id)}
                    onKeyDown={(evt) => {
                      if (evt.key === "Enter" || evt.key === " ") {
                        evt.preventDefault();
                        setSelectedId(msg.id);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--background)] text-[var(--foreground)] border border-[var(--border)]" aria-hidden="true">
                          {renderChannelIcon(msg.channel)}
                        </span>
                        <div>
                          <p className="line-clamp-1">{msg.subject ?? msg.body_preview ?? "(Sin asunto)"}</p>
                          <p className="text-xs text-[var(--muted)]">{msg.from_address}</p>
                        </div>
                      </div>
                      <Badge variant={statusVariants[msg.status] ?? "info"}>{statusLabels[msg.status] ?? msg.status}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
                      <span>{saasMap[msg.saas_id ?? ""]?.name ?? "Campamento Base"}</span>
                      <span>Depto: {msg.department_id ? (departmentMap[msg.department_id] ?? msg.department_id) : "Sin asignar"}</span>
                      <span>{formatDate(msg.created_at)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Detalle" subtitle="Gestiona el mensaje seleccionado">
          {!selectedMessage ? (
            <EmptyState title="Selecciona un mensaje" subtitle="Haz clic en cualquiera de la lista para ver sus detalles" />
          ) : (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={handleReply} variant="outline">Responder al cliente</Button>
                <Button size="sm" variant="secondary" onClick={() => handleQuickStatus("nuevo")}>Marcar pendiente</Button>
                <Button size="sm" variant="secondary" onClick={() => handleQuickStatus("en_proceso")}>Marcar en proceso</Button>
                <Button size="sm" variant="secondary" onClick={() => handleQuickStatus("resuelto")}>Marcar resuelto</Button>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Asunto</p>
                <p className="text-base font-semibold text-[var(--foreground)]">{selectedMessage.subject ?? "(Sin asunto)"}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)]/70 bg-[var(--background)]/80 p-3 text-sm text-[var(--foreground)] whitespace-pre-line">
                {selectedMessage.full_body}
              </div>
              <div className="grid gap-3">
                <label className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Estado</label>
                <Select aria-label="Actualizar estado" value={selectedMessage.status} onChange={(e) => handleStatusChange(e.target.value)} disabled={updating}>
                  {statusOptions.filter((item) => item.value !== "").map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-3">
                <label className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Departamento</label>
                <Select
                  aria-label="Actualizar departamento"
                  ref={departmentSelectRef}
                  value={selectedMessage.department_id ?? ""}
                  onChange={(e) => handleDepartmentChange(e.target.value || null)}
                  disabled={updating}
                >
                  <option value="">Sin asignar</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.nombre}</option>
                  ))}
                </Select>
                <div className="rounded-2xl border border-[var(--border)]/50 bg-[var(--panel)]/40 p-3 space-y-2">
                  <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Reclasificar rápido</p>
                  <div className="flex flex-wrap gap-2">
                    {quickDepartments.map((dept) => (
                      <Button key={dept.id} type="button" size="sm" variant="ghost" onClick={() => handleDepartmentChange(dept.id)}>
                        {dept.nombre}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid gap-1 text-xs text-[var(--muted)]">
                <span>Canal: {selectedMessage.channel === "email" ? "Email" : "WhatsApp"}</span>
                <span>De: {selectedMessage.from_address}</span>
                <span>Para: {selectedMessage.to_address}</span>
                <span>Última actualización: {formatDate(selectedMessage.updated_at)}</span>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
