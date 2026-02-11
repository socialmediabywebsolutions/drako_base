"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/card";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import Select from "@/components/ui/select";
import { TextArea, TextInput } from "@/components/ui/input";
import EmptyState from "@/components/ui/empty-state";
import type { SaasBlueprint, SaasModule } from "@/lib/blueprints/types";
import type { SaasPackDefinition } from "@/lib/packs/types";

type Props = {
  saasId: string | null;
};

const BUSINESS_TYPES = [
  { value: "SALON", label: "Peluquería" },
  { value: "CLINIC", label: "Clínica" },
  { value: "LAUNDRY", label: "Lavandería" },
  { value: "PET_CARE", label: "Mascotas" },
  { value: "OTHER", label: "Otro" },
] as const;

const PRIMARY_GOALS = [
  { value: "FILL_AGENDA", label: "Llenar agenda" },
  { value: "MAX_MARGIN", label: "Maximizar margen" },
  { value: "SCALE", label: "Escalar" },
  { value: "STABILIZE", label: "Estabilizar" },
] as const;

const MATURITY_STAGES = [
  { value: "STARTER", label: "Starter" },
  { value: "GROWTH", label: "Growth" },
  { value: "PRO", label: "Pro" },
  { value: "MULTI_SITE", label: "Multi-site" },
] as const;

const MAIN_PAIN_OPTIONS = [
  { value: "AGENDA_VACIA", label: "Agenda vacía" },
  { value: "CAOS_ADMIN", label: "Caos administrativo" },
  { value: "NO_SE_CUANTO_GANO", label: "No sé cuánto gano" },
  { value: "NO_LLEGAN_LEADS", label: "No llegan leads" },
  { value: "OTRO", label: "Otro" },
] as const;

const PHASE_LABELS = [
  { phase: 0, label: "Fase 0 · Instalación" },
  { phase: 1, label: "Fase 1 · Captación" },
  { phase: 2, label: "Fase 2 · Retención" },
  { phase: 3, label: "Fase 3 · Escala" },
] as const;

const statusVariant = {
  ACTIVE: "ok",
  PLANNED: "warn",
  DISABLED: "neutral",
} as const;

