"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/card";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import Select from "@/components/ui/select";
import EmptyState from "@/components/ui/empty-state";
import { TextArea, TextInput } from "@/components/ui/input";
import type {
  KnowledgeAudience,
  KnowledgeImportance,
  SaasKnowledgeDocument,
  SaasKnowledgeDocumentStatus,
  SaasKnowledgeDocumentType,
  SaasKnowledgeLinkTargetType,
  SaasKnowledgeSpace,
} from "@/lib/knowledge/types";

type Props = {
  saasId: string | null;
};

const STATUS_OPTIONS: Array<{ value: SaasKnowledgeDocumentStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "Todos" },
  { value: "ACTIVE", label: "Activos" },
  { value: "DRAFT", label: "Borrador" },
  { value: "ARCHIVED", label: "Archivados" },
];

const TYPE_OPTIONS: SaasKnowledgeDocumentType[] = ["MANUAL", "CHECKLIST", "SCRIPT", "FAQ", "TEMPLATE", "POLICY"];
const AUDIENCE_OPTIONS: KnowledgeAudience[] = ["OWNER", "STAFF", "BOTH"];
const IMPORTANCE_OPTIONS: KnowledgeImportance[] = ["INFO", "STANDARD", "CRITICAL"];
const LINK_TARGET_OPTIONS: SaasKnowledgeLinkTargetType[] = ["SERVICE", "ROLE", "EMPLOYEE", "TASK", "AUTOPILOT_KEY"];

type KnowledgeLinkItem = {
  id: string;
  targetType: SaasKnowledgeLinkTargetType;
  targetId: string;
  targetLabel: string;
};

