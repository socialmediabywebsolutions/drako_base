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
  createdAt: string;
  updatedAt: string;
};
