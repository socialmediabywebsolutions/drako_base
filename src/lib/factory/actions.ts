import { getFactoryIncidents, type FactoryIncident } from "@/lib/factory/incidents";
import { getFactoryStatus } from "@/lib/factory/status";
import { getFactoryTrends } from "@/lib/factory/trends";

export type FactoryOperatorAction = {
  id: string;
  severity: "critical" | "high" | "medium";
  title: string;
  description: string;
  recommendation: string;
  relatedIncidentId?: string;
  relatedJobId?: string | null;
  relatedDomain?: string | null;
};

const DEFAULT_LIMIT = 20;
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;

function normalizeLimit(limit?: number | null): number {
  if (!Number.isFinite(limit)) return DEFAULT_LIMIT;
  const value = Math.trunc(limit as number);
  if (value < MIN_LIMIT) return DEFAULT_LIMIT;
  if (value > MAX_LIMIT) return MAX_LIMIT;
  return value;
}

function buildActionFromIncident(
  incident: FactoryIncident,
  context: {
    hasFailures: boolean;
    hasPendingDomains: boolean;
    capacityExhausted: boolean;
  },
): FactoryOperatorAction | null {
  switch (incident.kind) {
    case "JOB_FAILED":
      return {
        id: `action_${incident.id}`,
        severity: "critical",
        title: "Investigate failed provisioning job",
        description: incident.message,
        recommendation: "Inspect job logs and retry provisioning if the error is transient.",
        relatedIncidentId: incident.id,
        relatedJobId: incident.relatedJobId,
        relatedDomain: incident.relatedDomain,
      };
    case "DOMAIN_FAILED":
      return {
        id: `action_${incident.id}`,
        severity: "high",
        title: "Investigate domain provisioning failure",
        description: incident.message,
        recommendation: "Verify Cloudflare hostname configuration and retry verification.",
        relatedIncidentId: incident.id,
        relatedJobId: incident.relatedJobId,
        relatedDomain: incident.relatedDomain,
      };
    case "DOMAIN_PENDING":
      return {
        id: `action_${incident.id}`,
        severity: "medium",
        title: "Domain still pending verification",
        description: incident.message,
        recommendation: "Check DNS propagation and verify CNAME records.",
        relatedIncidentId: incident.id,
        relatedJobId: incident.relatedJobId,
        relatedDomain: incident.relatedDomain,
      };
    case "QUOTA_PRESSURE":
      return {
        id: `action_${incident.id}`,
        severity: "medium",
        title: "Factory capacity exhausted",
        description: incident.message,
        recommendation: "Upgrade plan or free resources before creating new SaaS.",
        relatedIncidentId: incident.id,
        relatedJobId: incident.relatedJobId,
        relatedDomain: incident.relatedDomain,
      };
    case "JOB_DEGRADED":
      // Degraded jobs remain visible in incidents/trends, but this first operator feed only
      // emits actions for the explicitly supported remediation paths above.
      return context.hasFailures || context.hasPendingDomains || context.capacityExhausted ? null : null;
    default:
      return null;
  }
}

export async function getFactoryOperatorActions(
  tenantId: string,
  options?: {
    limit?: number | null;
  },
): Promise<FactoryOperatorAction[]> {
  const limit = normalizeLimit(options?.limit);
  const trendLimit = Math.min(limit, 50);

  const [incidents, trends, status] = await Promise.all([
    getFactoryIncidents(tenantId, { limit }),
    getFactoryTrends(tenantId, { limit: trendLimit }),
    getFactoryStatus(tenantId),
  ]);

  const context = {
    hasFailures: trends.summary.totalRecentFailed > 0 || status.slo.failing,
    hasPendingDomains: incidents.items.some((incident) => incident.kind === "DOMAIN_PENDING"),
    capacityExhausted:
      status.limits?.jobSlotsRemaining === 0 ||
      status.limits?.saasRemaining === 0 ||
      status.limits?.domainsRemaining === 0 ||
      false,
  };

  return incidents.items
    .map((incident) => buildActionFromIncident(incident, context))
    .filter((action): action is FactoryOperatorAction => action !== null)
    .slice(0, limit);
}
