import { resolveAppointmentsContext, listAppointmentsForSaas } from "@/lib/appointments/repository";
import { resolveCustomersContext, listSaasCustomers } from "@/lib/customers/repository";
import { resolveEconomyContext, listSaasServices, getServiceInventoryStatus } from "@/lib/economy/repository";
import { getPricingSuggestions } from "@/lib/economy/pricing";
import type { SocialCampaignIdea, SocialPostSuggestion } from "@/lib/social/types";
import type { SocialContext } from "@/lib/social/repository";

type ServiceInsight = {
  serviceId: string;
  name: string;
  marginStatus: "OK" | "LOW_MARGIN" | "LOSS";
  appointmentCount: number;
  stockStatus: "OK" | "LOW_STOCK" | "OUT_OF_STOCK";
};

function scoreService(service: ServiceInsight): number {
  let score = 0;
  if (service.marginStatus === "OK") score += 6;
  if (service.marginStatus === "LOW_MARGIN") score += 2;
  if (service.marginStatus === "LOSS") score -= 4;
  if (service.stockStatus === "OK") score += 4;
  if (service.stockStatus === "LOW_STOCK") score -= 2;
  if (service.stockStatus === "OUT_OF_STOCK") score -= 6;
  score += Math.max(0, 10 - service.appointmentCount);
  return score;
}

async function buildServiceInsights(ctx: SocialContext): Promise<ServiceInsight[]> {
  const saasId = ctx.saasId?.trim() ?? "";
  if (!saasId) return [];
  const economyCtx = await resolveEconomyContext({ tenantId: ctx.tenantId, saasId, env: ctx.env });
  const services = (await listSaasServices(economyCtx)).filter((service) => service.isActive);
  const pricing = await getPricingSuggestions(economyCtx).catch(() => []);
  const pricingMap = new Map(pricing.map((item) => [item.serviceId, item.status]));

  const apptCtx = await resolveAppointmentsContext({ tenantId: ctx.tenantId, saasId, env: ctx.env }).catch(() => null);
  const now = Date.now();
  const from = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  const to = new Date(now + 24 * 60 * 60 * 1000).toISOString();
  const appointments = apptCtx ? await listAppointmentsForSaas(apptCtx, { from, to }).catch(() => []) : [];
  const counts = new Map<string, number>();
  appointments.forEach((appointment) => {
    counts.set(appointment.serviceId, (counts.get(appointment.serviceId) ?? 0) + 1);
  });

  const insights = await Promise.all(
    services.map(async (service) => {
      const inventoryStatus = await getServiceInventoryStatus(economyCtx, service.id);
      let stockStatus: ServiceInsight["stockStatus"] = "OK";
      if (inventoryStatus.items.some((item) => item.stockQuantity < item.quantityPerService)) {
        stockStatus = "OUT_OF_STOCK";
      } else if (inventoryStatus.items.some((item) => item.isLowStock)) {
        stockStatus = "LOW_STOCK";
      }
      return {
        serviceId: service.id,
        name: service.name,
        marginStatus: pricingMap.get(service.id) ?? "OK",
        appointmentCount: counts.get(service.id) ?? 0,
        stockStatus,
      };
    }),
  );

  return insights;
}

