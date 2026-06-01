import {
  renderAuditMarkdown,
  writeSeparationAuditArtifacts,
} from "./lib/control-plane-separation-audit";

type OutputMode = "summary" | "json" | "markdown";

function resolveMode(args: string[]): OutputMode {
  if (args.includes("--json")) return "json";
  if (args.includes("--markdown")) return "markdown";
  return "summary";
}

function renderSummary(artifacts: ReturnType<typeof writeSeparationAuditArtifacts>): string {
  const { auditSnapshot } = artifacts;
  const lines = [
    "CONTROL_PLANE_SEPARATION_AUDIT_OK",
    `generatedAt=${auditSnapshot.generatedAt}`,
    `routes.total=${auditSnapshot.routeSummary.total}`,
    `routes.api=${auditSnapshot.routeSummary.byKind.api}`,
    `routes.ui=${auditSnapshot.routeSummary.byKind.ui}`,
    `runtimes.total=${auditSnapshot.topologySummary.runtimes}`,
    `apps.total=${auditSnapshot.topologySummary.apps}`,
    `workers.total=${auditSnapshot.topologySummary.workers}`,
    `bindings.d1=${auditSnapshot.topologySummary.dbBindings}`,
    `bindings.authD1=${auditSnapshot.topologySummary.authDbBindings}`,
    `bindings.queues=${auditSnapshot.topologySummary.queueBindings}`,
    `bindings.services=${auditSnapshot.topologySummary.serviceBindings}`,
    `legacyAliases.total=${auditSnapshot.legacyAliases.total}`,
    `legacyAliases.owner=${auditSnapshot.legacyAliases.owner}`,
    `legacyAliases.campobase=${auditSnapshot.legacyAliases.campobase}`,
    `legacyAliases.needsDeprecation=${auditSnapshot.legacyAliases.needsDeprecation}`,
    `legacyAliases.blockers=${auditSnapshot.legacyAliases.blockers}`,
    `canonicalSurfaces.operator=${auditSnapshot.canonicalSurfaces.operator}`,
    `canonicalSurfaces.campamentoBase=${auditSnapshot.canonicalSurfaces.campamentoBase}`,
    `crossImportSignals=${auditSnapshot.crossImportSignals.length}`,
    `blockers=${auditSnapshot.blockers.length}`,
    `unknownReview=${auditSnapshot.unknownReview.length}`,
    `routeInventory=${auditSnapshot.routeInventoryPath}`,
    `runtimeTopology=${auditSnapshot.runtimeTopologyPath}`,
    "auditSnapshot=docs/config/control-plane-separation-audit.json",
  ];
  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const mode = resolveMode(process.argv.slice(2));
  const artifacts = writeSeparationAuditArtifacts(process.cwd());

  if (mode === "json") {
    console.log(JSON.stringify(artifacts, null, 2));
    return;
  }

  if (mode === "markdown") {
    console.log(renderAuditMarkdown(artifacts));
    return;
  }

  console.log(renderSummary(artifacts));
}

main().catch((error) => {
  console.error("CONTROL_PLANE_SEPARATION_AUDIT_ERROR", error);
  process.exit(1);
});
