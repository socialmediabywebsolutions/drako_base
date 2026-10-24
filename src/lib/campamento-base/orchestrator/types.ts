export type SnapshotKpis = {
  totalMRR: number;
  totalSaas: number;
  vendorFixedMonthly: number;
  approxMarginMonthly: number;
  approxMarginRate: number;
  activeSubscriptions?: number;
};

export type SaasRow = {
  saasId: string;
  saasName: string;
  slug?: string;
  planLabel?: string;
  mrr: number;
  marginPct?: number;
  cost?: number;
  marginEur?: number;
  activeSubs?: number;
  opsSeverity?: "CRITICAL" | "WARNING" | "OK" | "UNKNOWN";
  socialEnabled?: boolean;
};

export type Growth = {
  current: number;
  previous: number;
  delta: number;
  rate: number;
};

export type Growth30WithSeries = Growth & {
  series: Array<{ day: string; total: number }>;
};

export type MrrTrend30d = {
  current: number;
  previous?: number;
  delta?: number;
  rate?: number;
};

export type SocialflowSummary = {
  total?: number;
  enabled?: number;
  disabled?: number;
  lastRunAt?: string | null;
};

export type GovernanceSummary = {
  total?: number;
  critical?: number;
  warning?: number;
  ok?: number;
};

export type CriticalEvent = {
  type: string;
  severity: string;
  message: string;
  createdAt: string;
  correlationId: string;
  saasSlug?: string | null;
};

export type EventRollup = {
  day: string;
  saasSlug?: string | null;
  type: string;
  severity: string;
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
};

export type CampamentoBaseSnapshot = {
  kpis: SnapshotKpis;
  saas: SaasRow[];
  socialflow?: SocialflowSummary | null;
  governance?: GovernanceSummary | null;
  events: {
    criticalEvents: CriticalEvent[];
    rollups: EventRollup[];
    growth7d: Growth;
    growth30d: Growth30WithSeries;
  };
  mrr30d?: MrrTrend30d | null;
};

export type OrchestratorIntent =
  | "best_saas"
  | "worst_saas"
  | "worst_margin"
  | "critical_alerts"
  | "evolution"
  | "what_to_review_first";

export type OrchestratorAnswer = {
  intent: OrchestratorIntent;
  summary: string;
  facts: unknown;
  evidence?: unknown;
};
