export const CONTROL_PLANE_CONTRACT_NAMES = [
  "ProductManifest",
  "HealthReport",
  "ReadinessReport",
  "ObservabilitySnapshot",
  "CommandRequest",
  "CommandResult",
  "BillingEntitlementSnapshot",
  "AuditEventEnvelope",
  "ControlPlaneEventEnvelope",
  "ProvisioningJobContract",
  "OperatorCapabilityManifest",
] as const;

export type ProductKey =
  | "drako"
  | "campamento-base"
  | "factory"
  | "socialflow"
  | "mentoria"
  | "bases"
  | "drakos"
  | "shared";

export type RuntimeEnvironment = "local" | "preview" | "canary" | "nonprod" | "production";
export type BillingMode = "central-ledger" | "product-local";
export type ReadinessStatus = "ready" | "blocked" | "degraded";
export type HealthStatus = "healthy" | "degraded" | "down";
export type ObservabilityStatus = "healthy" | "needs_attention" | "degraded" | "unknown";
export type CommandName =
  | "pause"
  | "resume"
  | "drain_queues"
  | "retry_job"
  | "prepare_rollback"
  | "execute_rollback";
export type ProvisioningJobState =
  | "requested"
  | "running"
  | "waiting_approval"
  | "succeeded"
  | "failed"
  | "rollback_needed";
export type EventSeverity = "INFO" | "WARN" | "ERROR" | "CRITICAL";

export type ProductCapability = {
  capabilityKey: string;
  description: string;
  productScoped: boolean;
};

export type ProductManifest = {
  productKey: ProductKey;
  displayName: string;
  contractVersion: string;
  runtime: {
    runtimeKey: string;
    environment: RuntimeEnvironment;
    workerName: string;
    healthUrl: string;
    readinessUrl: string;
    observabilityUrl: string;
    auditUrl: string;
    versionUrl: string;
  };
  auth: {
    issuer: string;
    cookieNamespace: string;
    authDbBinding: string;
    dedicatedSecretRequired: boolean;
  };
  billing: {
    mode: BillingMode;
    saasSlug: string;
  };
  capabilities: ProductCapability[];
};

export type HealthReport = {
  productKey: ProductKey;
  runtimeKey: string;
  environment: RuntimeEnvironment;
  status: HealthStatus;
  generatedAt: string;
  version: {
    releaseId: string;
    buildSha: string;
  };
  workerIdentity: {
    workerName: string;
    routeScope: string[];
  };
};

export type ReadinessCheck = {
  checkKey: string;
  status: "pass" | "warn" | "fail";
  message: string;
};

export type ReadinessReport = {
  productKey: ProductKey;
  runtimeKey: string;
  environment: RuntimeEnvironment;
  status: ReadinessStatus;
  generatedAt: string;
  checks: ReadinessCheck[];
  blockers: string[];
};

export type ServiceLevelSnapshot = {
  availability: number | null;
  p95LatencyMs: number | null;
  errorRate: number | null;
  queueDepth: number | null;
  cronLagSeconds: number | null;
  authFailures: number | null;
  dbFailures: number | null;
  rollbackCount: number | null;
};

export type ObservabilitySnapshot = {
  productKey: ProductKey;
  saasSlug: string;
  generatedAt: string;
  status: ObservabilityStatus;
  freshness: "fresh" | "stale" | "unknown";
  releaseId: string;
  buildSha: string;
  openIncidents: number;
  externalDependencies: Array<{
    dependencyKey: string;
    status: ObservabilityStatus;
    message: string;
  }>;
  slis: ServiceLevelSnapshot;
  productMetrics: Record<string, number | string | boolean | null>;
};

export type CommandRequest = {
  command: CommandName;
  correlationId: string;
  requestedBy: {
    actorType: "operator" | "automation";
    actorId: string;
  };
  payload: Record<string, unknown> | null;
};

export type CommandResult = {
  command: CommandName;
  correlationId: string;
  accepted: boolean;
  status: "accepted" | "rejected" | "completed" | "failed";
  message: string;
  completedAt: string | null;
};

export type BillingEntitlementSnapshot = {
  tenantId: string;
  saasSlug: string;
  planCode: string | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  features: string[];
  limits: Record<string, number>;
  usage: Record<string, number>;
  signature: string;
  generatedAt: string;
};

export type AuditEventEnvelope = {
  eventType: string;
  severity: EventSeverity;
  correlationId: string;
  tenantId: string | null;
  saasSlug: string | null;
  actor: {
    actorType: "user" | "system" | "operator";
    actorId: string;
  };
  createdAt: string;
  payload: Record<string, unknown> | null;
};

export type ControlPlaneEventEnvelope = {
  eventType: string;
  severity: EventSeverity;
  correlationId: string;
  productKey: ProductKey;
  runtimeKey: string;
  createdAt: string;
  payload: Record<string, unknown> | null;
};

export type ProvisioningJobContract = {
  jobId: string;
  tenantId: string;
  productKey: ProductKey;
  requestedAt: string;
  state: ProvisioningJobState;
  rollbackReady: boolean;
  message: string;
};

export type OperatorCapabilityManifest = {
  productKey: ProductKey;
  capabilityVersion: string;
  commands: Array<{
    command: CommandName;
    displayName: string;
    description: string;
    requiresHumanApproval: boolean;
  }>;
};

export function defineProductManifest(manifest: ProductManifest): ProductManifest {
  return manifest;
}

export function defineOperatorCapabilityManifest(
  manifest: OperatorCapabilityManifest,
): OperatorCapabilityManifest {
  return manifest;
}
