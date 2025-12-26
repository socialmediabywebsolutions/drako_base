import type { EconomyContext } from "@/lib/economy/repository";
import { calculateServiceCost, getSaasPricingSettings, listSaasServices } from "@/lib/economy/repository";

export type PricingStatus = "OK" | "LOW_MARGIN" | "LOSS";

export type PricingSuggestion = {
  serviceId: string;
  serviceName: string;
  currentPrice: number;
  suggestedPrice: number;
  marginCurrent: number;
  marginWithSuggested: number;
  serviceCost: number;
  status: PricingStatus;
};

function computeMargin(price: number, cost: number): number {
  if (price <= 0) return -100;
  return ((price - cost) / price) * 100;
}

export async function suggestPriceForService(ctx: EconomyContext, serviceId: string): Promise<PricingSuggestion> {
  const services = await listSaasServices(ctx);
  const service = services.find((item) => item.id === serviceId);
  if (!service) {
    throw new Error("Service not found");
  }
  const settings = await getSaasPricingSettings(ctx);
  const cost = await calculateServiceCost(ctx, serviceId);
  const targetMargin = settings.targetMarginPercent;
  const minMargin = settings.minMarginPercent;

  const divisor = 1 - targetMargin / 100;
  const suggestedPrice = divisor > 0 ? cost.totalCost / divisor : cost.totalCost;
  const marginCurrent = computeMargin(service.currentPrice, cost.totalCost);
  const marginWithSuggested = computeMargin(suggestedPrice, cost.totalCost);

  let status: PricingStatus = "OK";
  if (service.currentPrice <= cost.totalCost) {
    status = "LOSS";
  } else if (marginCurrent < minMargin) {
    status = "LOW_MARGIN";
  }

  return {
    serviceId: service.id,
    serviceName: service.name,
    currentPrice: service.currentPrice,
    suggestedPrice,
    marginCurrent,
    marginWithSuggested,
    serviceCost: cost.totalCost,
    status,
  };
}

export async function getPricingSuggestions(ctx: EconomyContext): Promise<PricingSuggestion[]> {
  const services = (await listSaasServices(ctx)).filter((service) => service.isActive);
  const suggestions = await Promise.all(services.map((service) => suggestPriceForService(ctx, service.id)));

  const priority: Record<PricingStatus, number> = { LOSS: 0, LOW_MARGIN: 1, OK: 2 };
  return suggestions.sort((a, b) => {
    const statusDiff = priority[a.status] - priority[b.status];
    if (statusDiff !== 0) return statusDiff;
    return a.marginCurrent - b.marginCurrent;
  });
}
