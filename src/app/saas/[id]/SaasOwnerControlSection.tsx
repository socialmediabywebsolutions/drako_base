"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/card";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import Link from "next/link";
import type { OwnerControlSnapshot } from "@/lib/owner/types";
import { SAAS_PACK_DEFINITIONS } from "@/lib/packs/definitions";
import type { SaasFeatureKey } from "@/lib/features/types";
import type { SaasPackDefinition } from "@/lib/packs/types";

type Entitlements = {
  featureKeys: Set<SaasFeatureKey>;
  packIds: Set<string>;
};

function resolveEntitlements(snapshot: OwnerControlSnapshot | null): Entitlements {
  const featureKeys = new Set<SaasFeatureKey>();
  const packIds = new Set<string>();
  if (snapshot?.companyFeatures) {
    snapshot.companyFeatures.forEach((feature) => {
      if (feature.status === "ENABLED") {
        featureKeys.add(feature.featureKey);
      }
    });
  }
  if (snapshot?.companyPacks) {
    snapshot.companyPacks.forEach((pack) => {
      if (pack.id) {
        packIds.add(pack.id);
      }
    });
  }
  if (snapshot?.currentPack?.id) {
    packIds.add(snapshot.currentPack.id);
  }
  return { featureKeys, packIds };
}

function formatRequirementBadge({
  label,
  enabled,
}: {
  label: string;
  enabled: boolean;
}): JSX.Element {
  return <Badge variant={enabled ? "outline" : "err"}>{label}</Badge>;
}

type Props = {
  saasId: string | null;
};

const statusLabel = {
  CAN_HIRE: "Puedes contratar",
  BORDERLINE: "En observacion",
  CANNOT_HIRE: "No contratar",
} as const;

const statusVariant = {
  CAN_HIRE: "ok",
  BORDERLINE: "warn",
  CANNOT_HIRE: "err",
} as const;

function formatCurrency(value?: number | null) {
  if (typeof value !== "number") return "—";
  return `${value.toFixed(0)} €`;
}

const severityVariant = {
  CRITICAL: "err",
  WARNING: "warn",
  SUGGESTION: "info",
  INFO: "neutral",
} as const;

function sortBySeverity(
  a: NonNullable<OwnerControlSnapshot["autopilotActions"]>[number],
  b: NonNullable<OwnerControlSnapshot["autopilotActions"]>[number],
) {
  const order = { CRITICAL: 0, WARNING: 1, SUGGESTION: 2, INFO: 3 };
  return order[a.severity] - order[b.severity];
}

function getEngagementNote(score?: number) {
  if (typeof score !== "number") return "Sin datos suficientes de engagement.";
  if (score < 50) return "Engagement bajo, prueba una campaña de reactivación.";
  if (score < 150) return "Engagement moderado, mantén la cadencia.";
  return "Buen movimiento, mantén la cadencia.";
}

