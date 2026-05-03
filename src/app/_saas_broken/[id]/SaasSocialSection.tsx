"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Badge from "@/components/ui/badge";
import EmptyState from "@/components/ui/empty-state";
import { Field, TextArea, TextInput } from "@/components/ui/input";
import type {
  SaasSocialAccount,
  SaasSocialCampaign,
  SaasSocialMetrics,
  SaasSocialPost,
  SocialCampaignPerformance,
  SocialConversionSnapshot,
  SocialPostPerformance,
  SocialCampaignIdea,
  SocialPostSuggestion,
} from "@/lib/social-core/types";

type Props = {
  saasId: string | null;
};

const ACCOUNT_PROVIDERS = ["INSTAGRAM", "FACEBOOK_PAGE", "TIKTOK", "WHATSAPP", "OTHER"] as const;
const CAMPAIGN_OBJECTIVES = ["FILL_AGENDA", "REACTIVATE_CUSTOMERS", "SELL_PRODUCT", "BUILD_BRAND"] as const;
const CAMPAIGN_SEGMENTS = ["NEW_CUSTOMERS", "INACTIVE_30D", "VIP", "ALL"] as const;
const POST_STATUSES = ["ALL", "DRAFT", "SCHEDULED", "POSTED", "FAILED"] as const;

