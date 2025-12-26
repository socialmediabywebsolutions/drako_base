import { buildOwnerAccountingSnapshot, getOwnerMarketingSnapshot } from "@/lib/owner/accounting";
import { getDrakoVendorAccountingSnapshot } from "@/lib/owner/vendor-accounting";
import { estimateVendorCostsPerSaas } from "@/lib/owner/vendor-accounting";
import { buildSaasPricingRecommendations } from "@/lib/owner/pricing-engine";
import { getDrakoTreasurySnapshot } from "@/lib/owner/treasury";
import { listVendorExpenses, resolveVendorExpensesContext } from "@/lib/owner/vendor-expenses";
import { getSaasPackById } from "@/lib/packs/repository";
import { getSaasDepartmentCoverage } from "@/lib/owner/department-coverage";
import type {
  OwnerGrowthAutopilotAction,
  OwnerGrowthAutopilotSeverity,
  OwnerGrowthAutopilotTarget,
  SaasHealthSignal,
} from "@/lib/owner/types";
import type { DrakoVendorExpense } from "@/lib/owner/vendor-types";

type OwnerGrowthContext = {
  tenantId: string;
  ownerId: string;
};

type OwnerSaasRow = {
  saasId: string;
  saasName: string;
  subscriptionMonthlyAmount?: number;
  profitabilityMarginPercent?: number;
  packId?: string;
  recommendedPackId?: string;
  vertical?: "CLINIC" | "SALON" | "PET_GROOMING" | "LAUNDRY" | "OTHER";
};

const MARGIN_CRITICAL = 15;
const MARGIN_WARNING = 25;
const MARGIN_OPPORTUNITY = 40;
const LOW_SUBSCRIPTION_THRESHOLD = 120;
const VAT_PORTFOLIO_WARNING = 3000;
const VENDOR_MARGIN_CRITICAL = 0.3;
const VENDOR_MARGIN_WARNING = 0.5;
const VENDOR_MARGIN_HEALTHY = 0.7;
const VENDOR_AI_SHARE_WARNING = 0.35;
const VENDOR_MARKETING_SHARE_LOW = 0.5;
const VENDOR_MARKETING_SHARE_HIGH = 1.5;
const TARGET_COST_PER_SAAS = { min: 80, max: 120 };
const TARGET_COST_BY_TYPE: Record<string, { min: number; max: number }> = {
  INFRA: { min: 15, max: 25 },
  AI: { min: 25, max: 40 },
  SUPPORT: { min: 30, max: 50 },
  TEAM: { min: 30, max: 50 },
  OTHER: { min: 10, max: 20 },
};

const severityRank: Record<OwnerGrowthAutopilotSeverity, number> = {
  CRITICAL: 0,
  WARNING: 1,
  INFO: 2,
};

function buildAction(params: {
  id: string;
  severity: OwnerGrowthAutopilotSeverity;
  category: OwnerGrowthAutopilotAction["category"];
  title: string;
  description: string;
  target: OwnerGrowthAutopilotTarget;
  rationale?: string;
  metadata?: OwnerGrowthAutopilotAction["metadata"];
}): OwnerGrowthAutopilotAction {
  return {
    id: params.id,
    severity: params.severity,
    category: params.category,
    title: params.title,
    description: params.description,
    target: params.target,
    rationale: params.rationale,
    metadata: params.metadata,
  };
}

function toOwnerVerticalId(value: string | null | undefined): OwnerGrowthAutopilotTarget["vertical"] {
  if (value === "SALON" || value === "CLINIC" || value === "PET_GROOMING" || value === "LAUNDRY" || value === "OTHER") {
    return value;
  }
  return "OTHER";
}

function formatVerticalLabel(value: string | null | undefined): string {
  if (!value) return "UNASSIGNED";
  return value;
}

function toMonthlyVendorAmount(expense: DrakoVendorExpense): number {
  if (expense.period === "YEARLY") return expense.amount / 12;
  return expense.amount;
}

function isExpenseActiveInMonth(expense: DrakoVendorExpense, monthStart: Date, monthEnd: Date): boolean {
  const from = new Date(expense.fromDate);
  if (Number.isNaN(from.getTime())) return false;
  if (from > monthEnd) return false;
  if (expense.toDate) {
    const to = new Date(expense.toDate);
    if (!Number.isNaN(to.getTime()) && to < monthStart) return false;
  }
  if (expense.period === "ONE_OFF") {
    return from >= monthStart && from <= monthEnd;
  }
  return true;
}

function buildMonthRange(date: Date): { monthStart: Date; monthEnd: Date } {
  const monthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { monthStart, monthEnd };
}