export default function SaasBlueprintSection({ saasId }: Props) {
  const [blueprint, setBlueprint] = useState<SaasBlueprint | null>(null);
  const [modules, setModules] = useState<SaasModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [packs, setPacks] = useState<SaasPackDefinition[]>([]);
  const [currentPack, setCurrentPack] = useState<SaasPackDefinition | null>(null);
  const [packReason, setPackReason] = useState<string | null>(null);
  const [packApplying, setPackApplying] = useState(false);
  const [packMessage, setPackMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    businessType: "SALON",
    primaryGoal: "FILL_AGENDA",
    maturityStage: "STARTER",
    notes: "",
  });

  const [interview, setInterview] = useState({
    staffCount: 3,
    averageTicket: 65,
    hasSocial: true,
    hasEmailIntake: true,
    mainPain: "AGENDA_VACIA",
  });

  const loadBlueprint = useCallback(async () => {
    if (!saasId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/blueprints/saas?saasId=${encodeURIComponent(saasId)}`, { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "No se pudo cargar el blueprint");
      }
      const data = (await res.json()) as { blueprint?: SaasBlueprint | null; modules?: SaasModule[] };
      const loadedBlueprint = data.blueprint ?? null;
      setBlueprint(loadedBlueprint);
      setModules(data.modules ?? []);
      setForm((prev) => ({
        businessType: loadedBlueprint?.businessType ?? prev.businessType,
        primaryGoal: loadedBlueprint?.primaryGoal ?? prev.primaryGoal,
        maturityStage: loadedBlueprint?.maturityStage ?? prev.maturityStage,
        notes: loadedBlueprint?.notes ?? "",
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el blueprint");
      setBlueprint(null);
      setModules([]);
    } finally {
      setLoading(false);
    }
  }, [saasId]);

  useEffect(() => {
    void loadBlueprint();
  }, [loadBlueprint]);

  const loadPacks = useCallback(async () => {
    try {
      const res = await fetch("/api/packs", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { items?: SaasPackDefinition[] } | null;
      setPacks(data?.items ?? []);
    } catch {
      setPacks([]);
    }
  }, []);

  const loadCurrentPack = useCallback(async () => {
    if (!saasId) return;
    try {
      const res = await fetch(`/api/packs/current?saasId=${encodeURIComponent(saasId)}`, { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { pack?: SaasPackDefinition | null; reason?: string } | null;
      setCurrentPack(data?.pack ?? null);
      setPackReason(data?.reason ?? null);
    } catch {
      setCurrentPack(null);
      setPackReason(null);
    }
  }, [saasId]);

  useEffect(() => {
    void loadPacks();
    void loadCurrentPack();
  }, [loadCurrentPack, loadPacks]);

  const modulesByPhase = useMemo(() => {
    return PHASE_LABELS.map((phase) => ({
      ...phase,
      items: modules.filter((module) => module.phase === phase.phase),
    }));
  }, [modules]);

  const handleSave = async () => {
    if (!saasId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/blueprints/saas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          saasId,
          businessType: form.businessType,
          primaryGoal: form.primaryGoal,
          maturityStage: form.maturityStage,
          notes: form.notes?.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "No se pudo guardar el blueprint");
      }
      const data = (await res.json()) as { blueprint?: SaasBlueprint };
      setBlueprint(data.blueprint ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el blueprint");
    } finally {
      setSaving(false);
    }
  };

  const handleInterview = async () => {
    if (!saasId) return;
    setInterviewLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/blueprints/saas/interview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          saasId,
          businessType: form.businessType,
          primaryGoal: form.primaryGoal,
          maturityStage: form.maturityStage,
          staffCount: interview.staffCount,
          averageTicket: interview.averageTicket,
          hasSocial: interview.hasSocial,
          hasEmailIntake: interview.hasEmailIntake,
          mainPain: interview.mainPain,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "No se pudo recalcular el blueprint");
      }
      const data = (await res.json()) as { blueprint?: SaasBlueprint; modules?: SaasModule[] };
      setBlueprint(data.blueprint ?? null);
      setModules(data.modules ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo recalcular el blueprint");
    } finally {
      setInterviewLoading(false);
    }
  };

  const handleApplyPack = async (packId: string) => {
    if (!saasId) return;
    setPackApplying(true);
    setPackMessage(null);
    try {
      const res = await fetch("/api/packs/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ saasId, packId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "No se pudo aplicar el pack");
      }
      const data = (await res.json().catch(() => null)) as {
        appliedFeatures?: string[];
        appliedBlueprintModules?: string[];
        warnings?: string[];
      } | null;
      const appliedCount = (data?.appliedFeatures?.length ?? 0) + (data?.appliedBlueprintModules?.length ?? 0);
      setPackMessage(appliedCount > 0 ? `Pack aplicado · ${appliedCount} elementos activados.` : "Pack aplicado sin cambios.");
      if (data?.warnings?.length) {
        const warningsText = data.warnings?.join(" ") ?? "";
        setPackMessage((prev) => `${prev ?? ""} Avisos: ${warningsText}`);
      }
      window.dispatchEvent(new Event("features:refresh"));
      window.dispatchEvent(new Event("owner-control:refresh"));
      void loadBlueprint();
      void loadCurrentPack();
    } catch (err) {
      setPackMessage(err instanceof Error ? err.message : "No se pudo aplicar el pack");
    } finally {
      setPackApplying(false);
    }
  };

  return (
    <section className="space-y-4" aria-label="Blueprint & SaaS Factory">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Blueprint & SaaS Factory</p>
        <h2 className="text-xl font-semibold">Mapa de módulos y fases</h2>
        <p className="text-sm text-[var(--muted)]">
          Define el tipo de negocio, objetivo principal y la fase para activar módulos coherentes.
        </p>
      </div>

      {loading && <p className="text-sm text-[var(--muted)]">Cargando blueprint...</p>}
      {error && <p className="text-sm text-red-300">{error}</p>}

      {!loading && !blueprint && modules.length === 0 && (
        <EmptyState title="Sin blueprint" subtitle="Configura el blueprint o usa la entrevista rápida para generarlo." />
      )}

      <Card tone="glass" title="Blueprint del negocio" subtitle="Configura el tipo y la fase actual">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm text-[var(--muted)]">
            Tipo de negocio
            <Select
              value={form.businessType}
              onChange={(event) => setForm((prev) => ({ ...prev, businessType: event.target.value }))}
            >
              {BUSINESS_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-sm text-[var(--muted)]">
            Objetivo principal
            <Select
              value={form.primaryGoal}
              onChange={(event) => setForm((prev) => ({ ...prev, primaryGoal: event.target.value }))}
            >
              {PRIMARY_GOALS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-sm text-[var(--muted)]">
            Fase / Maturity
            <Select
              value={form.maturityStage}
              onChange={(event) => setForm((prev) => ({ ...prev, maturityStage: event.target.value }))}
            >
              {MATURITY_STAGES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-sm text-[var(--muted)]">
            Notas
            <TextArea
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Notas sobre el objetivo o situación"
            />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={handleSave} disabled={saving || !saasId}>
            {saving ? "Guardando..." : "Guardar blueprint"}
          </Button>
        </div>
      </Card>

      <Card tone="glass" title="Pack recomendado" subtitle="Plantillas por vertical">
        <div className="space-y-3 text-sm">
          {currentPack ? (
            <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--panel)]/60 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{currentPack.label}</p>
                  <p className="text-xs text-[var(--muted)]">{currentPack.description}</p>
                </div>
                <Badge variant="outline">{currentPack.vertical}</Badge>
              </div>
              {packReason && <p className="mt-2 text-xs text-[var(--muted)]">Origen: {packReason}</p>}
            </div>
          ) : (
            <p className="text-xs text-[var(--muted)]">No se ha detectado un pack todavía.</p>
          )}
          {packMessage && <p className="text-xs text-[var(--muted)]">{packMessage}</p>}
          <div className="grid gap-3 md:grid-cols-2">
            {packs.map((pack) => (
              <div key={pack.id} className="rounded-xl border border-[var(--border)]/60 bg-[var(--panel)]/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{pack.label}</p>
                  <Badge variant={currentPack?.id === pack.id ? "ok" : "outline"}>{pack.vertical}</Badge>
                </div>
                <p className="mt-1 text-xs text-[var(--muted)]">{pack.description}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleApplyPack(pack.id)}
                  disabled={packApplying || !saasId}
                  className="mt-2"
                >
                  {packApplying ? "Aplicando..." : "Aplicar este pack"}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card tone="glass" title="Módulos por fase" subtitle="Estado actual y próximos pasos">
        <div className="space-y-4">
          {modulesByPhase.map((phase) => (
            <div key={phase.phase} className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{phase.label}</p>
              {phase.items.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Sin módulos en esta fase.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {phase.items.map((module) => (
                    <div
                      key={module.id}
                      className="rounded-xl border border-[var(--border)] bg-[var(--panel-alt)] p-3 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold">{module.label}</p>
                          <p className="text-xs text-[var(--muted)]">{module.code}</p>
                        </div>
                        <Badge variant={statusVariant[module.status]}>{module.status}</Badge>
                      </div>
                      {module.description && <p className="mt-2 text-xs text-[var(--muted)]">{module.description}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card tone="glass" title="Entrevista rápida" subtitle="Recalcula módulos según el negocio">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm text-[var(--muted)]">
            Nº de empleados
            <TextInput
              type="number"
              min={0}
              value={interview.staffCount}
              onChange={(event) => setInterview((prev) => ({ ...prev, staffCount: Number(event.target.value) }))}
            />
          </label>
          <label className="text-sm text-[var(--muted)]">
            Ticket medio (€)
            <TextInput
              type="number"
              min={0}
              value={interview.averageTicket}
              onChange={(event) => setInterview((prev) => ({ ...prev, averageTicket: Number(event.target.value) }))}
            />
          </label>
          <label className="text-sm text-[var(--muted)]">
            Redes sociales activas
            <Select
              value={interview.hasSocial ? "yes" : "no"}
              onChange={(event) => setInterview((prev) => ({ ...prev, hasSocial: event.target.value === "yes" }))}
            >
              <option value="yes">Sí</option>
              <option value="no">No</option>
            </Select>
          </label>
          <label className="text-sm text-[var(--muted)]">
            Facturas por email
            <Select
              value={interview.hasEmailIntake ? "yes" : "no"}
              onChange={(event) => setInterview((prev) => ({ ...prev, hasEmailIntake: event.target.value === "yes" }))}
            >
              <option value="yes">Sí</option>
              <option value="no">No</option>
            </Select>
          </label>
          <label className="text-sm text-[var(--muted)] md:col-span-2">
            Dolor principal
            <Select
              value={interview.mainPain}
              onChange={(event) => setInterview((prev) => ({ ...prev, mainPain: event.target.value }))}
            >
              {MAIN_PAIN_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={handleInterview} disabled={interviewLoading || !saasId}>
            {interviewLoading ? "Calculando..." : "Recalcular blueprint"}
          </Button>
        </div>
      </Card>
    </section>
  );
}
