import { buildOwnerControlSnapshot } from "@/lib/owner/control-dashboard";
import { listSaasForOwner } from "@/lib/owner/portfolio";
import { getSaasTaxSummary } from "@/lib/tax/engine";
import type { DracoEnv } from "@/lib/cf";
import type { OwnerTaxPortfolioSummary } from "@/lib/tax/types";

export async function buildOwnerTaxPortfolioSummary(params: {
  tenantId: string;
  ownerId: string;
  env?: DracoEnv | null;
}): Promise<OwnerTaxPortfolioSummary> {
  const items: OwnerTaxPortfolioSummary["items"] = [];
  let totalVatDueAllSaas = 0;
  let saasWithHighVat = 0;
  let saasWithNegativeMargin = 0;

  const saasList = await listSaasForOwner(params.tenantId, params.ownerId);
  for (const saas of saasList) {
    const summary = await getSaasTaxSummary({ tenantId: params.tenantId, saasId: saas.id, env: params.env });
    let marginPercent: number | undefined;
    try {
      const controlSnapshot = await buildOwnerControlSnapshot({ tenantId: params.tenantId, saasId: saas.id });
      marginPercent = controlSnapshot.economy.marginPercentEstimated ?? undefined;
    } catch (error) {
      console.warn("OWNER_TAX_PORTFOLIO_MARGIN_ERROR", error);
    }
    totalVatDueAllSaas += summary.currentQuarterVatDue;
    if (summary.status === "RISK") saasWithHighVat += 1;
    if ((marginPercent ?? 0) < 0) saasWithNegativeMargin += 1;
    items.push({
      saasId: saas.id,
      vatDue: summary.currentQuarterVatDue,
      status: summary.status,
      marginPercent,
      periodKey: summary.currentQuarterKey,
    });
  }

  return {
    totalVatDueAllSaas,
    saasWithHighVat,
    saasWithNegativeMargin,
    items,
  };
}
