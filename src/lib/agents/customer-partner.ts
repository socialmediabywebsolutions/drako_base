import {
  getCustomerValueSnapshot,
  getCustomerWithProfile,
  listCustomerBookings,
  listCustomerStyleNotes,
  resolveCustomersContext,
} from "@/lib/customers/repository";
import type {
  CustomerPartnerSnapshot,
  CustomerValueSnapshot,
  SaasCustomer,
  SaasCustomerBooking,
  SaasCustomerProfile,
} from "@/lib/customers/types";
import {
  getLowStockItems,
  getServiceInventoryStatus,
  getServicePhases,
  listSaasInventoryItems,
  listSaasServiceProducts,
  listSaasServices,
  resolveEconomyContext,
} from "@/lib/economy/repository";
import type { SaasService, ServicePhase } from "@/lib/economy/types";
import { getPricingSuggestions, type PricingStatus } from "@/lib/economy/pricing";

export type CustomerPartnerSuggestionCategory = "STYLE" | "COLOR" | "INVENTORY" | "LOYALTY" | "SCHEDULING";

export type CustomerPartnerSuggestion = {
  category: CustomerPartnerSuggestionCategory;
  title: string;
  description: string;
  serviceId?: string;
  inventoryItemId?: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
};

export type CustomerServiceInventoryItem = {
  inventoryItemId: string;
  name: string;
  quantityPerService: number;
  stockQuantity: number;
  minStockQuantity: number;
};

export type CustomerPricingInfo = {
  currentPrice: number;
  suggestedPrice: number;
  marginCurrent: number;
  marginStatus: PricingStatus;
};

export type CustomerServiceSuggestion = {
  serviceId: string;
  title: string;
  reason: string;
  estimatedDuration: number;
  price: number;
  stockOk: boolean;
  marginStatus: PricingStatus;
};

export type CustomerPartnerContext = {
  customer: SaasCustomer;
  profile: SaasCustomerProfile | null;
  bookingsRecent: SaasCustomerBooking[];
  bookingsAll: SaasCustomerBooking[];
  valueSnapshot: CustomerValueSnapshot;
  services: SaasService[];
  availableServices: SaasService[];
  inventoryByService: Record<string, CustomerServiceInventoryItem[]>;
  inventoryIssuesByService: Record<string, boolean>;
  pricingInfoByService: Record<string, CustomerPricingInfo>;
  favoriteServices: Array<{ serviceId: string; name: string; count: number }>;
  servicePhases: Record<string, ServicePhase[]>;
  inventoryWarningsRelevant: CustomerPartnerSnapshot["inventoryWarningsRelevant"];
  styleNotes: Array<{ noteType: string; content: string }>;
};

export type CustomerPartnerSnapshotResult = {
  snapshot: CustomerPartnerSnapshot;
  suggestions: Record<CustomerPartnerSuggestionCategory, CustomerPartnerSuggestion[]>;
};

