"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Badge from "@/components/ui/badge";
import EmptyState from "@/components/ui/empty-state";
import Tooltip from "@/components/ui/tooltip";
import { TextInput, TextArea } from "@/components/ui/input";
import { TableWrap, Table, THead, TBody, TH, TD } from "@/components/ui/table";
import { SAAS_PACK_DEFINITIONS } from "@/lib/packs/definitions";
import type { SaasPackDefinition } from "@/lib/packs/types";
import type { SaasFeatureCategory, SaasFeatureKey } from "@/lib/features/types";
import type { NormalizedProjectEntitlements } from "@/lib/projects/entitlements";

const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("es-ES", DATE_FORMAT_OPTIONS).format(new Date(value));
  } catch {
    return value;
  }
}

const FEATURE_CATALOG: Array<{ key: SaasFeatureKey; label: string; category: SaasFeatureCategory }> = [
  { key: "ECONOMY", label: "Economy Engine", category: "CORE" },
  { key: "BLUEPRINT", label: "Blueprint & Factory", category: "CORE" },
  { key: "APPEARANCE_BRANDING", label: "Branding & Themes", category: "CORE" },
  { key: "HR", label: "HR & Compliance", category: "OPERATIONS" },
  { key: "EMPLOYEES", label: "Equipo & Roles", category: "OPERATIONS" },
  { key: "STAFF_PORTAL", label: "Staff Portal", category: "OPERATIONS" },
  { key: "CLIENT_PORTAL", label: "Client Portal", category: "MARKETING" },
  { key: "EMAIL_INTAKE", label: "Email Intake", category: "MARKETING" },
  { key: "SOCIAL", label: "Social Engine", category: "MARKETING" },
  { key: "OWNER_CONTROL", label: "Operator Control", category: "ANALYTICS" },
  { key: "KNOWLEDGE", label: "Knowledge Base", category: "OPERATIONS" },
  { key: "TASKS", label: "Tasks & Execution", category: "OPERATIONS" },
  { key: "TAX_ENGINE", label: "Tax & Accounting", category: "ANALYTICS" },
];

const FEATURE_CATEGORY_LABELS: Record<SaasFeatureCategory, string> = {
  CORE: "Core",
  MARKETING: "Marketing",
  ANALYTICS: "Analytics",
  OPERATIONS: "Operaciones",
};

const FEATURE_CATALOG_MAP = new Map(FEATURE_CATALOG.map((entry) => [entry.key.toLowerCase(), entry]));
const PACK_CATALOG_MAP = new Map(SAAS_PACK_DEFINITIONS.map((pack) => [pack.id, pack]));
const FEATURE_GROUPS = FEATURE_CATALOG.reduce<Record<SaasFeatureCategory, typeof FEATURE_CATALOG>>((acc, entry) => {
  if (!acc[entry.category]) {
    acc[entry.category] = [];
  }
  acc[entry.category].push(entry);
  return acc;
}, {} as Record<SaasFeatureCategory, typeof FEATURE_CATALOG>);

type EntitlementSource = "project" | "company" | "saas" | "none";

const ENTITLEMENT_STATE_LABELS: Record<EntitlementSource, string> = {
  project: "Active",
  company: "Inherited",
  saas: "Inherited",
  none: "Locked",
};

const ENTITLEMENT_BADGE_VARIANTS: Record<EntitlementSource, "ok" | "warn" | "info" | "neutral"> = {
  project: "ok",
  company: "info",
  saas: "info",
  none: "warn",
};

type EntitlementsFeatureItem = {
  featureKey: string;
  label: string;
  category: string;
  status: string;
  source: EntitlementSource;
};

type EntitlementsPackItem = SaasPackDefinition & { source: EntitlementSource };

type EntitlementsContextResponse = {
  ok: boolean;
  tenantId: string;
  projectId: string;
  companyId: string | null;
  resolvedSaasId: string | null;
  projectEntitlements: NormalizedProjectEntitlements;
  inheritedContext: {
    source: EntitlementSource;
    resolvedSaasId: string | null;
    features: EntitlementsFeatureItem[];
    packs: EntitlementsPackItem[];
    errors: string[];
  };
};

type EntitlementsContextState =
  | { status: "idle" | "loading"; data: null; error: null }
  | { status: "ready"; data: EntitlementsContextResponse; error: null }
  | { status: "error"; data: null; error: string };

type LimitsEntry = { key: string; value: string };

function normalizeFeatureKey(value: string) {
  return value.trim().toLowerCase();
}

function normalizePackId(value: string) {
  return value.trim().toLowerCase();
}