export default function SaasSocialSection({ saasId }: Props) {
  const [overview, setOverview] = useState<{
    connectedAccounts: number;
    activeCampaigns: number;
    scheduledThisWeek: number;
    engagementLast30Days: number;
  } | null>(null);
  const [accounts, setAccounts] = useState<SaasSocialAccount[]>([]);
  const [campaigns, setCampaigns] = useState<SaasSocialCampaign[]>([]);
  const [posts, setPosts] = useState<SaasSocialPost[]>([]);
  const [metricsMap, setMetricsMap] = useState<Record<string, SaasSocialMetrics[]>>({});
  const [conversionSummary, setConversionSummary] = useState<SocialConversionSnapshot | null>(null);
  const [campaignPerformance, setCampaignPerformance] = useState<SocialCampaignPerformance[]>([]);
  const [postPerformance, setPostPerformance] = useState<SocialPostPerformance[]>([]);
  const [ideas, setIdeas] = useState<SocialCampaignIdea[]>([]);
  const [suggestedPosts, setSuggestedPosts] = useState<SocialPostSuggestion[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [campaignFilter, setCampaignFilter] = useState<string>("ALL");
  const [providerFilter, setProviderFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<typeof POST_STATUSES[number]>("ALL");
  const [loading, setLoading] = useState(true);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [postsLoading, setPostsLoading] = useState(false);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [publishingPost, setPublishingPost] = useState<Record<string, boolean>>({});
  const [formAccount, setFormAccount] = useState({ provider: "INSTAGRAM", handle: "", displayName: "" });
  const [formCampaign, setFormCampaign] = useState({
    name: "",
    objective: "FILL_AGENDA",
    targetSegment: "ALL",
    startDate: "",
    endDate: "",
    budgetEstimate: "",
    notes: "",
  });

  const loadOverview = useCallback(async () => {
    if (!saasId) return;
    try {
      const res = await fetch(`/api/social/overview?saasId=${encodeURIComponent(saasId)}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { overview?: typeof overview };
      setOverview(data.overview ?? null);
    } catch {
      setOverview(null);
    }
  }, [saasId]);

  const loadAccounts = useCallback(async () => {
    if (!saasId) return;
    try {
      const res = await fetch(`/api/social/accounts?saasId=${encodeURIComponent(saasId)}`, { cache: "no-store" });
      const data = (await res.json()) as { items?: SaasSocialAccount[] };
      setAccounts(data.items ?? []);
    } catch {
      setAccounts([]);
    }
  }, [saasId]);

  const loadCampaigns = useCallback(async () => {
    if (!saasId) return;
    try {
      const res = await fetch(`/api/social/campaigns?saasId=${encodeURIComponent(saasId)}`, { cache: "no-store" });
      const data = (await res.json()) as { items?: SaasSocialCampaign[] };
      setCampaigns(data.items ?? []);
    } catch {
      setCampaigns([]);
    }
  }, [saasId]);

  const loadPerformance = useCallback(async () => {
    if (!saasId) return;
    setPerformanceLoading(true);
    try {
      const [summaryRes, campaignsRes, postsRes] = await Promise.all([
        fetch(`/api/social/analytics/summary?saasId=${encodeURIComponent(saasId)}`, { cache: "no-store" }),
        fetch(`/api/social/analytics/campaigns?saasId=${encodeURIComponent(saasId)}`, { cache: "no-store" }),
        fetch(`/api/social/analytics/posts?saasId=${encodeURIComponent(saasId)}`, { cache: "no-store" }),
      ]);
      const summaryJson = (await summaryRes.json().catch(() => null)) as { summary?: SocialConversionSnapshot } | null;
      const campaignsJson = (await campaignsRes.json().catch(() => null)) as { items?: SocialCampaignPerformance[] } | null;
      const postsJson = (await postsRes.json().catch(() => null)) as { items?: SocialPostPerformance[] } | null;
      setConversionSummary(summaryJson?.summary ?? null);
      setCampaignPerformance(campaignsJson?.items ?? []);
      setPostPerformance(postsJson?.items ?? []);
    } catch {
      setConversionSummary(null);
      setCampaignPerformance([]);
      setPostPerformance([]);
    } finally {
      setPerformanceLoading(false);
    }
  }, [saasId]);

  const loadPosts = useCallback(async () => {
    if (!saasId) return;
    setPostsLoading(true);
    try {
      const params = new URLSearchParams({ saasId });
      if (campaignFilter !== "ALL") params.set("campaignId", campaignFilter);
      if (providerFilter !== "ALL") params.set("provider", providerFilter);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      const res = await fetch(`/api/social/posts?${params.toString()}`, { cache: "no-store" });
      const data = (await res.json()) as { items?: SaasSocialPost[] };
      setPosts(data.items ?? []);
    } finally {
      setPostsLoading(false);
    }
  }, [saasId, campaignFilter, providerFilter, statusFilter]);

  const loadMetrics = useCallback(
    async (postId: string) => {
      if (!saasId) return;
      try {
        const res = await fetch(`/api/social/metrics?saasId=${encodeURIComponent(saasId)}&postId=${encodeURIComponent(postId)}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { items?: SaasSocialMetrics[] };
        setMetricsMap((prev) => ({ ...prev, [postId]: data.items ?? [] }));
      } catch {
        setMetricsMap((prev) => ({ ...prev, [postId]: [] }));
      }
    },
    [saasId],
  );

  useEffect(() => {
    if (!saasId) return;
    setLoading(true);
    Promise.all([loadOverview(), loadAccounts(), loadCampaigns(), loadPosts(), loadPerformance()]).finally(() => setLoading(false));
  }, [loadOverview, loadAccounts, loadCampaigns, loadPosts, loadPerformance, saasId]);

  useEffect(() => {
    posts.forEach((post) => {
      if (!metricsMap[post.id]) {
        void loadMetrics(post.id);
      }
    });
  }, [posts, metricsMap, loadMetrics]);

  const overviewCards = useMemo(
    () => [
      { label: "Cuentas conectadas", value: overview?.connectedAccounts ?? 0 },
      { label: "Campañas activas", value: overview?.activeCampaigns ?? 0 },
      { label: "Posts esta semana", value: overview?.scheduledThisWeek ?? 0 },
      { label: "Engagement 30d", value: overview?.engagementLast30Days ?? 0 },
    ],
    [overview],
  );

  const providerOptions = useMemo(() => {
    const set = new Set<string>();
    accounts.forEach((account) => set.add(account.provider));
    if (set.size === 0) {
      ["INSTAGRAM", "FACEBOOK_PAGE", "TIKTOK", "WHATSAPP", "OTHER"].forEach((provider) => set.add(provider));
    }
    return ["ALL", ...Array.from(set)];
  }, [accounts]);

  const activeFilters = useMemo(() => {
    const filters = [];
    if (statusFilter !== "ALL") filters.push(`Estado: ${statusFilter}`);
    if (campaignFilter !== "ALL") {
      const campaignName = campaigns.find((item) => item.id === campaignFilter)?.name ?? campaignFilter;
      filters.push(`Campaña: ${campaignName}`);
    }
    if (providerFilter !== "ALL") filters.push(`Provider: ${providerFilter}`);
    return filters;
  }, [statusFilter, campaignFilter, providerFilter, campaigns]);

  const filteredPerformancePosts = useMemo(() => {
    if (campaignFilter === "ALL") return postPerformance;
    return postPerformance.filter((post) => post.campaignId === campaignFilter);
  }, [postPerformance, campaignFilter]);

  function formatCurrency(value: number) {
    return `${value.toFixed(0)} €`;
  }

  function performanceLabel(appointmentsCount: number, revenue: number) {
    if (appointmentsCount === 0) return { label: "Sin conversión", variant: "neutral" as const };
    if (revenue < 80) return { label: "Baja", variant: "warn" as const };
    return { label: "Alta", variant: "ok" as const };
  }

  async function submitAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!saasId) return;
    await fetch("/api/social/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        saasId,
        provider: formAccount.provider,
        handle: formAccount.handle.trim() || null,
        displayName: formAccount.displayName.trim() || null,
        status: "CONNECTED_DEMO",
        isPrimary: accounts.length === 0,
      }),
    });
    setFormAccount({ provider: "INSTAGRAM", handle: "", displayName: "" });
    await loadAccounts();
    await loadOverview();
  }

  async function submitCampaign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!saasId || !formCampaign.name.trim()) return;
    await fetch("/api/social/campaigns", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        saasId,
        name: formCampaign.name.trim(),
        objective: formCampaign.objective,
        status: "DRAFT",
        targetSegment: formCampaign.targetSegment,
        startDate: formCampaign.startDate || null,
        endDate: formCampaign.endDate || null,
        budgetEstimate: formCampaign.budgetEstimate ? Number(formCampaign.budgetEstimate) : null,
        notes: formCampaign.notes.trim() || null,
      }),
    });
    setFormCampaign({
      name: "",
      objective: "FILL_AGENDA",
      targetSegment: "ALL",
      startDate: "",
      endDate: "",
      budgetEstimate: "",
      notes: "",
    });
    await loadCampaigns();
    await loadOverview();
  }

  async function generateIdeas() {
    if (!saasId) return;
    setIdeasLoading(true);
    try {
      const res = await fetch(`/api/social/content/ideas?saasId=${encodeURIComponent(saasId)}`, { cache: "no-store" });
      const data = (await res.json()) as { ideas?: SocialCampaignIdea[] };
      setIdeas(data.ideas ?? []);
    } finally {
      setIdeasLoading(false);
    }
  }

  function applyIdea(idea: SocialCampaignIdea) {
    setFormCampaign((prev) => ({
      ...prev,
      name: idea.title,
      objective: idea.objective as (typeof CAMPAIGN_OBJECTIVES)[number],
      targetSegment: idea.targetSegment as (typeof CAMPAIGN_SEGMENTS)[number],
      notes: idea.notes,
    }));
  }

  async function generatePostSuggestions() {
    if (!saasId || !selectedCampaignId) return;
    const res = await fetch(
      `/api/social/content/posts?saasId=${encodeURIComponent(saasId)}&campaignId=${encodeURIComponent(selectedCampaignId)}`,
      { cache: "no-store" },
    );
    const data = (await res.json()) as { suggestions?: SocialPostSuggestion[] };
    setSuggestedPosts(data.suggestions ?? []);
  }

  async function createPostFromSuggestion(suggestion: SocialPostSuggestion) {
    if (!saasId) return;
    await fetch("/api/social/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        saasId,
        campaignId: selectedCampaignId,
        provider: suggestion.provider,
        contentType: suggestion.contentType,
        title: suggestion.title,
        body: suggestion.body,
        imageHint: suggestion.imageHint,
        status: "DRAFT",
      }),
    });
    await loadPosts();
  }

  async function markPostAsPublished(postId: string) {
    setPublishingPost((prev) => ({ ...prev, [postId]: true }));
    try {
      await fetch(`/api/social/posts/${postId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "POSTED" }),
      });
      await loadPosts();
      await loadOverview();
      await loadPerformance();
    } finally {
      setPublishingPost((prev) => ({ ...prev, [postId]: false }));
    }
  }

  if (loading) {
    return (
      <Card tone="glass" title="Social Engine" subtitle="Cargando cuentas y campañas">
        <p className="text-sm text-[var(--muted)]">Preparando panel social…</p>
      </Card>
    );
  }

  return (
    <section className="space-y-4" aria-label="Social Engine" id="social-section">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Social Engine</p>
          <h2 className="text-xl font-semibold">Campañas y contenido</h2>
          <p className="text-sm text-[var(--muted)]">Ideas deterministas listas para OAuth.</p>
        </div>
        <Button
          onClick={() => void Promise.all([loadOverview(), loadCampaigns(), loadPosts(), loadPerformance()])}
          variant="ghost"
        >
          Refrescar
        </Button>
      </div>

      <Card tone="glass" title="Plan social incluido" subtitle="Referencia de posts por suscripcion">
        <div className="grid gap-3 text-sm text-[var(--muted)] md:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.2em]">Incluido</p>
            <p>Core: 4 posts organicos/mes</p>
            <p>Growth: 8 posts/mes</p>
            <p>Pro: 12-16 posts/mes</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.2em]">Packs extra</p>
            <p>Social Pack +8 posts/mes (fee adicional)</p>
            <p>Social Pack +16 posts/mes (fee adicional)</p>
            <p>Gestion de Ads (fee fijo)</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">
          El presupuesto de Ads (Google/Meta) lo paga el cliente directamente. Drako solo cobra la gestion si se contrata.
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {overviewCards.map((card) => (
          <Card key={card.label} tone="glass" title={card.label} className="!p-4">
            <p className="text-2xl font-semibold">{card.value}</p>
          </Card>
        ))}
      </div>

      <Card tone="glass" title="Cuentas sociales" subtitle="Listo para OAuth">
        <div className="flex flex-wrap gap-3">
          {accounts.length === 0 ? (
            <EmptyState title="Sin cuentas" subtitle="Conecta Instagram o TikTok para arrancar campañas." />
          ) : (
            accounts.map((account) => (
              <div key={account.id} className="rounded-2xl border border-[var(--border)]/60 bg-[var(--panel-alt)] px-4 py-3 text-sm">
                <p className="font-semibold">{account.displayName ?? account.handle ?? account.provider}</p>
                <p className="text-xs text-[var(--muted)]">{account.provider}</p>
                <Badge variant={account.status === "CONNECTED_REAL" ? "ok" : "info"}>{account.status}</Badge>
              </div>
            ))
          )}
        </div>
        <form onSubmit={submitAccount} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
          <Field label="Proveedor">
            <select
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              value={formAccount.provider}
              onChange={(event) => setFormAccount((prev) => ({ ...prev, provider: event.target.value }))}
            >
              {ACCOUNT_PROVIDERS.map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Handle">
            <TextInput
              value={formAccount.handle}
              onChange={(event) => setFormAccount((prev) => ({ ...prev, handle: event.target.value }))}
              placeholder="@peluqueria"
            />
          </Field>
          <Field label="Nombre visible">
            <TextInput
              value={formAccount.displayName}
              onChange={(event) => setFormAccount((prev) => ({ ...prev, displayName: event.target.value }))}
              placeholder="Peluqueria Demo"
            />
          </Field>
          <div className="flex items-end">
            <Button type="submit">Añadir cuenta social</Button>
          </div>
        </form>
      </Card>

      <Card tone="glass" title="Campañas" subtitle="Planifica objetivos y segmentos">
        <div className="flex flex-wrap gap-3">
          <Button onClick={generateIdeas} variant="outline" disabled={ideasLoading}>
            {ideasLoading ? "Generando..." : "Generar ideas de campaña"}
          </Button>
          {ideas.length > 0 && <span className="text-xs text-[var(--muted)]">Selecciona una idea para precargar.</span>}
        </div>
        {ideas.length > 0 && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {ideas.map((idea, idx) => (
              <div key={`${idea.title}-${idx}`} className="rounded-2xl border border-[var(--border)]/60 bg-[var(--panel-alt)] p-3">
                <p className="font-semibold">{idea.title}</p>
                <p className="text-xs text-[var(--muted)]">{idea.notes}</p>
                <Button size="sm" variant="ghost" onClick={() => applyIdea(idea)}>
                  Crear campaña desde idea
                </Button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={submitCampaign} className="mt-4 grid gap-3 md:grid-cols-3">
          <Field label="Nombre">
            <TextInput
              value={formCampaign.name}
              onChange={(event) => setFormCampaign((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Campaña nueva"
              required
            />
          </Field>
          <Field label="Objetivo">
            <select
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              value={formCampaign.objective}
              onChange={(event) => setFormCampaign((prev) => ({ ...prev, objective: event.target.value }))}
            >
              {CAMPAIGN_OBJECTIVES.map((objective) => (
                <option key={objective} value={objective}>
                  {objective}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Segmento">
            <select
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              value={formCampaign.targetSegment}
              onChange={(event) => setFormCampaign((prev) => ({ ...prev, targetSegment: event.target.value }))}
            >
              {CAMPAIGN_SEGMENTS.map((segment) => (
                <option key={segment} value={segment}>
                  {segment}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Inicio">
            <TextInput
              type="date"
              value={formCampaign.startDate}
              onChange={(event) => setFormCampaign((prev) => ({ ...prev, startDate: event.target.value }))}
            />
          </Field>
          <Field label="Fin">
            <TextInput
              type="date"
              value={formCampaign.endDate}
              onChange={(event) => setFormCampaign((prev) => ({ ...prev, endDate: event.target.value }))}
            />
          </Field>
          <Field label="Presupuesto estimado">
            <TextInput
              type="number"
              min="0"
              value={formCampaign.budgetEstimate}
              onChange={(event) => setFormCampaign((prev) => ({ ...prev, budgetEstimate: event.target.value }))}
            />
          </Field>
          <Field label="Notas">
            <TextArea
              value={formCampaign.notes}
              onChange={(event) => setFormCampaign((prev) => ({ ...prev, notes: event.target.value }))}
              rows={2}
            />
          </Field>
          <div className="flex items-end">
            <Button type="submit">Nueva campaña</Button>
          </div>
        </form>

        {campaigns.length === 0 ? (
          <EmptyState title="Sin campañas" subtitle="Crea la primera campaña social." />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="modern text-sm" aria-label="Tabla de campañas">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Objetivo</th>
                  <th>Segmento</th>
                  <th>Estado</th>
                  <th>Posts</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td className="font-semibold">{campaign.name}</td>
                    <td>{campaign.objective}</td>
                    <td>{campaign.targetSegment}</td>
                    <td>
                      <Badge variant={campaign.status === "ACTIVE" ? "ok" : campaign.status === "PAUSED" ? "warn" : "neutral"}>
                        {campaign.status}
                      </Badge>
                    </td>
                    <td>{posts.filter((post) => post.campaignId === campaign.id).length}</td>
                    <td>
                      <Button
                        size="sm"
                        variant={selectedCampaignId === campaign.id ? "outline" : "ghost"}
                        onClick={() => {
                          setSelectedCampaignId(campaign.id);
                          setCampaignFilter(campaign.id);
                        }}
                      >
                        Seleccionar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card tone="glass" title="Posts" subtitle="Programación y sugerencias">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <Field label="Estado">
              <select
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as typeof POST_STATUSES[number])}
              >
                {POST_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Campaña">
              <select
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                value={campaignFilter}
                onChange={(event) => setCampaignFilter(event.target.value)}
              >
                <option value="ALL">Todas</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Provider">
              <select
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                value={providerFilter}
                onChange={(event) => setProviderFilter(event.target.value)}
              >
                {providerOptions.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Button variant="outline" disabled={!selectedCampaignId} onClick={generatePostSuggestions}>
            Generar posts sugeridos
          </Button>
        </div>
        {activeFilters.length > 0 && <p className="mt-2 text-xs text-[var(--muted)]">Filtros activos: {activeFilters.join(" · ")}</p>}

        {selectedCampaignId && suggestedPosts.length > 0 && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {suggestedPosts.map((suggestion, idx) => (
              <div key={`${suggestion.title}-${idx}`} className="rounded-2xl border border-[var(--border)]/60 bg-[var(--panel-alt)] p-3">
                <p className="font-semibold">{suggestion.title}</p>
                <p className="text-xs text-[var(--muted)]">{suggestion.body}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant={suggestion.stockStatus === "OK" ? "ok" : suggestion.stockStatus === "LOW_STOCK" ? "warn" : "err"}>
                    {suggestion.stockStatus}
                  </Badge>
                  <Badge variant={suggestion.marginStatus === "OK" ? "ok" : suggestion.marginStatus === "LOW_MARGIN" ? "warn" : "err"}>
                    {suggestion.marginStatus}
                  </Badge>
                </div>
                <Button size="sm" variant="outline" onClick={() => createPostFromSuggestion(suggestion)}>
                  Crear como borrador
                </Button>
              </div>
            ))}
          </div>
        )}

        {postsLoading ? (
          <p className="text-sm text-[var(--muted)]">Cargando posts...</p>
        ) : posts.length === 0 ? (
          <EmptyState title="Sin posts" subtitle="Genera sugerencias para empezar." />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="modern text-sm" aria-label="Tabla de posts">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Campaña</th>
                  <th>Provider</th>
                  <th>Estado</th>
                  <th>Programado</th>
                  <th>Publicado</th>
                  <th>Engagement</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => {
                  const campaign = campaigns.find((item) => item.id === post.campaignId);
                  const metrics = metricsMap[post.id]?.[0];
                  const engagement = metrics
                    ? metrics.likes + metrics.comments + metrics.shares + metrics.clicks
                    : null;
                  const isPublishing = Boolean(publishingPost[post.id]);
                  return (
                    <tr key={post.id}>
                      <td className="font-semibold">{post.title}</td>
                      <td>{campaign?.name ?? "—"}</td>
                      <td>{post.provider}</td>
                      <td>
                        <Badge variant={post.status === "SCHEDULED" ? "info" : post.status === "POSTED" ? "ok" : "neutral"}>
                          {post.status}
                        </Badge>
                      </td>
                      <td>{post.scheduledAt ? new Date(post.scheduledAt).toLocaleString("es-ES") : "—"}</td>
                      <td>{post.postedAt ? new Date(post.postedAt).toLocaleString("es-ES") : "—"}</td>
                      <td>{engagement ?? "—"}</td>
                      <td>
                        {(post.status === "DRAFT" || post.status === "SCHEDULED") && (
                          <Button size="sm" variant="outline" onClick={() => markPostAsPublished(post.id)} disabled={isPublishing}>
                            {isPublishing ? "Publicando..." : "Marcar como publicado"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card tone="glass" title="Performance / ROI" subtitle="Citas e ingresos atribuidos a Social">
        {performanceLoading ? (
          <p className="text-sm text-[var(--muted)]">Cargando rendimiento social...</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Card tone="glass" title="Citas desde Social" className="!p-4">
                <p className="text-2xl font-semibold">{conversionSummary?.totalAppointmentsFromSocial ?? 0}</p>
              </Card>
              <Card tone="glass" title="Ingresos estimados" className="!p-4">
                <p className="text-2xl font-semibold">
                  {conversionSummary ? formatCurrency(conversionSummary.totalRevenueFromSocial) : "0 €"}
                </p>
              </Card>
              <Card tone="glass" title="Top campaña" className="!p-4">
                <p className="text-sm font-semibold">
                  {conversionSummary?.topCampaigns?.[0]?.name ?? "Sin datos"}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {conversionSummary?.topCampaigns?.[0]
                    ? formatCurrency(conversionSummary.topCampaigns[0].estimatedRevenue)
                    : "—"}
                </p>
              </Card>
            </div>

            <div className="mt-4 space-y-3">
              <h3 className="text-sm font-semibold">Campañas</h3>
              {campaignPerformance.length === 0 ? (
                <EmptyState title="Sin datos de campañas" subtitle="Aún no hay conversiones atribuidas." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="modern text-sm" aria-label="Tabla de campañas performance">
                    <thead>
                      <tr>
                        <th>Campaña</th>
                        <th>Provider</th>
                        <th>Posts</th>
                        <th>Citas</th>
                        <th>Ingresos estimados</th>
                        <th>Margen medio</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaignPerformance.map((item) => {
                        const badge = performanceLabel(item.appointmentsCount, item.estimatedRevenue);
                        return (
                          <tr key={item.campaignId}>
                            <td className="font-semibold">{item.name}</td>
                            <td>{item.provider}</td>
                            <td>{item.postsCount}</td>
                            <td>{item.appointmentsCount}</td>
                            <td>{formatCurrency(item.estimatedRevenue)}</td>
                            <td>{typeof item.averageMarginPercent === "number" ? `${item.averageMarginPercent.toFixed(0)}%` : "—"}</td>
                            <td>
                              <Badge variant={badge.variant}>{badge.label}</Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-semibold">Posts</h3>
              {filteredPerformancePosts.length === 0 ? (
                <EmptyState title="Sin posts atribuidos" subtitle="Selecciona otra campaña o crea publicaciones." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="modern text-sm" aria-label="Tabla de posts performance">
                    <thead>
                      <tr>
                        <th>Post</th>
                        <th>Campaña</th>
                        <th>Estado</th>
                        <th>Citas</th>
                        <th>Ingresos estimados</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPerformancePosts.map((post) => (
                        <tr key={post.postId}>
                          <td className="font-semibold">{post.title ?? post.postId}</td>
                          <td>{campaigns.find((item) => item.id === post.campaignId)?.name ?? "—"}</td>
                          <td>{post.status}</td>
                          <td>{post.appointmentsCount}</td>
                          <td>{formatCurrency(post.estimatedRevenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </Card>
    </section>
  );
}
