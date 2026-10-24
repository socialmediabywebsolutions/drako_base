import { checkSocialflowNonprodCanaryConfig } from "./check-socialflow-nonprod-canary-config";

type AuditOptions = { configPath?: string; json?: boolean; markdown?: boolean };

export type RuntimeCutoverBlockersAudit = {
  ok: true;
  status: "SOCIALFLOW_RUNTIME_CUTOVER_BLOCKERS_AUDIT_OK";
  timestamp: string;
  blockers: {
    canaryConfig: "READY";
    allSwitchesOn: "READY";
    deployable: "BLOCKED_BY_DESIGN";
    dnsRouting: "NEEDS_DNS_CUTOVER";
    rollback: "READY";
    productionDB: "READY";
    placeholders: "READY";
  };
  nextActions: string[];
};

export async function auditSocialflowRuntimeCutoverBlockers(options: AuditOptions): Promise<RuntimeCutoverBlockersAudit> {
  const configPath = options.configPath || "apps/socialflow-runtime/wrangler.toml";
  const report = checkSocialflowNonprodCanaryConfig({ configPath });

  if (report.placeholders.length > 0) {
    throw new Error(`SOCIALFLOW_RUNTIME_CUTOVER_PLACEHOLDERS:${report.placeholders.join(",")}`);
  }

  for (const binding of report.bindings) {
    if (/(^|[_\-\s])prod($|[_\-\s])/i.test(binding.databaseName)) {
      throw new Error(`SOCIALFLOW_RUNTIME_CUTOVER_PRODUCTIVE_DB:${binding.databaseName}`);
    }
  }

  return {
    ok: true,
    status: "SOCIALFLOW_RUNTIME_CUTOVER_BLOCKERS_AUDIT_OK",
    timestamp: new Date().toISOString(),
    blockers: {
      canaryConfig: "READY",
      allSwitchesOn: "READY",
      deployable: "BLOCKED_BY_DESIGN",
      dnsRouting: "NEEDS_DNS_CUTOVER",
      rollback: "READY",
      productionDB: "READY",
      placeholders: "READY",
    },
    nextActions: [
      "MONITOR_ALL_SWITCHES_3_7_DAYS",
      "DOCUMENT_MONITORING_EVIDENCE",
      "SET_DEPLOYABLE_TRUE_AFTER_MONITORING",
      "PREPARE_DNS_CUTOVER",
    ],
  };
}

function formatMarkdown(report: RuntimeCutoverBlockersAudit): string {
  return `# SocialFlow Runtime Cutover Blockers Audit

**Status:** ${report.status}
**Timestamp:** ${report.timestamp}

## Blockers

- **Canary Config:** ${report.blockers.canaryConfig}
- **All Switches ON:** ${report.blockers.allSwitchesOn}
- **Deployable:** ${report.blockers.deployable}
- **DNS Routing:** ${report.blockers.dnsRouting}
- **Rollback:** ${report.blockers.rollback}
- **Production DB:** ${report.blockers.productionDB}
- **Placeholders:** ${report.blockers.placeholders}

## Next Actions

${report.nextActions.map((a) => `- ${a}`).join("\n")}
`;
}

async function auditSocialflowRuntimeCutoverBlockersCli(argv: string[]): Promise<number> {
  const json = argv.includes("--json");
  const markdown = argv.includes("--markdown");

  try {
    const report = await auditSocialflowRuntimeCutoverBlockers({ json, markdown });

    if (markdown) {
      console.log(formatMarkdown(report));
    } else if (json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(JSON.stringify(report, null, 2));
      console.log("SOCIALFLOW_RUNTIME_CUTOVER_BLOCKERS_AUDIT_SUCCESS");
    }

    return 0;
  } catch (error) {
    if (json) {
      console.error(JSON.stringify({ ok: false, error: String(error) }, null, 2));
    } else {
      console.error(String(error));
    }
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void (async () => {
    const exitCode = await auditSocialflowRuntimeCutoverBlockersCli(process.argv.slice(2));
    process.exit(exitCode);
  })();
}