function formatCurrency(value: number): string {
  return `${value.toFixed(0)} €`;
}

function formatHealthSignals(signals: SaasHealthSignal[]): string {
  const relevant = signals.filter((signal) => signal.level !== "INFO");
  const selected = (relevant.length ? relevant : signals).slice(0, 2);
  return selected.map((signal) => signal.kind).join(", ");
}

function sortActions(actions: OwnerGrowthAutopilotAction[], rowsById: Map<string, OwnerSaasRow>) {
  return actions.sort((a, b) => {
    const severityOrder = severityRank[a.severity] - severityRank[b.severity];
    if (severityOrder !== 0) return severityOrder;
    if (a.target.type === "SAAS" && b.target.type === "SAAS") {
      const aRow = rowsById.get(a.target.saasId ?? "");
      const bRow = rowsById.get(b.target.saasId ?? "");
      const amountDelta = (bRow?.subscriptionMonthlyAmount ?? 0) - (aRow?.subscriptionMonthlyAmount ?? 0);
      if (amountDelta !== 0) return amountDelta;
      return (aRow?.saasName ?? "").localeCompare(bRow?.saasName ?? "");
    }
    return a.id.localeCompare(b.id);
  });
}

export async function buildOwnerGrowthAutopilotSnapshot(
  ctx: OwnerGrowthContext,
): Promise<OwnerGrowthAutopilotAction[]> {
  const accounting = await buildOwnerAccountingSnapshot({ tenantId: ctx.tenantId, ownerId: ctx.ownerId });
  const vendorSnapshot = await getDrakoVendorAccountingSnapshot({ tenantId: ctx.tenantId, ownerId: ctx.ownerId });
  const actions: OwnerGrowthAutopilotAction[] = [];
  const rowsById = new Map<string, OwnerSaasRow>();
  let marketingSnapshot: Awaited<ReturnType<typeof getOwnerMarketingSnapshot>> | null = null;
  let treasurySnapshot: Awaited<ReturnType<typeof getDrakoTreasurySnapshot>> | null = null;

  accounting.rows.forEach((row) => {
    rowsById.set(row.saasId, row);
  });

  for (const row of accounting.rows) {
    const margin = row.profitabilityMarginPercent;
    const subscriptionAmount = row.subscriptionMonthlyAmount;
    if (typeof margin === "number") {
      if (margin < MARGIN_CRITICAL) {
        actions.push(
          buildAction({
            id: `SAAS_HEALTH:${row.saasId}`,
            severity: "CRITICAL",
            category: "SAAS_HEALTH",
            title: "Este SaaS está al límite de margen",
            description: `Margen estimado ${margin.toFixed(0)}%. Revisa precios, costes o módulos activos para recuperar rentabilidad.`,
            target: { type: "SAAS", saasId: row.saasId },
            rationale: `Margen por debajo de ${MARGIN_CRITICAL}%`,
          }),
        );
      } else if (margin < MARGIN_WARNING) {
        actions.push(
          buildAction({
            id: `PRICING:${row.saasId}`,
            severity: "WARNING",
            category: "PRICING",
            title: "Margen ajustado, revisa pricing",
            description: `Margen estimado ${margin.toFixed(0)}%. Ajusta precios o paquetes para evitar erosión de beneficio.`,
            target: { type: "SAAS", saasId: row.saasId },
            rationale: `Margen entre ${MARGIN_CRITICAL}% y ${MARGIN_WARNING}%`,
          }),
        );
      } else if (margin >= MARGIN_OPPORTUNITY && typeof subscriptionAmount === "number" && subscriptionAmount < LOW_SUBSCRIPTION_THRESHOLD) {
        actions.push(
          buildAction({
            id: `OPPORTUNITY:${row.saasId}`,
            severity: "INFO",
            category: "OPPORTUNITY",
            title: "Buen margen con suscripción baja",
            description: `Margen ${margin.toFixed(0)}% y suscripción ${subscriptionAmount.toFixed(0)} €. Considera subir plan o añadir módulos.`,
            target: { type: "SAAS", saasId: row.saasId },
            rationale: "Margen alto con precio mensual bajo",
          }),
        );
      }
    }

    if (row.recommendedPackId && row.recommendedPackId !== row.packId) {
      const pack = getSaasPackById(row.recommendedPackId);
      actions.push(
        buildAction({
          id: `PACK_RECOMMENDATION:${row.saasId}:${row.recommendedPackId}`,
          severity: "INFO",
          category: "CATALOG",
          title: "Pack recomendado distinto al actual",
          description: `Para ${row.saasName}, se recomienda ${pack?.label ?? row.recommendedPackId}. Valora migrar para activar módulos adecuados.`,
          target: { type: "PACK", packId: row.recommendedPackId },
          rationale: "Pack sugerido por blueprint/vertical",
        }),
      );
    }
  }

  const bestVertical = accounting.verticalBreakdown
    .slice()
    .filter((item) => typeof item.avgMarginPercent === "number" && item.saasCount > 0)
    .sort((a, b) => (b.avgMarginPercent ?? 0) - (a.avgMarginPercent ?? 0))[0];

  if (bestVertical && bestVertical.saasCount < 3) {
    actions.push(
      buildAction({
        id: `VERTICAL_OPPORTUNITY:${bestVertical.vertical}`,
        severity: "INFO",
        category: "OPPORTUNITY",
        title: "Vertical con margen alto y poca presencia",
        description: `La vertical ${bestVertical.vertical} tiene el mejor margen (${bestVertical.avgMarginPercent?.toFixed(0)}%). Puedes lanzar otro SaaS en ese nicho.`,
        target: { type: "VERTICAL", vertical: bestVertical.vertical ?? "OTHER" },
        rationale: "Mejor margen con baja cobertura",
      }),
    );
  }

  const worstVertical = accounting.verticalBreakdown
    .slice()
    .filter((item) => typeof item.avgMarginPercent === "number" && item.saasCount > 0)
    .sort((a, b) => (a.avgMarginPercent ?? 0) - (b.avgMarginPercent ?? 0))[0];

  if (worstVertical && (worstVertical.avgMarginPercent ?? 100) < MARGIN_CRITICAL) {
    actions.push(
      buildAction({
        id: `VERTICAL_RISK:${worstVertical.vertical}`,
        severity: "WARNING",
        category: "RISK",
        title: "Vertical con margen bajo",
        description: `La vertical ${worstVertical.vertical} está por debajo del ${MARGIN_CRITICAL}%. Revisa pricing o reduce costes antes de escalar.`,
        target: { type: "VERTICAL", vertical: worstVertical.vertical ?? "OTHER" },
        rationale: "Margen vertical bajo",
      }),
    );
  }

  if (accounting.taxSummary) {
    for (const item of accounting.taxSummary.items) {
      if (item.status !== "RISK") continue;
      const row = rowsById.get(item.saasId);
      const margin = row?.profitabilityMarginPercent;
      const severity: OwnerGrowthAutopilotSeverity = typeof margin === "number" && margin < MARGIN_CRITICAL ? "CRITICAL" : "WARNING";
      actions.push(
        buildAction({
          id: `TAX_RISK:${item.saasId}`,
          severity,
          category: "RISK",
          title: "IVA estimado alto en este SaaS",
          description: `IVA estimado ${item.vatDue.toFixed(0)} €. Revisa precios y gastos antes del cierre trimestral.`,
          target: { type: "SAAS", saasId: item.saasId },
          rationale: "Estado fiscal en RISK",
        }),
      );
    }

    if (accounting.taxSummary.totalVatDueAllSaas > VAT_PORTFOLIO_WARNING) {
      actions.push(
        buildAction({
          id: "TAX_PORTFOLIO_PRESSURE",
          severity: "INFO",
          category: "RISK",
          title: "IVA agregado elevado en el portfolio",
          description: "Varios SaaS concentran IVA estimado alto. Planifica el cierre con antelación.",
          target: { type: "PORTFOLIO" },
          rationale: "Suma de IVA estimado por encima del umbral",
        }),
      );
    }
  }

  if (accounting.totalBaselineMonthly > 0) {
    if (!accounting.baselineCovered && accounting.baselineCoveragePercent < 0.6) {
      actions.push(
        buildAction({
          id: "OWNER_BASELINE_CRITICAL",
          severity: "CRITICAL",
          category: "ECONOMY",
          title: "Aun no has cubierto tus gastos basicos este mes",
          description: `Te faltan ${formatCurrency(accounting.baselineGapAmount)} para cubrir vida + vendor. Revisa precios y prioriza verticales con mejor margen.`,
          target: { type: "OWNER" },
          rationale: "Cobertura de baseline por debajo del 60%",
        }),
      );
    } else if (!accounting.baselineCovered && accounting.baselineCoveragePercent < 1) {
      actions.push(
        buildAction({
          id: "OWNER_BASELINE_WARNING",
          severity: "WARNING",
          category: "ECONOMY",
          title: "Estas cerca de cubrir lo basico este mes",
          description: `Te faltan ${formatCurrency(accounting.baselineGapAmount)} para cubrir el minimo. Refuerza ventas en SaaS mas rentables.`,
          target: { type: "OWNER" },
          rationale: "Cobertura de baseline entre 60% y 100%",
        }),
      );
    } else if (accounting.baselineCovered) {
      actions.push(
        buildAction({
          id: "OWNER_BASELINE_OK",
          severity: "INFO",
          category: "ECONOMY",
          title: "Gastos basicos cubiertos este mes",
          description: "Lo basico ya esta cubierto. A partir de aqui todo es margen y crecimiento.",
          target: { type: "OWNER" },
          rationale: "Cobertura de baseline completa",
        }),
      );
    }
  }

  try {
    const costs = await estimateVendorCostsPerSaas({
      tenantId: ctx.tenantId,
      ownerId: ctx.ownerId,
      rows: accounting.rows,
    });
    try {
      marketingSnapshot = await getOwnerMarketingSnapshot({ tenantId: ctx.tenantId, ownerId: ctx.ownerId });
    } catch (error) {
      console.warn("OWNER_AUTOPILOT_MARKETING_SNAPSHOT_ERROR", error);
    }
    const marketingBySaas = marketingSnapshot
      ? new Map(marketingSnapshot.items.map((item) => [item.saasId, item]))
      : undefined;
    const recommendations = buildSaasPricingRecommendations({
      rows: accounting.rows,
      costs,
      workBaselineMonthly: accounting.baselineWorkMonthly,
      marketingBySaas,
    });
    for (const recommendation of recommendations) {
      if (recommendation.status === "UNDERWATER") {
        const packShareLabel =
          recommendation.marketingPackShareOfPrice !== null
            ? `${Math.round(recommendation.marketingPackShareOfPrice * 100)}%`
            : "—";
        const packMessage =
          recommendation.marketingPackStatus === "HEAVY"
            ? ` El pack de marketing consume ~${packShareLabel} del precio; sube precio o baja de pack.`
            : recommendation.marketingPackTier
              ? ` Pack marketing ${recommendation.marketingPackTier} (~${packShareLabel} del precio).`
              : "";
        actions.push(
          buildAction({
            id: `PRICING_UNDERWATER:${recommendation.saasId}`,
            severity: "CRITICAL",
            category: "PRICING",
            title: `Subir precio de ${recommendation.saasName}`,
            description: `Este SaaS esta por debajo de coste (${recommendation.estimatedVendorCostMonthly.toFixed(0)} €). Revisa precio mensual.${packMessage}`,
            target: { type: "SAAS", saasId: recommendation.saasId },
            rationale: "Precio por debajo del coste vendor estimado",
            metadata: {
              saasId: recommendation.saasId,
              saasName: recommendation.saasName,
              currentMonthlyPrice: recommendation.currentMonthlyPrice,
              estimatedVendorCostMonthly: recommendation.estimatedVendorCostMonthly,
              marketingPackTier: recommendation.marketingPackTier,
              marketingPackMonthlyPrice: recommendation.marketingPackMonthlyPrice,
              marketingPackShareOfPrice: recommendation.marketingPackShareOfPrice,
              marketingPackStatus: recommendation.marketingPackStatus,
            },
          }),
        );
      } else if (recommendation.status === "AT_RISK") {
        const packShareLabel =
          recommendation.marketingPackShareOfPrice !== null
            ? `${Math.round(recommendation.marketingPackShareOfPrice * 100)}%`
            : "—";
        const packMessage =
          recommendation.marketingPackStatus === "HEAVY"
            ? ` Pack marketing pesado (~${packShareLabel} del precio); ajusta pack o sube precio.`
            : recommendation.marketingPackTier
              ? ` Pack marketing ${recommendation.marketingPackTier} (~${packShareLabel} del precio).`
              : "";
        actions.push(
          buildAction({
            id: `PRICING_AT_RISK:${recommendation.saasId}`,
            severity: "WARNING",
            category: "PRICING",
            title: `Margen ajustado en ${recommendation.saasName}`,
            description: `Precio actual ${recommendation.currentMonthlyPrice.toFixed(0)} € cerca del minimo recomendado ${recommendation.recommendedMinPriceMonthly.toFixed(
              0,
            )} €. Ajusta plan o upsell.${packMessage}`,
            target: { type: "SAAS", saasId: recommendation.saasId },
            rationale: "Precio entre coste y minimo recomendado",
            metadata: {
              saasId: recommendation.saasId,
              saasName: recommendation.saasName,
              currentMonthlyPrice: recommendation.currentMonthlyPrice,
              estimatedVendorCostMonthly: recommendation.estimatedVendorCostMonthly,
              marketingPackTier: recommendation.marketingPackTier,
              marketingPackMonthlyPrice: recommendation.marketingPackMonthlyPrice,
              marketingPackShareOfPrice: recommendation.marketingPackShareOfPrice,
              marketingPackStatus: recommendation.marketingPackStatus,
            },
          }),
        );
      }
    }
  } catch (error) {
    console.warn("OWNER_AUTOPILOT_PRICING_ERROR", error);
  }

  try {
    if (!marketingSnapshot) {
      marketingSnapshot = await getOwnerMarketingSnapshot({ tenantId: ctx.tenantId, ownerId: ctx.ownerId });
    }
    marketingSnapshot.items.forEach((item) => {
      const tierOrder = ["BASIC", "STANDARD", "FULL"] as const;
      const currentIndex = item.currentPackTier ? tierOrder.indexOf(item.currentPackTier) : -1;
      const recommendedIndex = item.recommendedPackTier ? tierOrder.indexOf(item.recommendedPackTier) : -1;
      if (item.status === "NEAR_LIMIT" || item.status === "OVER_LIMIT") {
        const packNote =
          item.currentPackDefinition && item.recommendedPackDefinition && item.currentPackTier !== item.recommendedPackTier
            ? ` Pack actual ${item.currentPackTier}; recomendado ${item.recommendedPackTier} (${item.recommendedPackDefinition.includedPostsPerMonth} posts, ${item.recommendedPackDefinition.includedCampaignsPerMonth} campañas, ${item.recommendedPackDefinition.recommendedMonthlyPrice} €/mes).`
            : "";
        actions.push(
          buildAction({
            id: `MARKETING_UPSELL:${item.saasId}`,
            severity: "INFO",
            category: "MARKETING",
            title: "Ofrecer pack extra de publicaciones",
            description: `Este SaaS usa ${Math.round(item.usagePostsPercent * 100)}% de su cuota mensual.${packNote}`,
            target: { type: "SAAS", saasId: item.saasId },
            rationale: "Cuota de marketing cerca del limite",
          }),
        );
      } else if (currentIndex > 0 && recommendedIndex >= 0 && recommendedIndex < currentIndex) {
        const packNote =
          item.currentPackDefinition && item.recommendedPackDefinition
            ? ` Pack actual ${item.currentPackTier}; recomendado ${item.recommendedPackTier} (${item.recommendedPackDefinition.includedPostsPerMonth} posts, ${item.recommendedPackDefinition.includedCampaignsPerMonth} campañas, ${item.recommendedPackDefinition.recommendedMonthlyPrice} €/mes).`
            : "";
        actions.push(
          buildAction({
            id: `MARKETING_OPTIMIZE:${item.saasId}`,
            severity: "INFO",
            category: "MARKETING",
            title: "Optimizar pack de marketing",
            description: `Este SaaS usa solo ${Math.round(item.usagePostsPercent * 100)}% de su cuota mensual.${packNote}`,
            target: { type: "SAAS", saasId: item.saasId },
            rationale: "Cuota de marketing infrautilizada",
          }),
        );
      }
    });
  } catch (error) {
    console.warn("OWNER_AUTOPILOT_MARKETING_ERROR", error);
  }

  try {
    treasurySnapshot = await getDrakoTreasurySnapshot({ tenantId: ctx.tenantId, ownerId: ctx.ownerId });
    if (treasurySnapshot.recommendedTaxReserveThisQuarter > 0 && treasurySnapshot.taxReserveGap > 0) {
      const gapRatio = treasurySnapshot.taxReserveGap / treasurySnapshot.recommendedTaxReserveThisQuarter;
      actions.push(
        buildAction({
          id: "TREASURY_TAX_GAP",
          severity: gapRatio >= 0.5 ? "CRITICAL" : "WARNING",
          category: "ECONOMY",
          title: "Reserva de impuestos por debajo de lo recomendado",
          description: `Faltan ${formatCurrency(treasurySnapshot.taxReserveGap)} para cubrir la reserva fiscal del trimestre.`,
          target: { type: "OWNER" },
          rationale: "Gap en reserva de impuestos",
        }),
      );
    }
    if (treasurySnapshot.infraReserveGap > 0) {
      actions.push(
        buildAction({
          id: "TREASURY_INFRA_GAP",
          severity: "INFO",
          category: "ECONOMY",
          title: "Refuerza reserva de infra",
          description: `Reserva infra por debajo del objetivo mensual en ${formatCurrency(treasurySnapshot.infraReserveGap)}.`,
          target: { type: "OWNER" },
          rationale: "Gap en reserva infra",
        }),
      );
    }
    if (treasurySnapshot.aiReserveGap > 0) {
      actions.push(
        buildAction({
          id: "TREASURY_AI_GAP",
          severity: "INFO",
          category: "ECONOMY",
          title: "Refuerza reserva de IA",
          description: `Reserva IA por debajo del objetivo mensual en ${formatCurrency(treasurySnapshot.aiReserveGap)}.`,
          target: { type: "OWNER" },
          rationale: "Gap en reserva IA",
        }),
      );
    }
  } catch (error) {
    console.warn("OWNER_AUTOPILOT_TREASURY_ERROR", error);
  }

  if (accounting.saasHealthSummary?.topCritical || accounting.saasHealthSummary?.topScaleCandidates) {
    const healthIsConstrained = !accounting.baselineCovered || (treasurySnapshot?.taxReserveGap ?? 0) > 0;
    const criticalItems = accounting.saasHealthSummary?.topCritical ?? [];
    const scaleItems = accounting.saasHealthSummary?.topScaleCandidates ?? [];
    criticalItems.forEach((item) => {
      const primarySignals = formatHealthSignals(item.signals);
      actions.push(
        buildAction({
          id: `SAAS_HEALTH_CRITICAL:${item.saasId}`,
          severity: "CRITICAL",
          category: "SAAS_HEALTH",
          title: `SaaS critico: ${item.saasName}`,
          description: `Health score ${item.healthScore}. Señales: ${primarySignals}. Prioriza ajustes de precio, packs o departamentos.`,
          target: { type: "SAAS", saasId: item.saasId },
          rationale: "Health CRITICAL segun pricing/coverage/marketing/margen",
          metadata: {
            saasId: item.saasId,
            healthScore: item.healthScore,
            signals: item.signals,
            lowPriority: false,
          },
        }),
      );
    });
    scaleItems.forEach((item) => {
      const primarySignals = formatHealthSignals(item.signals);
      actions.push(
        buildAction({
          id: `SAAS_HEALTH_SCALE:${item.saasId}`,
          severity: "INFO",
          category: "SAAS_HEALTH",
          title: `SaaS sano para escalar: ${item.saasName}`,
          description: `Health score ${item.healthScore}. Señales: ${primarySignals}. Buen momento para subir precio o ampliar packs.`,
          target: { type: "SAAS", saasId: item.saasId },
          rationale: "Health GOOD y score alto",
          metadata: {
            saasId: item.saasId,
            healthScore: item.healthScore,
            signals: item.signals,
            lowPriority: healthIsConstrained,
          },
        }),
      );
    });
  }

  try {
    const coverage = await getSaasDepartmentCoverage({ tenantId: ctx.tenantId, rows: accounting.rows });
    const coverageIsConstrained = !accounting.baselineCovered || (treasurySnapshot?.taxReserveGap ?? 0) > 0;
    for (const item of coverage) {
      if (item.status === "WELL_COVERED") continue;
      const hardGaps = item.gaps.filter((gap) => gap.severity === "HARD");
      const softGaps = item.gaps.filter((gap) => gap.severity === "SOFT");
      if (item.status === "CRITICAL_GAP") {
        const missing = hardGaps.map((gap) => gap.departmentId).join(", ");
        actions.push(
          buildAction({
            id: `DEPARTMENT_GAP_CRITICAL:${item.saasId}`,
            severity: "WARNING",
            category: "DEPARTMENT_COVERAGE",
            title: `Gap critico de departamentos en ${item.saasName}`,
            description: `Este SaaS no tiene ${missing}. Sugiere activar packs BASIC para cubrir el minimo.`,
            target: { type: "SAAS", saasId: item.saasId },
            rationale: "Departamentos criticos sin cobertura",
            metadata: {
              saasId: item.saasId,
              gaps: hardGaps,
              lowPriority: coverageIsConstrained,
            },
          }),
        );
      } else if (item.status === "PARTIAL") {
        const soft = softGaps.map((gap) => gap.departmentId).join(", ");
        actions.push(
          buildAction({
            id: `DEPARTMENT_GAP_SOFT:${item.saasId}`,
            severity: coverageIsConstrained ? "INFO" : "WARNING",
            category: "DEPARTMENT_COVERAGE",
            title: `Cobertura parcial en ${item.saasName}`,
            description: `Departamentos con cobertura suave: ${soft}. Valora subir pack si el objetivo es crecer.`,
            target: { type: "SAAS", saasId: item.saasId },
            rationale: "Cobertura parcial por pack bajo",
            metadata: {
              saasId: item.saasId,
              gaps: softGaps,
              lowPriority: coverageIsConstrained,
            },
          }),
        );
      }
    }
  } catch (error) {
    console.warn("OWNER_AUTOPILOT_DEPARTMENT_COVERAGE_ERROR", error);
  }

  const marginByVertical = new Map<string | null, typeof vendorSnapshot.estimatedMarginByVertical[number]>();
  vendorSnapshot.estimatedMarginByVertical.forEach((row) => {
    marginByVertical.set(row.verticalId ?? "OTHER", row);
  });

  for (const row of vendorSnapshot.estimatedMarginByVertical) {
    if (row.revenue <= 0) continue;
    const verticalLabel = formatVerticalLabel(row.verticalId);
    if (row.marginRate < VENDOR_MARGIN_CRITICAL) {
      actions.push(
        buildAction({
          id: `DR_VDR_MARGIN_CRITICAL:${verticalLabel}`,
          severity: "CRITICAL",
          category: "ECONOMY",
          title: `Margen vendor critico en ${verticalLabel}`,
          description: `Ingresos ${formatCurrency(row.revenue)}, gastos vendor ${formatCurrency(row.vendorCosts)}, margen ${formatCurrency(row.margin)}. Revisa precio del plan para este vertical.`,
          target: { type: "VERTICAL", vertical: toOwnerVerticalId(row.verticalId) },
          rationale: "Margen < 30% tras gastos vendor",
        }),
      );
    } else if (row.marginRate < VENDOR_MARGIN_WARNING) {
      actions.push(
        buildAction({
          id: `DR_VDR_MARGIN_WARNING:${verticalLabel}`,
          severity: "WARNING",
          category: "ECONOMY",
          title: `Margen vendor bajo en ${verticalLabel}`,
          description: `Margen ${formatCurrency(row.margin)} (${(row.marginRate * 100).toFixed(0)}%). Considera subir precio o ajustar modulos.`,
          target: { type: "VERTICAL", vertical: toOwnerVerticalId(row.verticalId) },
          rationale: "Margen 30-50% tras gastos vendor",
        }),
      );
    } else if (row.marginRate > VENDOR_MARGIN_HEALTHY) {
      actions.push(
        buildAction({
          id: `DR_VDR_MARGIN_HEALTHY:${verticalLabel}`,
          severity: "INFO",
          category: "ECONOMY",
          title: `Margen vendor muy sano en ${verticalLabel}`,
          description: `Margen ${(row.marginRate * 100).toFixed(0)}%. Buen momento para upsell de modulos.`,
          target: { type: "VERTICAL", vertical: toOwnerVerticalId(row.verticalId) },
          rationale: "Margen > 70% tras gastos vendor",
        }),
      );
    }
  }

  if (vendorSnapshot.totalVendorExpensesThisMonth > 0) {
    const aiRow = vendorSnapshot.vendorExpensesByType.find((item) => item.type === "AI");
    const aiShare = aiRow ? aiRow.amount / vendorSnapshot.totalVendorExpensesThisMonth : 0;
    if (aiShare >= VENDOR_AI_SHARE_WARNING) {
      actions.push(
        buildAction({
          id: "DR_VDR_AI_SPEND_HIGH",
          severity: "WARNING",
          category: "ECONOMY",
          title: "Coste de IA elevado en Drako Vendor",
          description: `La IA representa ${(aiShare * 100).toFixed(0)}% del gasto vendor. Considera optimizar modelos, prompts o reparto de costes.`,
          target: { type: "PORTFOLIO" },
          rationale: "Peso de IA sobre gastos vendor",
        }),
      );
    }
  }

  const marketingContext = await resolveVendorExpensesContext({ tenantId: ctx.tenantId });
  const allExpenses = await listVendorExpenses(marketingContext);
  const { monthStart, monthEnd } = buildMonthRange(new Date());
  const marketingByVertical = new Map<string | null, number>();
  const costByTypeByVertical = new Map<string, Map<string | null, number>>();
  let totalMarketing = 0;
  for (const expense of allExpenses) {
    if (!isExpenseActiveInMonth(expense, monthStart, monthEnd)) continue;
    const amount = toMonthlyVendorAmount(expense);
    const key = expense.verticalId ?? null;
    if (expense.type === "MARKETING") {
      marketingByVertical.set(key, (marketingByVertical.get(key) ?? 0) + amount);
      totalMarketing += amount;
    }
    if (expense.type === "AI" || expense.type === "INFRA") {
      if (!costByTypeByVertical.has(expense.type)) {
        costByTypeByVertical.set(expense.type, new Map());
      }
      const typeMap = costByTypeByVertical.get(expense.type)!;
      typeMap.set(key, (typeMap.get(key) ?? 0) + amount);
    }
  }

  const totalRevenue = accounting.verticalBreakdown.reduce((acc, item) => acc + item.mrr, 0);
  const saasCountByVertical = new Map<string | null, number>();
  accounting.verticalBreakdown.forEach((item) => {
    saasCountByVertical.set(item.vertical ?? "OTHER", item.saasCount);
  });

  if (accounting.totalSaas > 0) {
    const vendorPerSaas = vendorSnapshot.totalVendorExpensesThisMonth / accounting.totalSaas;
    if (vendorPerSaas > TARGET_COST_PER_SAAS.max) {
      actions.push(
        buildAction({
          id: "DR_VDR_COST_HIGH",
          severity: "WARNING",
          category: "ECONOMY",
          title: "Coste vendor por SaaS por encima del objetivo",
          description: `Coste medio ${formatCurrency(vendorPerSaas)} por SaaS (objetivo 80-120 €). Revisa IA, infra o soporte.`,
          target: { type: "PORTFOLIO" },
          rationale: "Coste vendor por SaaS alto",
        }),
      );
    }
  }

  for (const [type, target] of Object.entries(TARGET_COST_BY_TYPE)) {
    if (type !== "AI" && type !== "INFRA") continue;
    const typeMap = costByTypeByVertical.get(type);
    if (!typeMap) continue;
    for (const [verticalId, amount] of typeMap) {
      const saasCount = saasCountByVertical.get(verticalId ?? "OTHER") ?? 0;
      if (saasCount === 0) continue;
      const perSaas = amount / saasCount;
      if (perSaas > target.max) {
        const label = formatVerticalLabel(verticalId);
        const margin = marginByVertical.get(verticalId ?? "OTHER")?.marginRate ?? 0;
        const severity: OwnerGrowthAutopilotSeverity =
          margin < VENDOR_MARGIN_CRITICAL ? "CRITICAL" : margin < VENDOR_MARGIN_WARNING ? "WARNING" : "INFO";
        actions.push(
          buildAction({
            id: `DR_VDR_${type}_HIGH:${label}`,
            severity,
            category: "ECONOMY",
            title: `Reducir coste ${type} en ${label}`,
            description: `Coste ${type} ${formatCurrency(perSaas)} por SaaS (objetivo ${target.min}-${target.max} €). Ajusta consumo o proveedores.`,
            target: { type: "VERTICAL", vertical: toOwnerVerticalId(verticalId) },
            rationale: `${type} por SaaS por encima del objetivo`,
          }),
        );
      }
    }
  }

  if (totalMarketing > 0 && totalRevenue > 0) {
    for (const vertical of accounting.verticalBreakdown) {
      const revenueShare = vertical.mrr / totalRevenue;
      if (revenueShare <= 0) continue;
      const marketingSpend = marketingByVertical.get(vertical.vertical ?? "OTHER") ?? 0;
      const marketingShare = marketingSpend / totalMarketing;
      const verticalId = vertical.vertical ?? "OTHER";
      const label = formatVerticalLabel(verticalId);
      const margin = marginByVertical.get(verticalId)?.marginRate ?? 0;

      if (margin > VENDOR_MARGIN_HEALTHY && revenueShare >= 0.3 && marketingShare < revenueShare * VENDOR_MARKETING_SHARE_LOW) {
        actions.push(
          buildAction({
            id: `DR_VDR_MARKETING_LOW:${label}`,
            severity: "INFO",
            category: "ECONOMY",
            title: `Marketing bajo en vertical ${label}`,
            description: `La vertical aporta ${(revenueShare * 100).toFixed(0)}% del ingreso y el marketing vendor es ${(marketingShare * 100).toFixed(0)}%. Valora activar Social Pack o Ads Management.`,
            target: { type: "VERTICAL", vertical: toOwnerVerticalId(verticalId) },
            rationale: "Upsell con margen alto y marketing bajo",
          }),
        );
      }

      if (marketingShare > revenueShare * VENDOR_MARKETING_SHARE_HIGH && revenueShare < 0.2) {
        actions.push(
          buildAction({
            id: `DR_VDR_MARKETING_HIGH:${label}`,
            severity: "WARNING",
            category: "ECONOMY",
            title: `Marketing alto con bajo ingreso en ${label}`,
            description: `Marketing ${(marketingShare * 100).toFixed(0)}% con solo ${(revenueShare * 100).toFixed(0)}% del ingreso. Ajusta fee o revisa campañas.`,
            target: { type: "VERTICAL", vertical: toOwnerVerticalId(verticalId) },
            rationale: "Marketing sobredimensionado vs revenue",
          }),
        );
      }
    }
  }

  return sortActions(actions, rowsById);
}