export default function SaasKnowledgeSection({ saasId }: Props) {
  const [spaces, setSpaces] = useState<SaasKnowledgeSpace[]>([]);
  const [documents, setDocuments] = useState<SaasKnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<SaasKnowledgeDocumentStatus | "ALL">("ALL");
  const [spaceFilter, setSpaceFilter] = useState<string>("ALL");
  const [query, setQuery] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<SaasKnowledgeDocument | null>(null);
  const [docLinks, setDocLinks] = useState<KnowledgeLinkItem[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [linkForm, setLinkForm] = useState({ targetType: "SERVICE", targetId: "" });
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    spaceId: "",
    type: "MANUAL",
    status: "ACTIVE",
    audience: "BOTH",
    importance: "STANDARD",
    tags: "",
    content: "",
    summary: "",
  });

  const loadSpaces = useCallback(async () => {
    if (!saasId) return;
    try {
      const res = await fetch(`/api/knowledge/spaces?saasId=${encodeURIComponent(saasId)}`, { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { spaces?: SaasKnowledgeSpace[] } | null;
      setSpaces(data?.spaces ?? []);
    } catch {
      setSpaces([]);
    }
  }, [saasId]);

  const loadDocuments = useCallback(async () => {
    if (!saasId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ saasId });
      if (spaceFilter !== "ALL") params.set("spaceId", spaceFilter);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (query.trim()) params.set("q", query.trim());
      const res = await fetch(`/api/knowledge/documents?${params.toString()}`, { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { items?: SaasKnowledgeDocument[] } | null;
      setDocuments(data?.items ?? []);
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [query, saasId, spaceFilter, statusFilter]);

  useEffect(() => {
    void loadSpaces();
  }, [loadSpaces]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const spaceLabelById = useMemo(() => new Map(spaces.map((space) => [space.id, space.label])), [spaces]);

  const handleCreateDocument = async () => {
    if (!saasId || !form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/knowledge/documents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          saasId,
          spaceId: form.spaceId || null,
          title: form.title.trim(),
          type: form.type as SaasKnowledgeDocumentType,
          status: form.status as SaasKnowledgeDocumentStatus,
          audience: form.audience as KnowledgeAudience,
          importance: form.importance as KnowledgeImportance,
          content: form.content,
          summary: form.summary.trim() || null,
          tags: form.tags
            ? form.tags
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean)
            : null,
          source: "MANUAL_OWNER",
        }),
      });
      if (!res.ok) throw new Error("No se pudo crear el documento");
      setForm({
        title: "",
        spaceId: "",
        type: "MANUAL",
        status: "ACTIVE",
        audience: "BOTH",
        importance: "STANDARD",
        tags: "",
        content: "",
        summary: "",
      });
      void loadDocuments();
    } catch {
      // ignore, surface later if needed
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateDoc = async (doc: SaasKnowledgeDocument, updates: Partial<SaasKnowledgeDocument>) => {
    if (!saasId) return;
    await fetch(`/api/knowledge/documents/${encodeURIComponent(doc.id)}?saasId=${encodeURIComponent(saasId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(updates),
    });
    void loadDocuments();
  };

  const loadLinks = useCallback(
    async (docId: string) => {
      if (!saasId) return;
      setLinksLoading(true);
      try {
        const res = await fetch(
          `/api/knowledge/documents/${encodeURIComponent(docId)}/links?saasId=${encodeURIComponent(saasId)}`,
          { cache: "no-store" },
        );
        const data = (await res.json().catch(() => null)) as { links?: KnowledgeLinkItem[] } | null;
        setDocLinks(data?.links ?? []);
      } catch {
        setDocLinks([]);
      } finally {
        setLinksLoading(false);
      }
    },
    [saasId],
  );

  useEffect(() => {
    if (!selectedDoc) {
      setDocLinks([]);
      return;
    }
    setLinkForm({ targetType: "SERVICE", targetId: "" });
    void loadLinks(selectedDoc.id);
  }, [loadLinks, selectedDoc]);

  const handleAddLink = async () => {
    if (!saasId || !selectedDoc || !linkForm.targetId.trim()) return;
    await fetch(`/api/knowledge/documents/${encodeURIComponent(selectedDoc.id)}/links?saasId=${encodeURIComponent(saasId)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        targetType: linkForm.targetType,
        targetId: linkForm.targetId.trim(),
      }),
    });
    setLinkForm({ targetType: "SERVICE", targetId: "" });
    void loadLinks(selectedDoc.id);
  };

  const handleDeleteLink = async (linkId: string) => {
    if (!saasId || !selectedDoc) return;
    await fetch(
      `/api/knowledge/documents/${encodeURIComponent(selectedDoc.id)}/links?saasId=${encodeURIComponent(saasId)}&linkId=${encodeURIComponent(linkId)}`,
      { method: "DELETE" },
    );
    void loadLinks(selectedDoc.id);
  };

  return (
    <section className="space-y-4" aria-label="Knowledge Base">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Knowledge Base</p>
        <h2 className="text-xl font-semibold">Playbooks y protocolos</h2>
        <p className="text-sm text-[var(--muted)]">Base interna para staff, tasks y agentes.</p>
      </div>

      <Card tone="glass" title="Filtros">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm text-[var(--muted)]">
            Espacio
            <Select value={spaceFilter} onChange={(event) => setSpaceFilter(event.target.value)}>
              <option value="ALL">Todos</option>
              {spaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-sm text-[var(--muted)]">
            Estado
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as SaasKnowledgeDocumentStatus | "ALL")}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-sm text-[var(--muted)]">
            Buscar
            <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por título o resumen" />
          </label>
        </div>
      </Card>

      {loading ? (
        <Card title="Cargando" subtitle="Leyendo documentos">
          <p className="text-sm text-[var(--muted)]">Un momento…</p>
        </Card>
      ) : documents.length === 0 ? (
        <EmptyState title="Sin documentos" subtitle="Crea un playbook para empezar." />
      ) : (
        <Card tone="glass" title="Documentos">
          <div className="overflow-x-auto">
            <table className="modern text-sm" aria-label="Knowledge documents">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Espacio</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Audiencia</th>
                  <th>Importancia</th>
                  <th>Tags</th>
                  <th>Actualizado</th>
                  <th>CTA</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td className="font-semibold">{doc.title}</td>
                    <td>{spaceLabelById.get(doc.spaceId ?? "") ?? "—"}</td>
                    <td>{doc.type}</td>
                    <td>
                      <Badge variant={doc.status === "ACTIVE" ? "ok" : doc.status === "DRAFT" ? "warn" : "neutral"}>
                        {doc.status}
                      </Badge>
                    </td>
                    <td>
                      <Badge variant={doc.audience === "OWNER" ? "neutral" : doc.audience === "STAFF" ? "ok" : "outline"}>
                        {doc.audience}
                      </Badge>
                    </td>
                    <td>
                      <Badge variant={doc.importance === "CRITICAL" ? "err" : doc.importance === "STANDARD" ? "warn" : "outline"}>
                        {doc.importance}
                      </Badge>
                    </td>
                    <td>{doc.tags?.join(", ") ?? "—"}</td>
                    <td>{new Date(doc.updatedAt).toLocaleDateString()}</td>
                    <td>
                      <Button size="sm" variant="outline" onClick={() => setSelectedDoc(doc)}>
                        Editar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card tone="glass" title="Nuevo documento">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm text-[var(--muted)]">
            Título
            <TextInput value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} />
          </label>
          <label className="text-sm text-[var(--muted)]">
            Espacio
            <Select value={form.spaceId} onChange={(event) => setForm((prev) => ({ ...prev, spaceId: event.target.value }))}>
              <option value="">Sin espacio</option>
              {spaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-sm text-[var(--muted)]">
            Tipo
            <Select value={form.type} onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}>
              {TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-sm text-[var(--muted)]">
            Estado
            <Select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}>
              <option value="ACTIVE">ACTIVE</option>
              <option value="DRAFT">DRAFT</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </Select>
          </label>
          <label className="text-sm text-[var(--muted)]">
            Audiencia
            <Select value={form.audience} onChange={(event) => setForm((prev) => ({ ...prev, audience: event.target.value }))}>
              {AUDIENCE_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-sm text-[var(--muted)]">
            Importancia
            <Select value={form.importance} onChange={(event) => setForm((prev) => ({ ...prev, importance: event.target.value }))}>
              {IMPORTANCE_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-sm text-[var(--muted)] md:col-span-2">
            Resumen
            <TextInput value={form.summary} onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))} />
          </label>
          <label className="text-sm text-[var(--muted)] md:col-span-2">
            Tags (comma separated)
            <TextInput value={form.tags} onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))} />
          </label>
          <label className="text-sm text-[var(--muted)] md:col-span-2">
            Contenido
            <TextArea rows={5} value={form.content} onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))} />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={handleCreateDocument} disabled={saving || !form.title.trim() || !form.content.trim()}>
            {saving ? "Guardando..." : "Crear documento"}
          </Button>
        </div>
      </Card>

      {selectedDoc && (
        <Card tone="glass" title="Editar documento">
          <div className="space-y-3 text-sm">
            <p className="font-semibold">{selectedDoc.title}</p>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs text-[var(--muted)]">
                Audiencia
                <Select
                  value={selectedDoc.audience}
                  onChange={(event) =>
                    setSelectedDoc((prev) => (prev ? { ...prev, audience: event.target.value as KnowledgeAudience } : prev))
                  }
                >
                  {AUDIENCE_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="text-xs text-[var(--muted)]">
                Importancia
                <Select
                  value={selectedDoc.importance}
                  onChange={(event) =>
                    setSelectedDoc((prev) => (prev ? { ...prev, importance: event.target.value as KnowledgeImportance } : prev))
                  }
                >
                  {IMPORTANCE_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
            <TextArea
              rows={6}
              value={selectedDoc.content}
              onChange={(event) => setSelectedDoc((prev) => (prev ? { ...prev, content: event.target.value } : prev))}
            />
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Enlaces</p>
              {linksLoading ? (
                <p className="text-xs text-[var(--muted)]">Cargando enlaces…</p>
              ) : docLinks.length === 0 ? (
                <p className="text-xs text-[var(--muted)]">Sin enlaces todavía.</p>
              ) : (
                <ul className="space-y-2">
                  {docLinks.map((link) => (
                    <li key={link.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-2 py-1">
                      <span className="text-xs text-[var(--muted)]">
                        {link.targetType}: {link.targetLabel}
                      </span>
                      <Button size="xs" variant="ghost" onClick={() => handleDeleteLink(link.id)}>
                        Eliminar
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="grid gap-2 md:grid-cols-[1fr,2fr,auto]">
                <Select value={linkForm.targetType} onChange={(event) => setLinkForm((prev) => ({ ...prev, targetType: event.target.value }))}>
                  {LINK_TARGET_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
                <TextInput
                  placeholder="Target ID"
                  value={linkForm.targetId}
                  onChange={(event) => setLinkForm((prev) => ({ ...prev, targetId: event.target.value }))}
                />
                <Button size="sm" variant="outline" onClick={handleAddLink} disabled={!linkForm.targetId.trim()}>
                  Añadir
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  selectedDoc &&
                  handleUpdateDoc(selectedDoc, {
                    content: selectedDoc.content,
                    audience: selectedDoc.audience,
                    importance: selectedDoc.importance,
                  })
                }
              >
                Guardar cambios
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedDoc(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        </Card>
      )}
    </section>
  );
}
