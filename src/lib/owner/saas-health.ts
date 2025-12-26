import type { OwnerSaasAccountingRow, OwnerMarketingSnapshot } from "@/lib/owner/accounting";
import type { SaasPricingRecommendation } from "@/lib/owner/pricing-engine";
import type { SaasDepartmentCoverage } from "@/lib/owner/department-coverage";
import type { SaasHealthSignal, SaasHealthSnapshot, SaasHealthStatus } from "@/lib/owner/types";

type MarketingStatus = OwnerMarketingSnapshot["items"][number]["status"];

const HEALTH_SCORE_START = 100;
const HEALTH_CRITICAL_PENALTY = 40;
const HEALTH_WARNING_PENALTY = 20;

function pushSignal(signals: SaasHealthSignal[], signal: SaasHealthSignal) {
  signals.push(signal);
}

function resolveHealthStatus(score: number, signals: SaasHealthSignal[]): SaasHealthStatus {
  const hasCritical = signals.some((signal) => signal.level === "CRITICAL");
  const hasWarning = signals.some((signal) => signal.level === "WARN");
  if (hasCritical || score < 50) return "CRITICAL";
  if (hasWarning || score < 80) return "WARNING";
  return "GOOD";
}

export function buildSaasHealthSnapshots(params: {
  rows: OwnerSaasAccountingRow[];
  pricingRecommendations: SaasPricingRecommendation[];
  departmentCoverage: SaasDepartmentCoverage[];
  marketingSnapshot?: OwnerMarketingSnapshot | null;
}): SaasHealthSnapshot[] {
  const pricingBySaas = new Map(params.pricingRecommendations.map((item) => [item.saasId, item]));
  const coverageBySaas = new Map(params.departmentCoverage.map((item) => [item.saasId, item]));
  const marketingBySaas = new Map(
    (params.marketingSnapshot?.items ?? []).map((item) => [item.saasId, item]),
  );

  return params.rows.map((row) => {
    const pricing = pricingBySaas.get(row.saasId);
    const coverage = coverageBySaas.get(row.saasId);
    const marketing = marketingBySaas.get(row.saasId);

    const signals: SaasHealthSignal[] = [];
    let pricingStatus: SaasHealthSnapshot["pricingStatus"] = "AT_RISK";
    if (pricing) {
      pricingStatus = pricing.status;
      if (pricing.status === "UNDERWATER") {
        pushSignal(signals, {
          kind: "PRICING",
          level: "CRITICAL",
          message: "Pricing UNDERWATER: precio por debajo del coste estimado.",
        });
      } else if (pricing.status === "AT_RISK") {
        pushSignal(signals, {
          kind: "PRICING",
          level: "WARN",
          message: "Pricing AT_RISK: precio cerca del minimo recomendado.",
        });
      } else {
        pushSignal(signals, {
          kind: "PRICING",
          level: "INFO",
          message: "Pricing ABOVE_TARGET: margen objetivo cubierto.",
        });
      }
    } else {
      pushSignal(signals, {
        kind: "PRICING",
        level: "WARN",
        message: "Pricing desconocido: falta recomendacion de precio.",
      });
    }

    const departmentCoverageStatus = coverage?.status ?? "PARTIAL";
    if (coverage) {
      if (coverage.status === "CRITICAL_GAP") {
        pushSignal(signals, {
          kind: "DEPARTMENTS",
          level: "CRITICAL",
          message: "Departamentos criticos sin cobertura.",
        });
      } else if (coverage.status === "PARTIAL") {
        pushSignal(signals, {
          kind: "DEPARTMENTS",
          level: "WARN",
          message: "Cobertura parcial de departamentos.",
        });
      } else {
        pushSignal(signals, {
          kind: "DEPARTMENTS",
          level: "INFO",
          message: "Departamentos clave cubiertos.",
        });
      }
    } else {
      pushSignal(signals, {
        kind: "DEPARTMENTS",
        level: "WARN",
        message: "Cobertura de departamentos no disponible.",
      });
    }

    const marketingStatus: MarketingStatus = marketing?.status ?? "OK";
    if (marketingStatus === "OVER_LIMIT") {
      pushSignal(signals, {
        kind: "MARKETING",
        level: "WARN",
        message: "Marketing OVER_LIMIT: pack supera el limite de posts.",
      });
    } else if (marketingStatus === "NEAR_LIMIT") {
      pushSignal(signals, {
        kind: "MARKETING",
        level: "WARN",
        message: "Marketing NEAR_LIMIT: pack cerca del limite mensual.",
      });
    } else {
      pushSignal(signals, {
        kind: "MARKETING",
        level: "INFO",
        message: "Marketing OK: pack dentro del limite.",
      });
    }

    if (pricing) {
      const currentPrice = pricing.currentMonthlyPrice ?? 0;
      const estimatedCost = pricing.estimatedVendorCostMonthly ?? 0;
      if (currentPrice <= 0 && estimatedCost > 0) {
        pushSignal(signals, {
          kind: "MARGIN",
          level: "CRITICAL",
          message: "Margen critico: precio actual cero con coste estimado.",
        });
      } else if (currentPrice > 0 && currentPrice < estimatedCost) {
        pushSignal(signals, {
          kind: "MARGIN",
          level: "CRITICAL",
          message: "Margen negativo: coste vendor superior al precio.",
        });
      } else if (currentPrice > 0) {
        const marginRatio = (currentPrice - estimatedCost) / currentPrice;
        if (marginRatio < 0.2) {
          pushSignal(signals, {
            kind: "MARGIN",
            level: "WARN",
            message: "Margen ajustado: margen < 20% sobre coste.",
          });
        } else {
          pushSignal(signals, {
            kind: "MARGIN",
            level: "INFO",
            message: "Margen sano sobre coste estimado.",
          });
        }
      }
    }

    let healthScore = HEALTH_SCORE_START;
    signals.forEach((signal) => {
      if (signal.level === "CRITICAL") {
        healthScore -= HEALTH_CRITICAL_PENALTY;
      } else if (signal.level === "WARN") {
        healthScore -= HEALTH_WARNING_PENALTY;
      }
    });
    healthScore = Math.max(0, Math.min(HEALTH_SCORE_START, healthScore));
    const healthStatus = resolveHealthStatus(healthScore, signals);

    return {
      saasId: row.saasId,
      saasName: row.saasName,
      verticalId: (row.vertical ?? "OTHER") as SaasHealthSnapshot["verticalId"],
      healthScore,
      healthStatus,
      pricingStatus,
      departmentCoverageStatus,
      marketingStatus,
      estimatedVendorCostMonthly: pricing?.estimatedVendorCostMonthly,
      recommendedTargetPriceMonthly: pricing?.recommendedTargetPriceMonthly,
      signals,
    };
  });
}
