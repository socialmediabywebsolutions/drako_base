export type HostResolutionStatus = "ACTIVE" | "PENDING" | "PAUSED" | "NOT_FOUND";

export type DomainResolution = {
  status: HostResolutionStatus;
  reason?: string;
  severity?: "INFO" | "WARNING" | "ERROR";
};

export type DomainStatusInput = {
  status: string;
  verification_status: string | null;
};

export function mapDomainStatus(row: DomainStatusInput): DomainResolution {
  const normalizedStatus = row.status?.trim().toLowerCase() ?? "";
  const verification = row.verification_status?.trim().toLowerCase() ?? "";

  if (normalizedStatus === "paused") {
    return { status: "PAUSED", reason: "DOMAIN_PAUSED", severity: "WARNING" };
  }

  if (verification === "verified" && normalizedStatus !== "active") {
    return { status: "PENDING", reason: "DOMAIN_PENDING_ACTIVATION", severity: "WARNING" };
  }

  if (normalizedStatus === "active") {
    if (verification === "verified" || verification === "active") {
      return { status: "ACTIVE", severity: "INFO" };
    }
    return { status: "PENDING", reason: "DOMAIN_PENDING_ACTIVATION", severity: "WARNING" };
  }

  return { status: "PENDING", reason: "DOMAIN_NOT_ACTIVE", severity: "WARNING" };
}
