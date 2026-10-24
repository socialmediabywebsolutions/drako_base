import type { SaasSocialProvider } from "@/lib/social-core/types";

export type IntelligenceFeedType = "opportunity" | "recommendation" | "alert";
export type IntelligenceFeedPriority = "high" | "medium" | "low";
export type IntelligenceFeedStatus = "new" | "read" | "dismissed";

export type IntelligenceFeedItem = {
  id: string;
  tenantId: string;
  saasId: string;
  type: IntelligenceFeedType;
  title: string;
  description: string;
  priority: IntelligenceFeedPriority;
  status: IntelligenceFeedStatus;
  actionLabel: string | null;
  actionHref: string | null;
  source: string | null;
  // Red social de origen de la señal — nullable: NULL significa agnóstica/desconocida
  // (todas las filas históricas anteriores a esta columna, más los escritores que aún
  // no la propagan: ContentFatigueAgent, ViralOpportunityAgent, AudienceInsightAgent,
  // el feed basado en audit). Solo instagram/linkedin token-health la rellenan hoy.
  network: SaasSocialProvider | null;
  createdAt: string;
  updatedAt: string;
};
