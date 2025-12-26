import { normalizeHostnameInput } from "@/lib/empire/domain-utils";
import { resolveHostToSaas } from "@/lib/empire/host-resolver";

export type DomainVerificationStage = "dns_pending" | "ssl_pending" | "routing_check" | "verified" | "failed";

export type DomainVerificationResult = {
  nextStatus: "active" | "pending" | "paused";
  verificationStage: DomainVerificationStage;
  reason?: string;
  metrics: {
    normalizedHost: string;
    wasWww: boolean;
    isCanonical: boolean;
  };
};

const CANONICAL_SUFFIX = ".apps.drako.systems";

export async function verifyDomainMapping(params: {
  hostname: string;
  tenantId: string;
  saasId: string;
  saasSlug?: string | null;
  currentStatus: string;
  isPaused?: boolean;
}): Promise<DomainVerificationResult> {
  const normalized = normalizeHostnameInput(params.hostname);
  const normalizedHost = normalized.hostname ?? "";
  if (!normalized.hostname) {
    return {
      nextStatus: "pending",
      verificationStage: "failed",
      reason: normalized.reason ?? "INVALID_HOST",
      metrics: { normalizedHost, wasWww: normalized.wasWww, isCanonical: false },
    };
  }

  const isCanonical = normalizedHost.endsWith(CANONICAL_SUFFIX);
  const canonicalSlug = isCanonical ? normalizedHost.slice(0, -CANONICAL_SUFFIX.length) : null;

  if (params.currentStatus.toUpperCase() === "PAUSED" || params.isPaused) {
    return {
      nextStatus: "paused",
      verificationStage: "routing_check",
      reason: "DOMAIN_PAUSED",
      metrics: { normalizedHost, wasWww: normalized.wasWww, isCanonical },
    };
  }

  if (isCanonical) {
    if (!params.saasSlug || canonicalSlug !== params.saasSlug) {
      return {
        nextStatus: "pending",
        verificationStage: "routing_check",
        reason: "CANONICAL_SLUG_MISMATCH",
        metrics: { normalizedHost, wasWww: normalized.wasWww, isCanonical },
      };
    }
    const resolution = await resolveHostToSaas(normalizedHost);
    if (resolution.saasId === params.saasId && resolution.tenantId === params.tenantId) {
      return {
        nextStatus: "active",
        verificationStage: "verified",
        reason: "CANONICAL_RESOLVED",
        metrics: { normalizedHost, wasWww: normalized.wasWww, isCanonical },
      };
    }
    return {
      nextStatus: "pending",
      verificationStage: "routing_check",
      reason: resolution.reason ?? "CANONICAL_NOT_RESOLVED",
      metrics: { normalizedHost, wasWww: normalized.wasWww, isCanonical },
    };
  }

  return {
    nextStatus: "pending",
    verificationStage: "dns_pending",
    reason: "CUSTOM_DOMAIN_DEFERRED",
    metrics: { normalizedHost, wasWww: normalized.wasWww, isCanonical },
  };
}