function formatMetadataJSON(value: Record<string, unknown> | null) {
  if (!value) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

function buildLimitsEntries(limits: Record<string, number>) {
  return Object.keys(limits)
    .sort()
    .map((key) => ({ key, value: String(limits[key]) }));
}

type AddDomainFormProps = {
  domain: string;
  onDomainChange: (value: string) => void;
  loading: boolean;
  onSubmit: () => void;
};

function AddDomainForm({ domain, onDomainChange, loading, onSubmit }: AddDomainFormProps) {
  return (
    <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)]/50 p-4 shadow-inner shadow-[var(--border)]/10">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1 space-y-1">
          <label className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Nuevo dominio</label>
          <TextInput
            placeholder="example.com"
            value={domain}
            onChange={(event) => onDomainChange(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <p className="text-xs text-[var(--muted)]">Debe apuntar al registro CNAME indicado por operator.</p>
        </div>
        <Button onClick={onSubmit} loading={loading} disabled={loading} className="md:self-stretch">
          {loading ? "Guardando" : "Agregar dominio"}
        </Button>
      </div>
    </div>
  );
}

type DomainsSectionProps = {
  state: DomainsState;
  verifyingId: string | null;
  onReload: () => void;
  onAddRequest: () => void;
  onVerify: (domainId: string) => Promise<void>;
};

function DomainsSection({ state, verifyingId, onReload, onAddRequest, onVerify }: DomainsSectionProps) {
  if (state.status === "loading" && state.items.length === 0) {
    return <p className="text-sm text-[var(--muted)]">Cargando dominios…</p>;
  }

  if (state.status === "error") {
    return (
      <div className="rounded-2xl border border-rose-400/40 bg-rose-100/20 p-4 text-sm text-rose-900">
        <p className="mb-3 font-semibold">{state.error}</p>
        <Button variant="secondary" size="sm" onClick={onReload}>
          Reintentar carga
        </Button>
      </div>
    );
  }

  const items = state.items;
  if (items.length === 0) {
    return (
      <EmptyState title="Aún no hay dominios" subtitle="Registra el primero para comenzar la verificación.">
        <Button variant="secondary" size="sm" onClick={onAddRequest}>
          Sugerir dominio
        </Button>
      </EmptyState>
    );
  }

  return (
    <TableWrap>
      <Table>
        <THead>
          <tr className="text-left text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            <TH>Dominio</TH>
            <TH>Estado</TH>
            <TH>Último error</TH>
            <TH>Registrado</TH>
            <TH></TH>
          </tr>
        </THead>
        <TBody>
          {items.map((item) => {
            const statusLabel = getStatusLabel(item.status);
            const variant = getStatusBadgeVariant(item.status);
            const canVerify = ["pending", "error", "failed"].includes(item.status.toLowerCase());
            const showRetry = item.status.toLowerCase() === "error" || item.status.toLowerCase() === "failed";
            const isVerifying = verifyingId === item.id;
            const displayError = item.lastError ? truncate(item.lastError, 48) : "—";
            const errorContent = item.lastError ? (
              <Tooltip label={item.lastError}>
                <span className="max-w-xs truncate font-mono text-xs text-rose-500">{displayError}</span>
              </Tooltip>
            ) : (
              <span className="text-xs text-[var(--muted)]">Sin errores</span>
            );

            return (
              <tr key={item.id} className="border-t border-[var(--border)]/50">
                <TD className="py-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[var(--foreground)]">{item.domain}</p>
                    <p className="text-xs text-[var(--muted)]">ID: {item.id}</p>
                  </div>
                </TD>
                <TD>
                  <Badge variant={variant}>{statusLabel}</Badge>
                </TD>
                <TD>{errorContent}</TD>
                <TD>
                  <p className="text-xs text-[var(--muted)]">{formatDate(item.createdAt)}</p>
                  {item.updatedAt ? <p className="text-[10px] uppercase text-[var(--muted)]">Update: {formatDate(item.updatedAt)}</p> : null}
                </TD>
                <TD>
                  <div className="flex flex-wrap gap-2">
                    {canVerify ? (
                      <Button size="sm" variant="outline" onClick={() => void onVerify(item.id)} loading={isVerifying}>
                        Verify
                      </Button>
                    ) : null}
                    {showRetry ? (
                      <Button size="sm" variant="ghost" onClick={() => void onVerify(item.id)} disabled={isVerifying}>
                        Retry
                      </Button>
                    ) : null}
                  </div>
                </TD>
              </tr>
            );
          })}
        </TBody>
      </Table>
    </TableWrap>
  );
}

type ProjectDomainApi = {
  id: string;
  domain: string;
  status: string;
  verificationToken: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string | null;
};

type ProjectDetailApi = {
  ok: boolean;
  item: {
    project: {
      id: string;
      tenant_id: string;
      company_id: string | null;
      name: string;
      slug: string;
      status: string;
      created_at: string;
      updated_at: string;
    };
    domains: Array<{
      id: string;
      tenant_id: string;
      project_id: string;
      domain: string;
      status: string;
      verification_token: string | null;
      last_error: string | null;
      created_at: string;
      updated_at: string | null;
    }>;
    entitlements: {
      enabledPacks: string[];
      enabledFeatures: string[];
      limits: Record<string, number>;
      metadata: Record<string, unknown> | null;
      updatedAt: string | null;
    };
  };
};

type DetailState =
  | { status: "idle" | "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: ProjectDetailApi["item"] };

type DomainsState =
  | { status: "idle" | "loading"; items: ProjectDomainApi[]; error: null }
  | { status: "error"; items: ProjectDomainApi[]; error: string }
  | { status: "ready"; items: ProjectDomainApi[]; error: null };

function normalizeDomainRecord(record: ProjectDetailApi["item"]["domains"][number]): ProjectDomainApi {
  return {
    id: record.id,
    domain: record.domain,
    status: record.status,
    verificationToken: record.verification_token ?? null,
    lastError: record.last_error ?? null,
    createdAt: record.created_at,
    updatedAt: record.updated_at ?? null,
  };
}

function sanitizeDomainInput(input: string): string {
  return input.trim().toLowerCase();
}

const STATUS_LABEL_MAP: Record<string, string> = {
  pending: "Pendiente",
  verified: "Verificado",
  active: "Activo",
  error: "Error",
  failed: "Error",
};

function getStatusLabel(status: string): string {
  const key = status.toLowerCase();
  return STATUS_LABEL_MAP[key] ?? status;
}

function getStatusBadgeVariant(status: string): "ok" | "warn" | "neutral" | "err" | "info" {
  const key = status.toLowerCase();
  if (key === "verified" || key === "active") return "ok";
  if (key === "pending") return "warn";
  if (key === "error" || key === "failed") return "err";
  return "neutral";
}

function truncate(value: string, max = 42): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export default function OwnerProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [domainsState, setDomainsState] = useState<DomainsState>({ status: "idle", items: [], error: null });
  const [newDomain, setNewDomain] = useState("");
  const [adding, setAdding] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [entitlementsContextState, setEntitlementsContextState] = useState<EntitlementsContextState>({
    status: "idle",
    data: null,
    error: null,
  });
  const [selectedPacks, setSelectedPacks] = useState<Set<string>>(() => new Set());
  const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(() => new Set());
  const [limitsEntries, setLimitsEntries] = useState<LimitsEntry[]>([]);
  const [metadataText, setMetadataText] = useState("");
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [limitError, setLimitError] = useState<string | null>(null);
  const [savingEntitlements, setSavingEntitlements] = useState(false);
  const [formFeedback, setFormFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [customPackInput, setCustomPackInput] = useState("");
  const [customPackError, setCustomPackError] = useState<string | null>(null);
  const [customFeatureInput, setCustomFeatureInput] = useState("");
  const [customFeatureError, setCustomFeatureError] = useState<string | null>(null);
  const [showCustomFeatures, setShowCustomFeatures] = useState(false);
  const [lastKnownEntitlements, setLastKnownEntitlements] = useState<NormalizedProjectEntitlements | null>(null);

  type ActiveTab = "domains" | "entitlements" | "swarm" | "interview" | "quote";
  const [activeTab, setActiveTab] = useState<ActiveTab>("domains");

  const projectId = params?.id;

  const loadDomains = useCallback(
    async (targetProjectId: string) => {
      setDomainsState((prev) => ({ status: "loading", items: prev.items, error: null }));
      try {
        const res = await fetch(`/api/projects/${targetProjectId}/domains`, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Error ${res.status}`);
        }
        const payload = (await res.json().catch(() => null)) as { ok?: boolean; items?: ProjectDomainApi[] } | null;
        if (!payload?.ok || !Array.isArray(payload.items)) {
          throw new Error("Respuesta inválida del API de domains");
        }
        setDomainsState({ status: "ready", items: payload.items, error: null });
      } catch (error) {
        setDomainsState({
          status: "error",
          items: [],
          error: error instanceof Error ? error.message : "No se pudieron cargar los dominios",
        });
      }
    },
    [],
  );

  const fetchProjectDetail = useCallback(async () => {
    if (!projectId) {
      throw new Error("Identificador del proyecto no encontrado");
    }
    const res = await fetch(`/api/projects/${projectId}`, { cache: "no-store" });
    if (res.status === 404) {
      throw new Error("Proyecto no encontrado");
    }
    if (!res.ok) {
      throw new Error(`Error ${res.status}`);
    }
    const json = (await res.json().catch(() => null)) as ProjectDetailApi | null;
    if (!json?.ok || !json.item) {
      throw new Error("Respuesta inválida del API");
    }
    return json.item;
  }, [projectId]);

  const initializeEntitlementsForm = useCallback((entitlements: NormalizedProjectEntitlements) => {
    setSelectedPacks(() => new Set(entitlements.enabledPacks));
    setSelectedFeatures(() => new Set(entitlements.enabledFeatures));
    setLimitsEntries(buildLimitsEntries(entitlements.limits));
    setMetadataText(formatMetadataJSON(entitlements.metadata));
    setMetadataError(null);
    setLimitError(null);
    setFormFeedback(null);
    setCustomPackInput("");
    setCustomPackError(null);
    setCustomFeatureInput("");
    setCustomFeatureError(null);
    setLastKnownEntitlements(entitlements);
  }, []);

  const fetchEntitlementsContext = useCallback(
    async (signal?: { cancelled: boolean }) => {
      if (!projectId) return;
      setEntitlementsContextState({ status: "loading", data: null, error: null });
      try {
        const res = await fetch(`/api/projects/${projectId}/entitlements/context`, { cache: "no-store" });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? `Error ${res.status}`);
        }
        const payload = (await res.json().catch(() => null)) as EntitlementsContextResponse | null;
        if (!payload?.ok || !payload.projectEntitlements || !payload.inheritedContext) {
          throw new Error("Respuesta inválida del contexto de entitlements");
        }
        if (signal?.cancelled) return;
        initializeEntitlementsForm(payload.projectEntitlements);
        setEntitlementsContextState({ status: "ready", data: payload, error: null });
      } catch (error) {
        if (signal?.cancelled) return;
        setEntitlementsContextState({
          status: "error",
          data: null,
          error: error instanceof Error ? error.message : "No se pudo cargar el contexto de entitlements",
        });
      }
    },
    [projectId, initializeEntitlementsForm],
  );

  const loadProjectAndContext = useCallback(
    async (signal?: { cancelled: boolean }) => {
      const item = await fetchProjectDetail();
      if (signal?.cancelled) return;
      setState({ status: "ready", data: item });
      setDomainsState({ status: "ready", items: item.domains.map(normalizeDomainRecord), error: null });
      if (signal?.cancelled) return;
      void loadDomains(item.project.id);
      if (signal?.cancelled) return;
      await fetchEntitlementsContext(signal);
    },
    [fetchProjectDetail, loadDomains, fetchEntitlementsContext],
  );

  useEffect(() => {
    const signal = { cancelled: false };
    setState({ status: "loading" });
    loadProjectAndContext(signal).catch((error) => {
      if (signal.cancelled) return;
      setState({ status: "error", message: error instanceof Error ? error.message : "No se pudo cargar el proyecto" });
    });
    return () => {
      signal.cancelled = true;
    };
  }, [loadProjectAndContext]);

  const reloadProject = useCallback(() => {
    if (!projectId) return;
    const signal = { cancelled: false };
    setState({ status: "loading" });
    loadProjectAndContext(signal).catch((error) => {
      if (signal.cancelled) return;
      setState({ status: "error", message: error instanceof Error ? error.message : "No se pudo recargar el proyecto" });
    });
  }, [loadProjectAndContext, projectId]);

  const togglePackSelection = useCallback((packId: string) => {
    setSelectedPacks((prev) => {
      const next = new Set(prev);
      if (next.has(packId)) next.delete(packId);
      else next.add(packId);
      return next;
    });
  }, []);

  const toggleFeatureSelection = useCallback((featureKey: string) => {
    setSelectedFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(featureKey)) next.delete(featureKey);
      else next.add(featureKey);
      return next;
    });
  }, []);

  const addCustomPack = useCallback(() => {
    const normalized = normalizePackId(customPackInput);
    if (!normalized) {
      setCustomPackError("El pack es obligatorio.");
      return;
    }
    if (selectedPacks.has(normalized)) {
      setCustomPackError("El pack ya está incluido.");
      return;
    }
    setSelectedPacks((prev) => {
      const next = new Set(prev);
      next.add(normalized);
      return next;
    });
    setCustomPackInput("");
    setCustomPackError(null);
  }, [customPackInput, selectedPacks]);

  const removeCustomPack = useCallback((packId: string) => {
    setSelectedPacks((prev) => {
      const next = new Set(prev);
      next.delete(packId);
      return next;
    });
  }, []);

  const addCustomFeature = useCallback(() => {
    const normalized = normalizeFeatureKey(customFeatureInput);
    if (!normalized) {
      setCustomFeatureError("La funcionalidad es obligatoria.");
      return;
    }
    if (selectedFeatures.has(normalized)) {
      setCustomFeatureError("La funcionalidad ya está incluida.");
      return;
    }
    setSelectedFeatures((prev) => {
      const next = new Set(prev);
      next.add(normalized);
      return next;
    });
    setCustomFeatureInput("");
    setCustomFeatureError(null);
  }, [customFeatureInput, selectedFeatures]);

  const removeCustomFeature = useCallback((featureKey: string) => {
    setSelectedFeatures((prev) => {
      const next = new Set(prev);
      next.delete(featureKey);
      return next;
    });
  }, []);

  const addLimitEntry = useCallback(() => {
    setLimitsEntries((prev) => [...prev, { key: "", value: "" }]);
  }, []);

  const updateLimitEntry = useCallback((index: number, field: keyof LimitsEntry, value: string) => {
    setLimitsEntries((prev) => {
      const next = prev.slice();
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  const removeLimitEntry = useCallback((index: number) => {
    setLimitsEntries((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const handleSaveEntitlements = useCallback(async () => {
    if (!projectId) return;
    setSavingEntitlements(true);
    setFormFeedback(null);
    setMetadataError(null);
    setLimitError(null);
    try {
      let metadataValue: Record<string, unknown> | null = null;
      if (metadataText.trim()) {
        try {
          metadataValue = JSON.parse(metadataText);
        } catch {
          setMetadataError("JSON inválido");
          throw new Error("metadata_invalid");
        }
      }

      const limitsPayload: Record<string, number> = {};
      for (const entry of limitsEntries) {
        const key = entry.key.trim();
        if (!key) continue;
        const value = Number(entry.value);
        if (Number.isNaN(value) || value < 0) {
          setLimitError("Cada límite debe ser un número mayor o igual a 0");
          throw new Error("limits_invalid");
        }
        limitsPayload[key] = value;
      }

      const response = await fetch(`/api/projects/${projectId}/entitlements`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          enabled_features: Array.from(selectedFeatures),
          enabled_packs: Array.from(selectedPacks),
          limits: limitsPayload,
          metadata: metadataValue,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        throw new Error(payload?.error ?? `Error ${response.status}`);
      }
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!payload?.ok) {
        throw new Error(payload?.error ?? "No se pudo guardar los entitlements");
      }
      setFormFeedback({ type: "success", message: "Entitlements actualizados" });
      await loadProjectAndContext();
    } catch (error) {
      if (error instanceof Error && error.message === "metadata_invalid") {
        return;
      }
      if (error instanceof Error && error.message === "limits_invalid") {
        return;
      }
      setFormFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "No se pudo guardar los entitlements",
      });
    } finally {
      setSavingEntitlements(false);
    }
  }, [projectId, metadataText, limitsEntries, selectedFeatures, selectedPacks, loadProjectAndContext]);

  const handleCancelEntitlements = useCallback(() => {
    if (lastKnownEntitlements) {
      initializeEntitlementsForm(lastKnownEntitlements);
    }
    setFormFeedback(null);
    setMetadataError(null);
    setLimitError(null);
  }, [initializeEntitlementsForm, lastKnownEntitlements]);

  const headerTitle = state.status === "ready" ? state.data.project.name : "Project";
  const statusBadge = useMemo(() => {
    if (state.status !== "ready") return { label: "—", variant: "neutral" as const };
    const status = state.data.project.status?.toLowerCase();
    if (status === "active") return { label: "Activo", variant: "ok" as const };
    if (status === "archived") return { label: "Archivado", variant: "neutral" as const };
    return { label: state.data.project.status ?? "Desconocido", variant: "warn" as const };
  }, [state]);

  const entitlementsContextData = entitlementsContextState.status === "ready" ? entitlementsContextState.data : null;

  const featureInheritance = useMemo(() => {
    const map = new Map<string, EntitlementSource>();
    if (entitlementsContextState.status === "ready") {
      entitlementsContextState.data.inheritedContext.features.forEach((feature) => {
        map.set(feature.featureKey.toLowerCase(), feature.source);
      });
    }
    return map;
  }, [entitlementsContextState]);

  const packInheritance = useMemo(() => {
    const map = new Map<string, EntitlementSource>();
    if (entitlementsContextState.status === "ready") {
      entitlementsContextState.data.inheritedContext.packs.forEach((pack) => {
        map.set(pack.id, pack.source);
      });
    }
    return map;
  }, [entitlementsContextState]);

  const customFeatureKeys = useMemo(
    () => Array.from(selectedFeatures).filter((value) => !FEATURE_CATALOG_MAP.has(value)),
    [selectedFeatures],
  );

  const customPackIds = useMemo(
    () => Array.from(selectedPacks).filter((value) => !PACK_CATALOG_MAP.has(value)),
    [selectedPacks],
  );

  const contextSourceLabel = entitlementsContextState.status === "ready" ? entitlementsContextState.data.inheritedContext.source : "none";
  const resolvedSaasId = entitlementsContextState.status === "ready" ? entitlementsContextState.data.resolvedSaasId : null;
  const assignedFeatureCount = entitlementsContextData?.projectEntitlements.enabledFeatures.length ?? 0;
  const assignedPackCount = entitlementsContextData?.projectEntitlements.enabledPacks.length ?? 0;

  let body: React.ReactNode;
  if (state.status === "loading" || state.status === "idle") {
    body = (
      <Card tone="glass" title="Cargando proyecto" subtitle="Un momento…">
        <p className="text-sm text-[var(--muted)]">Obteniendo detalle desde la API.</p>
      </Card>
    );
  } else if (state.status === "error") {
    body = (
      <Card tone="glass" title="Error" subtitle="No se pudo recuperar la información">
        <p className="text-sm text-rose-400">{state.message}</p>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={() => router.push("/operator/projects")}>Volver a la lista</Button>
          <Button onClick={reloadProject}>Reintentar</Button>
        </div>
      </Card>
    );
  } else if (state.status === "ready") {
    const detail = state.data;
    const tabNav = (
      <div className="flex flex-wrap gap-2 border-b border-[var(--border)]/30 pb-4 mb-6">
        <Button size="sm" variant={activeTab === 'domains' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('domains')}>Domains</Button>
        <Button size="sm" variant={activeTab === 'entitlements' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('entitlements')}>Entitlements</Button>
        <Button size="sm" variant={activeTab === 'swarm' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('swarm')}>Swarm</Button>
        <Button size="sm" variant={activeTab === 'interview' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('interview')}>Interview</Button>
        <Button size="sm" variant={activeTab === 'quote' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('quote')}>Quote</Button>
      </div>
    );

    let tabContent: React.ReactNode = null;

    if (activeTab === "domains") {
      tabContent = (
        <>
          <Card tone="glass" title="Metadata" subtitle="Información principal">
            <div className="grid gap-4 md:grid-cols-3">
              <MetadataTile label="Estado">
                <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
              </MetadataTile>
              <MetadataTile label="Compañía">
                {detail.project.company_id ? detail.project.company_id : <span className="italic">Sin compañía</span>}
              </MetadataTile>
              <MetadataTile label="Slug">/{detail.project.slug}</MetadataTile>
              <MetadataTile label="Tenant">{detail.project.tenant_id}</MetadataTile>
              <MetadataTile label="Creado">{formatDate(detail.project.created_at)}</MetadataTile>
              <MetadataTile label="Actualizado">{formatDate(detail.project.updated_at)}</MetadataTile>
            </div>
          </Card>

          <Card
            title="Domains"
            subtitle="Gestión de dominios personalizados"
            right={<span className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">{domainsState.items.length} registrados</span>}
          >
            <div className="space-y-6">
              <AddDomainForm
                domain={newDomain}
                onDomainChange={setNewDomain}
                loading={adding}
                onSubmit={async () => {
                  if (!projectId) {
                    setFeedback({ type: "error", message: "Proyecto no disponible" });
                    return;
                  }
                  const normalized = sanitizeDomainInput(newDomain);
                  if (!normalized) {
                    setFeedback({ type: "error", message: "El dominio es obligatorio." });
                    return;
                  }
                  if (!normalized.includes(".")) {
                    setFeedback({ type: "error", message: "El dominio debe contener un punto." });
                    return;
                  }
                  setAdding(true);
                  setFeedback(null);
                  try {
                    const res = await fetch(`/api/projects/${projectId}/domains`, {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      cache: "no-store",
                      body: JSON.stringify({ domain: normalized }),
                    });
                    const payload = (await res.json().catch(() => null)) as { ok?: boolean; duplicated?: boolean; error?: string } | null;
                    if (!res.ok || !payload?.ok) {
                      throw new Error(payload?.error ?? "No se pudo registrar el dominio.");
                    }
                    setNewDomain("");
                    await loadDomains(projectId);
                    setFeedback({
                      type: "success",
                      message: payload.duplicated ? "El dominio ya existía y se reutilizó." : "Dominio añadido correctamente.",
                    });
                  } catch (error) {
                    setFeedback({ type: "error", message: error instanceof Error ? error.message : "No se pudo registrar el dominio." });
                  } finally {
                    setAdding(false);
                  }
                }}
              />

              {feedback ? (
                <div
                  className={`rounded-xl border px-4 py-3 text-sm ${feedback.type === "success"
                    ? "border-emerald-400/40 bg-emerald-100/20 text-emerald-900"
                    : "border-rose-400/60 bg-rose-100/30 text-rose-900"
                    }`}
                >
                  {feedback.message}
                </div>
              ) : null}

              <DomainsSection
                state={domainsState}
                verifyingId={verifying}
                onReload={() => projectId && loadDomains(projectId)}
                onAddRequest={() => setNewDomain((current) => current || "example.com")}
                onVerify={async (domainId) => {
                  if (!projectId) return;
                  setVerifying(domainId);
                  setFeedback(null);
                  try {
                    const res = await fetch(`/api/projects/${projectId}/domains/verify`, {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      cache: "no-store",
                      body: JSON.stringify({ domainId }),
                    });
                    const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
                    if (!res.ok || !payload?.ok) {
                      throw new Error(payload?.error ?? "Verificación fallida");
                    }
                    await loadDomains(projectId);
                    setFeedback({ type: "success", message: "Verificación solicitada. Revisa el estado en unos minutos." });
                  } catch (error) {
                    setFeedback({ type: "error", message: error instanceof Error ? error.message : "No se pudo verificar el dominio." });
                  } finally {
                    setVerifying(null);
                  }
                }}
              />
            </div>
          </Card>
        </>
      );
    }

    if (activeTab === "entitlements") {
      tabContent = (
        <Card title="Entitlements" subtitle="Packs y funcionalidades asignadas">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.25em] text-[var(--muted)]">
            <span>
              {contextSourceLabel === "none"
                ? "Sin contexto heredado"
                : `Contexto heredado · ${contextSourceLabel === "company" ? "Compañía" : "SaaS"}`}
            </span>
            {resolvedSaasId ? <span className="font-mono text-xs text-[var(--muted)]">SaaS: {resolvedSaasId}</span> : null}
          </div>
          {entitlementsContextState.status === "loading" ? (
            <p className="mt-4 text-sm text-[var(--muted)]">Cargando entitlements…</p>
          ) : entitlementsContextState.status === "error" ? (
            <div className="mt-4 rounded-2xl border border-rose-400/50 bg-rose-100/20 p-4 text-sm text-rose-900">
              <p>{entitlementsContextState.error}</p>
              <Button variant="secondary" size="sm" className="mt-3" onClick={reloadProject}>
                Reintentar carga
              </Button>
            </div>
          ) : (
            <>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <MetadataTile label="Última actualización">{formatDate(lastKnownEntitlements?.updatedAt)}</MetadataTile>
                <MetadataTile label="Total funcionalidades">{assignedFeatureCount + assignedPackCount}</MetadataTile>
              </div>
              <div className="mt-4 grid gap-6 lg:grid-cols-2">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">Packs</h3>
                  </div>
                  <div className="space-y-3">
                    {SAAS_PACK_DEFINITIONS.map((pack) => {
                      const isSelected = selectedPacks.has(pack.id);
                      const source: EntitlementSource = isSelected ? "project" : packInheritance.get(pack.id) ?? "none";
                      const badgeLabel = ENTITLEMENT_STATE_LABELS[source];
                      const badgeVariant = ENTITLEMENT_BADGE_VARIANTS[source];
                      const disabled = source === "company" || source === "saas";
                      return (
                        <label
                          key={pack.id}
                          className="grid grid-cols-[auto_1fr_auto] items-start gap-3 rounded-2xl border border-[var(--border)]/50 bg-[var(--surface)]/50 p-3 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={disabled}
                            className="h-4 w-4 rounded border-[var(--border)] bg-[var(--surface)]"
                            onChange={() => togglePackSelection(pack.id)}
                          />
                          <div>
                            <span className="font-semibold text-[var(--text)]">{pack.label}</span>
                            <p className="text-xs text-[var(--muted)]">{pack.description}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge variant={badgeVariant}>{badgeLabel}</Badge>
                            {disabled ? (
                              <Button size="xs" variant="ghost" onClick={() => togglePackSelection(pack.id)}>
                                Override
                              </Button>
                            ) : null}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <TextInput
                        placeholder="custom_pack_id"
                        value={customPackInput}
                        onChange={(event) => setCustomPackInput(event.target.value)}
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <Button size="sm" onClick={addCustomPack}>
                        Add custom pack
                      </Button>
                    </div>
                    {customPackError ? <p className="text-xs text-rose-400">{customPackError}</p> : null}
                    {customPackIds.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {customPackIds.map((customPack) => (
                          <span
                            key={customPack}
                            className="flex items-center gap-2 rounded-full border border-[var(--border)]/50 px-3 py-1 text-xs font-mono"
                          >
                            {customPack}
                            <button
                              type="button"
                              onClick={() => removeCustomPack(customPack)}
                              className="text-[var(--muted)] hover:text-[var(--foreground)]"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">Features</h3>
                    <Button size="xs" variant="ghost" onClick={() => setShowCustomFeatures((prev) => !prev)}>
                      {showCustomFeatures ? "Ocultar custom" : "Show custom/unknown"}
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(FEATURE_GROUPS).map(([category, items]) => (
                      <div key={category} className="space-y-2">
                        <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--muted)]">
                          {FEATURE_CATEGORY_LABELS[category as SaasFeatureCategory]}
                        </p>
                        <div className="space-y-2">
                          {items.map((feature) => {
                            const key = normalizeFeatureKey(feature.key);
                            const isSelected = selectedFeatures.has(key);
                            const source: EntitlementSource = isSelected ? "project" : featureInheritance.get(key) ?? "none";
                            const badgeLabel = ENTITLEMENT_STATE_LABELS[source];
                            const badgeVariant = ENTITLEMENT_BADGE_VARIANTS[source];
                            const disabled = source === "company" || source === "saas";
                            return (
                              <label
                                key={feature.key}
                                className="grid grid-cols-[auto_1fr_auto] items-start gap-3 rounded-2xl border border-[var(--border)]/50 bg-[var(--surface)]/50 p-3 text-sm"
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  disabled={disabled}
                                  className="h-4 w-4 rounded border-[var(--border)] bg-[var(--surface)]"
                                  onChange={() => toggleFeatureSelection(key)}
                                />
                                <div>
                                  <span className="font-semibold text-[var(--text)]">{feature.label}</span>
                                  {disabled ? (
                                    <p className="text-xs text-[var(--muted)]">
                                      Heredado desde {source === "company" ? "la compañía" : "SaaS"}.
                                    </p>
                                  ) : null}
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  <Badge variant={badgeVariant}>{badgeLabel}</Badge>
                                  {disabled ? (
                                    <Button size="xs" variant="ghost" onClick={() => toggleFeatureSelection(key)}>
                                      Override
                                    </Button>
                                  ) : null}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  {(showCustomFeatures || customFeatureKeys.length > 0) && (
                    <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)]/50 p-3">
                      <div className="flex items-center gap-2">
                        <TextInput
                          placeholder="custom_feature_key"
                          value={customFeatureInput}
                          onChange={(event) => setCustomFeatureInput(event.target.value)}
                          autoComplete="off"
                          spellCheck={false}
                        />
                        <Button size="sm" onClick={addCustomFeature}>
                          Add custom
                        </Button>
                      </div>
                      {customFeatureError ? <p className="mt-2 text-xs text-rose-400">{customFeatureError}</p> : null}
                      {customFeatureKeys.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {customFeatureKeys.map((key) => (
                            <span
                              key={key}
                              className="flex items-center gap-2 rounded-full border border-[var(--border)]/50 px-3 py-1 text-xs font-mono"
                            >
                              {key}
                              <button
                                type="button"
                                onClick={() => removeCustomFeature(key)}
                                className="text-[var(--muted)] hover:text-[var(--foreground)]"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-6 space-y-4 rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)]/50 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">Limits</h3>
                  <Button size="sm" variant="outline" onClick={addLimitEntry}>
                    Add limit
                  </Button>
                </div>
                {limitError ? <p className="text-xs text-rose-400">{limitError}</p> : null}
                <div className="space-y-3">
                  {limitsEntries.length === 0 ? (
                    <p className="text-xs text-[var(--muted)]">Sin límites configurados.</p>
                  ) : (
                    limitsEntries.map((entry, index) => (
                      <div key={`${entry.key}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                        <TextInput
                          placeholder="Clave"
                          value={entry.key}
                          onChange={(event) => updateLimitEntry(index, "key", event.target.value)}
                        />
                        <TextInput
                          placeholder="Valor"
                          value={entry.value}
                          onChange={(event) => updateLimitEntry(index, "value", event.target.value)}
                        />
                        <Button size="sm" variant="ghost" onClick={() => removeLimitEntry(index)}>
                          Remove
                        </Button>
                      </div>
                    ))
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">Metadata</h3>
                  {metadataError ? <p className="text-xs text-rose-400">{metadataError}</p> : null}
                  <TextArea rows={5} placeholder="{}" value={metadataText} onChange={(event) => setMetadataText(event.target.value)} />
                </div>
              </div>
              {formFeedback ? (
                <div
                  className={`rounded-xl border px-4 py-3 text-sm ${formFeedback.type === "success"
                    ? "border-emerald-400/40 bg-emerald-100/20 text-emerald-900"
                    : "border-rose-400/60 bg-rose-100/30 text-rose-900"
                    }`}
                >
                  {formFeedback.message}
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={handleSaveEntitlements} loading={savingEntitlements} disabled={savingEntitlements}>
                  {savingEntitlements ? "Guardando..." : "Save"}
                </Button>
                <Button variant="outline" onClick={handleCancelEntitlements} disabled={savingEntitlements}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </Card>
      );
    }

    if (activeTab === "swarm") {
      tabContent = (
        <Card title="Swarm Configuration" subtitle="Active Agents & Configuration">
          <EmptyState title="Swarm Configuration" subtitle="Configure and monitor your agent swarm." />
        </Card>
      );
    }
    if (activeTab === "interview") {
      tabContent = (
        <Card title="Interview Timeline" subtitle="Conversational Progress & Facts">
          <EmptyState title="Interview Engine" subtitle="Track the progress of the automated interview." />
        </Card>
      );
    }
    if (activeTab === "quote") {
      tabContent = (
        <Card title="Pricing Quote" subtitle="Financial Estimation">
          <EmptyState title="Pricing Engine" subtitle="View and manage the generated pricing quote." />
        </Card>
      );
    }

    body = (
      <>
        {tabNav}
        {tabContent}
      </>
    );

  } else {
    body = null;
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">Operator · Projects</p>
          <h1 className="text-3xl font-semibold text-[var(--text)]">{headerTitle}</h1>
          <p className="text-sm text-[var(--muted)]">Detalle del proyecto y sus recursos asociados.</p>
          {projectId ? <p className="text-xs text-[var(--muted)]">ID: {projectId}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => router.back()}>Regresar</Button>
          <Link href="/operator/projects">
            <Button variant="secondary">Ver lista</Button>
          </Link>
        </div>
      </header>

      {body}
    </div>
  );
}

type MetadataTileProps = {
  label: string;
  children: React.ReactNode;
};

function MetadataTile({ label, children }: MetadataTileProps) {
  return (
    <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)]/50 p-4">
      <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">{label}</p>
      <div className="mt-2 text-sm text-[var(--text)]">{children}</div>
    </div>
  );
}