function pickFavoriteServices(bookings: SaasCustomerBooking[], services: SaasService[]) {
  const counts = new Map<string, number>();
  bookings.forEach((booking) => {
    counts.set(booking.serviceId, (counts.get(booking.serviceId) ?? 0) + 1);
  });
  const serviceMap = new Map(services.map((service) => [service.id, service.name]));
  return Array.from(counts.entries())
    .map(([serviceId, count]) => ({
      serviceId,
      name: serviceMap.get(serviceId) ?? "Servicio",
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

function getLastCompletedBooking(bookings: SaasCustomerBooking[]): SaasCustomerBooking | null {
  const completed = bookings.filter((booking) => booking.status === "DONE");
  if (completed.length === 0) return null;
  return completed.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0];
}

function weeksSince(date: string | null): number | null {
  if (!date) return null;
  const diff = Date.now() - new Date(date).getTime();
  if (!Number.isFinite(diff) || diff < 0) return null;
  return diff / (1000 * 60 * 60 * 24 * 7);
}

function buildSnapshot(ctx: CustomerPartnerContext): CustomerPartnerSnapshot {
  return {
    customer: ctx.customer,
    profile: ctx.profile,
    vipLevel: ctx.customer.vipLevel,
    bookingsRecent: ctx.bookingsRecent,
    favoriteServices: ctx.favoriteServices,
    estimatedLtv: ctx.valueSnapshot.estimatedLtv,
    styleProfile: ctx.profile?.styleProfile ?? null,
    inventoryWarningsRelevant: ctx.inventoryWarningsRelevant,
  };
}

export async function buildCustomerPartnerContext(params: {
  tenantId: string;
  saasId: string;
  customerId: string;
  env?: Parameters<typeof resolveEconomyContext>[0]["env"];
}): Promise<CustomerPartnerContext> {
  const { tenantId, saasId, customerId, env } = params;
  const customersCtx = await resolveCustomersContext({ tenantId, saasId, env });
  const economyCtx = await resolveEconomyContext({ tenantId, saasId, env });

  const [
    { customer, profile },
    bookingsRecent,
    bookingsAll,
    valueSnapshot,
    services,
    pricingSuggestions,
    styleNotes,
    lowStockItems,
    inventoryItems,
  ] = await Promise.all([
    getCustomerWithProfile(customersCtx, customerId),
    listCustomerBookings(customersCtx, customerId, { limit: 12 }),
    listCustomerBookings(customersCtx, customerId),
    getCustomerValueSnapshot(customersCtx, customerId),
    listSaasServices(economyCtx),
    getPricingSuggestions(economyCtx).catch(() => []),
    listCustomerStyleNotes(customersCtx, customerId),
    getLowStockItems(economyCtx),
    listSaasInventoryItems(economyCtx),
  ]);

  if (!customer) {
    throw new Error("Customer not found for partner context");
  }

  const serviceIds = Array.from(new Set(bookingsAll.map((booking) => booking.serviceId)));
  const availableServices = services.filter((service) => service.isActive);
  const inventoryStatuses = await Promise.all(serviceIds.map((serviceId) => getServiceInventoryStatus(economyCtx, serviceId)));
  const lowStockIds = new Set(lowStockItems.map((item) => item.id));

  const inventoryWarningsRelevant = inventoryStatuses.flatMap((status) => {
    return status.items
      .filter((item) => item.isLowStock || lowStockIds.has(item.inventoryItemId))
      .map((item) => ({
        serviceId: status.serviceId,
        inventoryItemId: item.inventoryItemId,
        name: item.name,
        isLowStock: true,
      }));
  });

  const inventoryDedup = new Map(inventoryWarningsRelevant.map((item) => [`${item.serviceId}:${item.inventoryItemId}`, item]));
  const servicePhases = Object.fromEntries(
    serviceIds
      .map((serviceId) => {
        const service = services.find((item) => item.id === serviceId);
        const phases = service ? getServicePhases(service) : [];
        return [serviceId, phases] as const;
      })
      .filter(([, phases]) => phases.length > 0),
  );

  const pricingInfoByService: Record<string, CustomerPricingInfo> = Object.fromEntries(
    pricingSuggestions.map((suggestion) => [
      suggestion.serviceId,
      {
        currentPrice: suggestion.currentPrice,
        suggestedPrice: suggestion.suggestedPrice,
        marginCurrent: suggestion.marginCurrent,
        marginStatus: suggestion.status,
      },
    ]),
  );

  const inventoryMap = new Map(inventoryItems.map((item) => [item.id, item]));
  const inventoryByServiceEntries = await Promise.all(
    availableServices.map(async (service) => {
      const products = await listSaasServiceProducts(economyCtx, service.id);
      const items = products.map((product) => {
        const item = inventoryMap.get(product.inventoryItemId);
        return {
          inventoryItemId: product.inventoryItemId,
          name: item?.name ?? product.inventoryItemId,
          quantityPerService: product.quantityPerService,
          stockQuantity: item?.stockQuantity ?? 0,
          minStockQuantity: item?.minStockQuantity ?? 0,
        };
      });
      return [service.id, items] as const;
    }),
  );
  const inventoryByService = Object.fromEntries(inventoryByServiceEntries);
  const inventoryIssuesByService = Object.fromEntries(
    inventoryByServiceEntries.map(([serviceId, items]) => [
      serviceId,
      items.some((item) => item.stockQuantity < item.quantityPerService),
    ]),
  );

  return {
    customer,
    profile,
    bookingsRecent,
    bookingsAll,
    valueSnapshot,
    services,
    availableServices,
    inventoryByService,
    inventoryIssuesByService,
    pricingInfoByService,
    favoriteServices: pickFavoriteServices(bookingsAll, services),
    servicePhases,
    inventoryWarningsRelevant: Array.from(inventoryDedup.values()),
    styleNotes: styleNotes.map((note) => ({ noteType: note.noteType, content: note.content })),
  };
}

export function getCustomerStyleSuggestions(ctx: CustomerPartnerContext): CustomerPartnerSuggestion[] {
  const suggestions: CustomerPartnerSuggestion[] = [];
  const lastCompleted = getLastCompletedBooking(ctx.bookingsAll);
  const weeks = weeksSince(lastCompleted?.startTime ?? null);
  const favorite = ctx.favoriteServices[0];
  const wantsChange = ctx.profile?.styleProfile?.["notes"]?.toString().toLowerCase().includes("cambiar") ?? false;
  const lowStockServices = new Set(ctx.inventoryWarningsRelevant.map((item) => item.serviceId));

  if (favorite && weeks && weeks >= 6 && favorite.name.toLowerCase().includes("color") && !lowStockServices.has(favorite.serviceId)) {
    suggestions.push({
      category: "STYLE",
      title: "Retoque de raiz recomendado",
      description: `Han pasado ${weeks.toFixed(0)} semanas desde tu ultimo color. Un retoque rapido mantiene el tono perfecto.`,
      serviceId: favorite.serviceId,
      priority: "MEDIUM",
    });
  }

  if (wantsChange) {
    const alternative = ctx.services.find(
      (service) => service.isActive && service.name.toLowerCase().includes("balayage") && !lowStockServices.has(service.id),
    );
    if (alternative) {
      suggestions.push({
        category: "STYLE",
        title: "Nueva idea para tu proxima visita",
        description: "Te podria gustar probar un servicio con mas contraste y movimiento.",
        serviceId: alternative.id,
        priority: "LOW",
      });
    }
  }

  return suggestions;
}

export function getCustomerColorSuggestions(ctx: CustomerPartnerContext): CustomerPartnerSuggestion[] {
  const suggestions: CustomerPartnerSuggestion[] = [];
  const preferenceTone = ctx.profile?.preferences?.["tone"];
  const noteMatch = ctx.styleNotes.find((note) => note.noteType === "COLOR_PREF");
  const colorHint = (preferenceTone ?? noteMatch?.content ?? "").toString().toLowerCase();
  if (colorHint) {
    suggestions.push({
      category: "COLOR",
      title: "Preferencia de color registrada",
      description: `Tenemos en cuenta tu preferencia: ${colorHint}. Consultanos para ajustar el tono.`,
      priority: "LOW",
    });
  }
  return suggestions;
}

export function getCustomerInventoryAwareSuggestions(ctx: CustomerPartnerContext): CustomerPartnerSuggestion[] {
  const suggestions: CustomerPartnerSuggestion[] = [];
  ctx.inventoryWarningsRelevant.slice(0, 2).forEach((item) => {
    suggestions.push({
      category: "INVENTORY",
      title: `Stock ajustado: ${item.name}`,
      description: "Si quieres este tono o tratamiento, avisanos con tiempo para reservar producto.",
      serviceId: item.serviceId,
      inventoryItemId: item.inventoryItemId,
      priority: "HIGH",
    });
  });
  if (suggestions.length === 0) {
    suggestions.push({
      category: "INVENTORY",
      title: "Todo listo para tu servicio",
      description: "Tenemos disponibilidad de productos para tus servicios habituales.",
      priority: "LOW",
    });
  }
  return suggestions;
}

export function getCustomerLoyaltySuggestions(ctx: CustomerPartnerContext): CustomerPartnerSuggestion[] {
  const suggestions: CustomerPartnerSuggestion[] = [];
  if (ctx.customer.vipLevel !== "REGULAR" && ctx.valueSnapshot.totalRevenue >= 150) {
    suggestions.push({
      category: "LOYALTY",
      title: "Gracias por tu fidelidad",
      description: "Te guardamos un extra de cuidado o un detalle premium en tu proxima visita.",
      priority: "MEDIUM",
    });
  }
  if (ctx.valueSnapshot.totalVisits <= 1) {
    suggestions.push({
      category: "LOYALTY",
      title: "Promo de regreso",
      description: "Reserva tu proxima visita con un extra de hidratacion sin coste.",
      priority: "MEDIUM",
    });
  }
  return suggestions;
}

export function getCustomerSchedulingSuggestions(ctx: CustomerPartnerContext): CustomerPartnerSuggestion[] {
  const suggestions: CustomerPartnerSuggestion[] = [];
  const frequencyWeeks = ctx.valueSnapshot.frequencyWeeks ?? 6;
  const lastCompleted = getLastCompletedBooking(ctx.bookingsAll);
  const weeks = weeksSince(lastCompleted?.startTime ?? null);
  const nextVisitWeeks = Math.max(4, Math.round(frequencyWeeks));
  if (!weeks || weeks >= nextVisitWeeks) {
    suggestions.push({
      category: "SCHEDULING",
      title: "Momento ideal para reservar",
      description: `Te recomendamos agendar cada ${nextVisitWeeks} semanas para mantener el look.`,
      priority: "HIGH",
    });
  } else {
    suggestions.push({
      category: "SCHEDULING",
      title: "Proxima visita sugerida",
      description: `Reserva en ~${Math.max(1, Math.round(nextVisitWeeks - weeks))} semanas para mantener el resultado.`,
      priority: "LOW",
    });
  }
  return suggestions;
}

function normalizeEventType(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

function resolveEventType(
  ctx: CustomerPartnerContext,
  options?: { eventType?: string | null },
): string | null {
  return (
    normalizeEventType(options?.eventType) ??
    normalizeEventType(ctx.customer.styleProfile?.eventType?.toString() ?? null) ??
    normalizeEventType(ctx.profile?.styleProfile?.["event_type"]?.toString() ?? null)
  );
}

function isSpecialEvent(eventType: string | null): boolean {
  if (!eventType) return false;
  return ["wedding", "boda", "party", "evento", "event", "gala"].some((keyword) => eventType.includes(keyword));
}

export function getCustomerServiceSuggestions(
  ctx: CustomerPartnerContext,
  options?: {
    referenceServiceId?: string | null;
    eventType?: string | null;
    budgetRange?: { min?: number | null; max?: number | null } | null;
  },
): CustomerServiceSuggestion[] {
  const available = ctx.availableServices;
  const eventType = resolveEventType(ctx, options);
  const specialEvent = isSpecialEvent(eventType);
  const minBudget = options?.budgetRange?.min ?? null;
  const maxBudget = options?.budgetRange?.max ?? null;
  const reference = available.find((service) => service.id === options?.referenceServiceId) ?? null;

  const candidates = available
    .map((service) => {
      const stockOk = !ctx.inventoryIssuesByService[service.id];
      const pricing = ctx.pricingInfoByService[service.id];
      const marginStatus = pricing?.marginStatus ?? "OK";
      const price = service.currentPrice;
      const overBudget = typeof maxBudget === "number" && price > maxBudget;
      const underBudget = typeof minBudget === "number" && price < minBudget;

      let score = 0;
      if (reference) {
        if (service.id === reference.id) score += 40;
        if (reference.category && service.category === reference.category) score += 8;
      }
      if (specialEvent) {
        score += price / 12;
      } else {
        score += Math.max(0, 60 - price) / 10;
      }
      if (marginStatus === "OK") score += 10;
      if (marginStatus === "LOW_MARGIN") score -= 4;
      if (marginStatus === "LOSS") score -= 12;
      if (overBudget) score -= 8;
      if (underBudget) score -= 2;

      return {
        service,
        stockOk,
        marginStatus,
        price,
        overBudget,
        score,
      };
    })
    .filter((candidate) => candidate.stockOk);

  if (candidates.length === 0) return [];

  const withinBudget = typeof maxBudget === "number" ? candidates.filter((candidate) => !candidate.overBudget) : candidates;
  const pool = withinBudget.length > 0 ? withinBudget : candidates;

  const sorted = pool.sort((a, b) => b.score - a.score).slice(0, 4);

  // TODO: conectar IA para enriquecer motivos y bundles personalizados.
  return sorted.map((candidate) => {
    const service = candidate.service;
    const eventHint = eventType ? ` para ${eventType}` : "";
    const budgetNote = candidate.overBudget
      ? "Se sale un poco de tu presupuesto, pero conseguimos un resultado muy parecido."
      : "Encaja bien con tu rango actual.";
    const marginNote =
      candidate.marginStatus === "LOSS"
        ? "Necesita ajuste de coste, te avisamos antes de confirmar."
        : candidate.marginStatus === "LOW_MARGIN"
        ? "Margen ajustado, recomendación limitada."
        : "Buen balance de resultado y valor.";
    const reasonParts = [
      reference ? `Relacionado con ${reference.name}${eventHint}.` : `Servicio recomendado${eventHint}.`,
      maxBudget !== null || minBudget !== null ? budgetNote : null,
      marginNote,
    ].filter(Boolean);

    return {
      serviceId: service.id,
      title: service.name,
      reason: reasonParts.join(" "),
      estimatedDuration: service.durationMinutes,
      price: service.currentPrice,
      stockOk: true,
      marginStatus: candidate.marginStatus,
    };
  });
}

export function getCustomerPartnerSuggestions(ctx: CustomerPartnerContext): CustomerPartnerSnapshotResult {
  // TODO: Aqui se conectara IA generativa para enriquecer recomendaciones personalizadas.
  const style = getCustomerStyleSuggestions(ctx);
  const color = getCustomerColorSuggestions(ctx);
  const inventory = getCustomerInventoryAwareSuggestions(ctx);
  const loyalty = getCustomerLoyaltySuggestions(ctx);
  const scheduling = getCustomerSchedulingSuggestions(ctx);

  return {
    snapshot: buildSnapshot(ctx),
    suggestions: {
      STYLE: style,
      COLOR: color,
      INVENTORY: inventory,
      LOYALTY: loyalty,
      SCHEDULING: scheduling,
    },
  };
}
