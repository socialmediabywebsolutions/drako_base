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

export type ProjectDomainVerificationInput = {
  hostname: string;
  tenantId: string;
  projectId: string;
  currentStatus: string;
  verificationToken?: string | null;
  providedToken?: string | null;
};

export type ProjectDomainVerificationResult =
  | { status: "verified"; error?: undefined }
  | { status: "pending" | "failed"; error?: string };

export async function verifyProjectDomain(params: ProjectDomainVerificationInput): Promise<ProjectDomainVerificationResult> {
  const { hostname, tenantId, projectId, currentStatus, verificationToken, providedToken } = params;
  if (!hostname.trim()) {
    return { status: "failed", error: "DOMAIN_INVALID" };
  }

  if (verificationToken && providedToken && verificationToken.trim() !== providedToken.trim()) {
    return { status: "pending", error: "TOKEN_MISMATCH" };
  }

  const result = await verifyDomainMapping({
    hostname,
    tenantId,
    saasId: projectId,
    saasSlug: null,
    currentStatus,
    isPaused: currentStatus.trim().toUpperCase() === "PAUSED",
  });

  if (result.nextStatus === "active" && result.verificationStage === "verified") {
    return { status: "verified" };
  }

  const reason = result.reason ?? (result.verificationStage === "failed" ? "VERIFY_FAILED" : "UNVERIFIED");
  const status = result.verificationStage === "failed" ? "failed" : "pending";
  return { status, error: reason };
}