export default function SaasOwnerControlSection({ saasId }: Props) {
  const [snapshot, setSnapshot] = useState<OwnerControlSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [materializing, setMaterializing] = useState(false);
  const [materializeMessage, setMaterializeMessage] = useState<string | null>(null);
  const entitlements = useMemo(() => resolveEntitlements(snapshot), [snapshot]);
  const packLookup = useMemo(() => new Map<string, SaasPackDefinition | undefined>(SAAS_PACK_DEFINITIONS.map((pack) => [pack.id, pack])), []);

  const loadSnapshot = useCallback(async () => {
    if (!saasId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/owner/control-snapshot?saasId=${encodeURIComponent(saasId)}`, { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "No se pudo cargar el snapshot");
      }
      const data = (await res.json()) as { snapshot?: OwnerControlSnapshot };
      setSnapshot(data.snapshot ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el snapshot");
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, [saasId]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    function handleRefresh() {
      void loadSnapshot();
    }
    window.addEventListener("owner-control:refresh", handleRefresh);
    return () => window.removeEventListener("owner-control:refresh", handleRefresh);
  }, [loadSnapshot]);

  const handleMaterializeTasks = async () => {
    if (!saasId) return;
    setMaterializing(true);
    setMaterializeMessage(null);
    try {
      const res = await fetch("/api/tasks/autopilot-materialize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ saasId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "No se pudieron crear tareas");
      }
      const data = (await res.json().catch(() => null)) as { count?: number } | null;
      const count = data?.count ?? 0;
      setMaterializeMessage(count > 0 ? `Creadas ${count} tareas nuevas.` : "No hay tareas nuevas.");
      window.dispatchEvent(new Event("tasks:refresh"));
    } catch (err) {
      setMaterializeMessage(err instanceof Error ? err.message : "No se pudieron crear tareas");
    } finally {
      setMaterializing(false);
    }
  };

  return (
    <section className="space-y-4" aria-label="Owner Control Tower">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Owner Control Tower</p>
          <h2 className="text-xl font-semibold">Visión 360º de margen, equipo y proveedores</h2>
          {snapshot?.blueprintSummary && (
            <p className="mt-1 text-xs text-[var(--muted)]">
              Blueprint: {snapshot.blueprintSummary.businessType} · Objetivo: {snapshot.blueprintSummary.primaryGoal} · Fase:{" "}
              {snapshot.blueprintSummary.maturityStage} · Módulos activos: {snapshot.blueprintSummary.activeModulesCount}/
              {snapshot.blueprintSummary.activeModulesCount + snapshot.blueprintSummary.plannedModulesCount}
            </p>
          )}
          {snapshot?.currentPack && (
            <p className="mt-1 text-xs text-[var(--muted)]">
              Pack actual: {snapshot.currentPack.label} ({snapshot.currentPack.vertical})
              {snapshot.recommendedPackId && snapshot.recommendedPackId !== snapshot.currentPack.id
                ? ` · Recomendado: ${SAAS_PACK_DEFINITIONS.find((pack) => pack.id === snapshot.recommendedPackId)?.label ?? snapshot.recommendedPackId}`
                : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/owner/catalog">
            <Button variant="outline" size="sm">Ver catálogo</Button>
          </Link>
          <Button variant="ghost" onClick={loadSnapshot}>Refrescar</Button>
        </div>
      </div>

      {loading && <p className="text-sm text-[var(--muted)]">Cargando snapshot...</p>}
      {error && <p className="text-sm text-red-300">{error}</p>}
      {!loading && !snapshot && <EmptyState title="Sin datos" subtitle="No se pudo construir el snapshot del owner." />}

      {snapshot && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            <Card tone="glass" title="Margen estimado" className="!p-3">
              <p className="text-2xl font-semibold">
                {snapshot.economy.marginPercentEstimated?.toFixed(0) ?? "—"}% / {snapshot.economy.targetMarginPercent?.toFixed(0) ?? "—"}%
              </p>
              <p className="text-xs text-[var(--muted)]">Objetivo vs actual</p>
            </Card>
            <Card tone="glass" title="Fairness" className="!p-3">
              <p className="text-2xl font-semibold">
                {snapshot.hr.employeesTotal - snapshot.hr.overworkedCount} OK · {snapshot.hr.overworkedCount} en riesgo
              </p>
              <p className="text-xs text-[var(--muted)]">Sobrecarga detectada</p>
            </Card>
            <Card tone="glass" title="Ahorro potencial" className="!p-3">
              <p className="text-2xl font-semibold">{formatCurrency(snapshot.emailIntake.potentialSavingsPerMonth)}</p>
              <p className="text-xs text-[var(--muted)]">Por ofertas de proveedores</p>
            </Card>
            <Card tone="glass" title="Social Health" className="!p-3">
              {snapshot.social ? (
                <div className="space-y-1 text-xs text-[var(--muted)]">
                  <p className="text-base font-semibold text-[var(--text)]">
                    {snapshot.social.accountsConnected} cuentas · {snapshot.social.activeCampaigns} campañas
                  </p>
                  <p>Posts programados: {snapshot.social.scheduledPostsThisWeek}</p>
                  <p>{getEngagementNote(snapshot.social.recentEngagementScore)}</p>
                  {snapshot.social.accountsConnected > 0 && snapshot.social.scheduledPostsThisWeek === 0 && (
                    <p className="text-[var(--warn)]">Tienes cuentas conectadas pero ninguna publicación programada esta semana.</p>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const el = document.getElementById("social-section");
                      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  >
                    Abrir Social & Campaigns
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-[var(--muted)]">Sin datos sociales todavía.</p>
              )}
            </Card>
          </div>

          <Card tone="glass" title="Social ROI">
            {snapshot.socialConversion ? (
              <div className="space-y-2 text-sm">
                <p>Citas desde redes: <span className="font-semibold">{snapshot.socialConversion.totalAppointmentsFromSocial}</span></p>
                <p>Ingresos estimados: <span className="font-semibold">{formatCurrency(snapshot.socialConversion.totalRevenueFromSocial)}</span></p>
                {snapshot.socialConversion.topCampaignName ? (
                  <p>
                    Top campaña: <span className="font-semibold">{snapshot.socialConversion.topCampaignName}</span>{" "}
                    {typeof snapshot.socialConversion.topCampaignRevenue === "number"
                      ? `(${formatCurrency(snapshot.socialConversion.topCampaignRevenue)})`
                      : ""}
                  </p>
                ) : (
                  <p className="text-[var(--muted)]">Todavía no hay citas atribuibles a campañas sociales.</p>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const el = document.getElementById("social-section");
                    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  Ver detalle Social & Campaigns
                </Button>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">Todavía no hay citas atribuibles a campañas sociales.</p>
            )}
          </Card>

          <Card tone="glass" title="Drako Autopilot · Qué hacer hoy" subtitle="Playbook diario prioritizado">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleMaterializeTasks} disabled={materializing}>
                {materializing ? "Creando tareas..." : "Convertir en tareas"}
              </Button>
              {materializeMessage && <span className="text-xs text-[var(--muted)]">{materializeMessage}</span>}
              <span className="ml-auto text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
                Features activos: {entitlements.featureKeys.size} · Packs activos: {entitlements.packIds.size}
              </span>
            </div>
            {!snapshot.autopilotActions || snapshot.autopilotActions.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                Hoy no hay alertas críticas. Revisa igualmente tus métricas clave y campañas.
              </p>
            ) : (
              <div className="space-y-4">
                {Object.entries(
                  snapshot.autopilotActions.sort(sortBySeverity).reduce<Record<string, typeof snapshot.autopilotActions>>((acc, action) => {
                    if (!acc[action.category]) acc[action.category] = [];
                    acc[action.category].push(action);
                    return acc;
                  }, {}),
                ).map(([category, actions]) => (
                  <div key={category} className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{category}</p>
                    <div className="space-y-2">
                      {actions.map((action) => {
                        const missingFeatures = (action.requiresFeatures ?? []).filter((key) => !entitlements.featureKeys.has(key));
                        const missingPacks = (action.requiresPacks ?? []).filter((packId) => !entitlements.packIds.has(packId));
                        const isLocked = missingFeatures.length > 0 || missingPacks.length > 0;
                        return (
                          <div
                            key={action.id}
                            className={`rounded-xl border ${
                              isLocked ? "border-[var(--warn)]/50 bg-[var(--panel)]" : "border-[var(--border)] bg-[var(--panel-alt)]"
                            } p-3 text-sm`}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={severityVariant[action.severity]}>{action.severity}</Badge>
                              <p className="font-semibold">{action.title}</p>
                              {action.targetArea && (
                                <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                                  {action.targetArea}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-sm text-[var(--muted)]">{action.description}</p>
                            {(action.requiresFeatures?.length || action.requiresPacks?.length) && (
                              <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px] uppercase tracking-[0.18em]">
                                {(action.requiresFeatures ?? []).map((key) => {
                                  const enabled = entitlements.featureKeys.has(key);
                                  return (
                                    <span key={key}>{formatRequirementBadge({ label: key, enabled })}</span>
                                  );
                                })}
                                {(action.requiresPacks ?? []).map((packId) => {
                                  const pack = packLookup.get(packId);
                                  const enabled = entitlements.packIds.has(packId);
                                  return (
                                    <span key={packId}>{formatRequirementBadge({ label: pack?.label ?? packId, enabled })}</span>
                                  );
                                })}
                              </div>
                            )}
                            {isLocked && (
                              <p className="mt-2 text-xs text-[var(--warn)]">
                                Acción bloqueada: activa {missingFeatures.length > 0 ? `feature${missingFeatures.length > 1 ? "s" : ""} ${missingFeatures.join(", ")}` : ""}
                                {missingFeatures.length > 0 && missingPacks.length > 0 ? " y " : ""}
                                {missingPacks.length > 0
                                  ? `pack${missingPacks.length > 1 ? "s" : ""} ${missingPacks
                                      .map((packId) => packLookup.get(packId)?.label ?? packId)
                                      .join(", ")}`
                                  : ""}
                                .
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card tone="glass" title="Can Hire Advisor" subtitle="Recomendación automática basada en datos">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={statusVariant[snapshot.canHireAdvice.status]}>{statusLabel[snapshot.canHireAdvice.status]}</Badge>
              <p className="text-sm font-semibold">{snapshot.canHireAdvice.reason}</p>
            </div>
            {snapshot.canHireAdvice.details && <p className="mt-2 text-sm text-[var(--muted)]">{snapshot.canHireAdvice.details}</p>}
          </Card>

          <Card tone="glass" title="Servicios en presión">
            {snapshot.economy.pricingPressureServices.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No hay servicios en riesgo de margen ahora mismo.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="modern text-sm" aria-label="Servicios en presion">
                  <thead>
                    <tr>
                      <th>Servicio</th>
                      <th>Margen actual</th>
                      <th>Margen objetivo</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.economy.pricingPressureServices.map((service) => (
                      <tr key={service.serviceId}>
                        <td>{service.serviceName}</td>
                        <td>{service.marginCurrent?.toFixed(0) ?? "—"}%</td>
                        <td>{service.marginTarget?.toFixed(0) ?? "—"}%</td>
                        <td>
                          <Badge variant={service.status === "LOSS" ? "err" : service.status === "LOW_MARGIN" ? "warn" : "ok"}>
                            {service.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card tone="glass" title="Fairness resumen">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Empleados totales</span>
                  <span>{snapshot.hr.employeesTotal}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Sobreexplotados</span>
                  <span>{snapshot.hr.overworkedCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Sueldos bajos</span>
                  <span>{snapshot.hr.underpaidCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Baja actividad</span>
                  <span>{snapshot.hr.lowActivityCount}</span>
                </div>
                {snapshot.guardrailsEnforcementSummary && (
                  <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--panel-alt)] p-2 text-[10px] text-[var(--muted)]">
                    Enforcement: Overwork {snapshot.guardrailsEnforcementSummary.blockOverwork ? "bloquear" : "avisar"} ·
                    Underpay {snapshot.guardrailsEnforcementSummary.blockUnderpay ? "bloquear" : "avisar"} · Descanso{" "}
                    {snapshot.guardrailsEnforcementSummary.minRestHoursBetweenShifts}h
                  </div>
                )}
                {snapshot.employeesProfitabilitySummary && (
                  <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--panel-alt)] p-3 text-xs text-[var(--muted)]">
                    Empleados ROI: {snapshot.employeesProfitabilitySummary.healthyCount} saludables ·{" "}
                    {snapshot.employeesProfitabilitySummary.tightCount} ajustados ·{" "}
                    {snapshot.employeesProfitabilitySummary.unprofitableCount} no rentables ·{" "}
                    {snapshot.employeesProfitabilitySummary.lowActivityCount} baja actividad.
                  </div>
                )}
                {snapshot.hr.criticalIssues.length > 0 && (
                  <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--panel-alt)] p-3 text-xs text-[var(--muted)]">
                    {snapshot.hr.criticalIssues.map((issue, idx) => (
                      <p key={`${issue}-${idx}`}>{issue}</p>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            <Card tone="glass" title="Ahorros de proveedores">
              {snapshot.emailIntake.topSavingsOpportunities.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No hay oportunidades de ahorro ahora mismo.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="modern text-sm" aria-label="Ahorros proveedores">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Proveedor</th>
                        <th>Precio actual</th>
                        <th>Precio oferta</th>
                        <th>Ahorro/mes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.emailIntake.topSavingsOpportunities.map((item, idx) => (
                        <tr key={`${item.itemName}-${idx}`}>
                          <td>{item.itemName}</td>
                          <td>{item.supplierName ?? "Proveedor"}</td>
                          <td>{formatCurrency(item.currentUnitCost)}</td>
                          <td>{formatCurrency(item.offeredUnitCost)}</td>
                          <td>{formatCurrency(item.estimatedMonthlySaving)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          {snapshot.recommendations.length > 0 && (
            <Card tone="glass" title="Recomendaciones">
              <ul className="space-y-2 text-sm text-[var(--muted)]">
                {snapshot.recommendations.map((rec, idx) => (
                  <li key={`${rec}-${idx}`}>{rec}</li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </section>
  );
}
