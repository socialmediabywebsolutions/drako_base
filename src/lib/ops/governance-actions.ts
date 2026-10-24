import type { GovernanceRow } from "./operator-governance-view";

export type GovernanceActionKind = "navigation" | "inspection" | "safe_trigger" | "handoff";

export type GovernanceAction = {
  id: string;
  label: string;
  kind: GovernanceActionKind;
  enabled: boolean;
  reasonIfDisabled?: string;
  confirmationRequired?: boolean;
  dangerLevel?: "low" | "medium" | "high";
  href?: string;
  telemetry?: string;
};

export function buildDiagnosticSummary(row: GovernanceRow): string {
  const parts = [
    `SaaS: ${row.saasSlug}`,
    row.saasName ? `Name: ${row.saasName}` : null,
    `Overall: ${row.overallGovernanceStatus}`,
    `Severity: ${row.severity}`,
    row.topIssue ? `Top issue: ${row.topIssue}` : null,
    row.blockers.length ? `Blockers: ${row.blockers.join("; ")}` : null,
    row.warnings.length ? `Warnings: ${row.warnings.join("; ")}` : null,
    row.recommendations.length ? `Recommendation: ${row.recommendations[0]}` : null,
  ].filter(Boolean);
  return parts.join(" | ");
}

export function deriveGovernanceActions(row: GovernanceRow): GovernanceAction[] {
  const actions: GovernanceAction[] = [];

  // Navigation / context (always safe)
  actions.push({
    id: "openSaasContext",
    label: "Open SaaS context",
    kind: "navigation",
    enabled: true,
    href: `/owner/projects/${row.saasSlug}`,
  });

  actions.push({
    id: "openBillingContext",
    label: "Open billing context",
    kind: "navigation",
    enabled: true,
    href: `/owner/billing?saas=${row.saasSlug}`,
  });

  actions.push({
    id: "openProvisioningContext",
    label: "Open provisioning context",
    kind: "navigation",
    enabled: true,
    href: `/owner/factory/jobs?saas=${row.saasSlug}`,
  });

  actions.push({
    id: "openDomainContext",
    label: "Open domain context",
    kind: "navigation",
    enabled: Boolean(row.domainId),
    reasonIfDisabled: row.domainId ? undefined : "No domain linked",
    href: row.domainId ? `/owner/domains/${row.domainId}` : undefined,
  });

  // Inspection / export
  actions.push({
    id: "copyDiagnosticSummary",
    label: "Copy diagnostic summary",
    kind: "inspection",
    enabled: true,
    telemetry: "gov_copy_summary",
  });

  actions.push({
    id: "exportRowDetails",
    label: "Export row JSON",
    kind: "inspection",
    enabled: true,
    telemetry: "gov_export_row",
  });

  // Safe triggers (view-only compatible; guarded by eligibility)
  const canRecheckDomain = row.domainStatus === "verifying" || row.domainStatus === "failed" || row.domainStatus === "locked";
  actions.push({
    id: "retryDomainVerification",
    label: "Re-check domain verification",
    kind: "safe_trigger",
    enabled: Boolean(row.domainId) && canRecheckDomain,
    reasonIfDisabled: !row.domainId ? "No domain linked" : canRecheckDomain ? undefined : "Domain not pending verification",
    confirmationRequired: true,
    dangerLevel: "low",
    telemetry: "gov_recheck_domain",
  });

  const provisioningAtRisk = row.provisioningStatus === "DEGRADED" || row.provisioningStatus === "FAILED";
  actions.push({
    id: "recheckProvisioningHealth",
    label: "Re-check provisioning health",
    kind: "safe_trigger",
    enabled: provisioningAtRisk,
    reasonIfDisabled: provisioningAtRisk ? undefined : "Provisioning not degraded/failed",
    confirmationRequired: true,
    dangerLevel: "medium",
    telemetry: "gov_recheck_provisioning",
  });

  // Handoff / escalation
  const needsEscalation = row.overallGovernanceStatus === "BLOCKED" || row.blockers.length > 0;
  actions.push({
    id: "escalateManualReview",
    label: "Escalate to manual review",
    kind: "handoff",
    enabled: needsEscalation,
    reasonIfDisabled: needsEscalation ? undefined : "No blockers detected",
    telemetry: "gov_escalate",
  });

  return actions;
}
