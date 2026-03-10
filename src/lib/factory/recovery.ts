import { getFactoryIncidents } from "@/lib/factory/incidents";

export type FactoryRecoveryCandidate = {
  id: string;
  type: "retry_job" | "retry_domain_verify";
  relatedJobId?: string;
  relatedDomain?: string;
  reason: string;
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

export async function getFactoryRecoveryCandidates(
  tenantId: string,
  options?: {
    limit?: number | null;
  },
): Promise<FactoryRecoveryCandidate[]> {
  const limit = normalizeLimit(options?.limit);
  const incidents = await getFactoryIncidents(tenantId, { limit });

  return incidents.items
    .map((incident): FactoryRecoveryCandidate | null => {
      if (incident.kind === "JOB_FAILED" && incident.relatedJobId) {
        return {
          id: `recovery_${incident.id}`,
          type: "retry_job",
          relatedJobId: incident.relatedJobId,
          reason: "Failed provisioning jobs can be retried when the underlying error is transient.",
        };
      }

      if (
        (incident.kind === "DOMAIN_PENDING" || incident.kind === "DOMAIN_FAILED") &&
        incident.relatedDomain
      ) {
        return {
          id: `recovery_${incident.id}`,
          type: "retry_domain_verify",
          relatedDomain: incident.relatedDomain,
          reason: "Domain verification can be retried after DNS or provider conditions improve.",
        };
      }

      return null;
    })
    .filter((candidate): candidate is FactoryRecoveryCandidate => candidate !== null)
    .slice(0, limit);
}