export async function getSocialCampaignIdeasForSaas(ctx: SocialContext): Promise<SocialCampaignIdea[]> {
  const insights = await buildServiceInsights(ctx);
  if (insights.length === 0) {
    return [
      {
        title: "Impulsar servicios premium",
        objective: "BUILD_BRAND",
        targetSegment: "ALL",
        suggestedServicesIds: [],
        notes: "No hay datos suficientes aún. Usa esta campaña para mostrar tu propuesta diferencial.",
      },
    ];
  }

  const sortedByScore = [...insights].sort((a, b) => scoreService(b) - scoreService(a));
  const topService = sortedByScore[0];
  const lowActivity = [...insights]
    .filter((service) => service.marginStatus === "OK" && service.appointmentCount <= 2 && service.stockStatus === "OK")
    .slice(0, 2);

  const customersCtx = await resolveCustomersContext({ tenantId: ctx.tenantId, saasId: ctx.saasId, env: ctx.env }).catch(() => null);
  const customers = customersCtx ? await listSaasCustomers(customersCtx).catch(() => []) : [];
  const preferredCounts = new Map<string, number>();
  customers.forEach((customer) => {
    (customer.preferredServices ?? []).forEach((serviceId) => {
      preferredCounts.set(serviceId, (preferredCounts.get(serviceId) ?? 0) + 1);
    });
  });
  const preferredServiceId = [...preferredCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const ideas: SocialCampaignIdea[] = [];

  if (topService) {
    ideas.push({
      title: `Impulsar ${topService.name} este mes`,
      objective: "FILL_AGENDA",
      targetSegment: "ALL",
      suggestedServicesIds: [topService.serviceId],
      notes: "Servicio con margen sólido y buena disponibilidad. Ideal para publicar resultados.",
    });
  }

  if (lowActivity.length > 0) {
    ideas.push({
      title: `Reactivar ${lowActivity[0].name} en días flojos`,
      objective: "FILL_AGENDA",
      targetSegment: "INACTIVE_30D",
      suggestedServicesIds: lowActivity.map((item) => item.serviceId),
      notes: "Servicios con margen alto pero pocas citas en el último mes.",
    });
  }

  if (preferredServiceId) {
    ideas.push({
      title: "Reenganchar clientas fieles",
      objective: "REACTIVATE_CUSTOMERS",
      targetSegment: "VIP",
      suggestedServicesIds: [preferredServiceId],
      notes: "Basado en preferencias recurrentes de tus clientas VIP.",
    });
  }

  if (ideas.length < 3) {
    ideas.push({
      title: "Contenido de confianza y before/after",
      objective: "BUILD_BRAND",
      targetSegment: "NEW_CUSTOMERS",
      suggestedServicesIds: insights.filter((item) => item.stockStatus === "OK").slice(0, 2).map((item) => item.serviceId),
      notes: "Refuerza reputación con resultados reales y testimonios.",
    });
  }

  return ideas.slice(0, 5);
}

export async function getSocialPostSuggestionsForCampaign(
  ctx: SocialContext,
  _campaignId: string,
): Promise<SocialPostSuggestion[]> {
  void _campaignId;
  const insights = await buildServiceInsights(ctx);
  const candidates = insights.filter((item) => item.stockStatus !== "OUT_OF_STOCK");
  const selected = candidates.sort((a, b) => scoreService(b) - scoreService(a)).slice(0, 3);

  // TODO: En v2 integrar CustomerPartner para ajustar tono y tipo de contenido según segmentos.
  return selected.map((item, index) => ({
    provider: "INSTAGRAM",
    contentType: index === 0 ? "FEED" : "STORY",
    title: `${item.name}: resultado que se nota`,
    body:
      item.marginStatus === "OK"
        ? "Más brillo, más cuidado y agenda inteligente para encontrar tu hueco."
        : "Look personalizado con disponibilidad limitada. Reserva con tiempo.",
    imageHint: index === 0 ? "antes/después en luz natural" : "detalle de textura y brillo",
    linkedServiceId: item.serviceId,
    reason: "Servicio con buena respuesta y disponibilidad en agenda.",
    stockStatus: item.stockStatus,
    marginStatus: item.marginStatus,
  }));
}

export async function getDailySocialSuggestions(ctx: SocialContext): Promise<SocialPostSuggestion[]> {
  const insights = await buildServiceInsights(ctx);
  const today = insights.filter((item) => item.stockStatus === "OK").slice(0, 2);
  return today.map((item) => ({
    provider: "INSTAGRAM",
    contentType: "STORY",
    title: `Hoy en salon: ${item.name}`,
    body: "Resultados reales del día y disponibilidad limitada.",
    imageHint: "detalle de proceso en cabina",
    linkedServiceId: item.serviceId,
    reason: "Servicio destacado en agenda inmediata.",
    stockStatus: item.stockStatus,
    marginStatus: item.marginStatus,
  }));
}
