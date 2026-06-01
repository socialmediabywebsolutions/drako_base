import {
  collectSeparationAuditSnapshot,
  writeSeparationAuditArtifacts,
} from "./lib/control-plane-separation-audit";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const result = write
    ? writeSeparationAuditArtifacts(process.cwd())
    : {
        routeInventory: undefined,
        runtimeMatrix: undefined,
        auditSnapshot: collectSeparationAuditSnapshot(process.cwd()),
      };

  console.log(JSON.stringify(result.auditSnapshot, null, 2));
}

main().catch((error) => {
  console.error("CONTROL_PLANE_SEPARATION_AUDIT_ERROR", error);
  process.exit(1);
});
