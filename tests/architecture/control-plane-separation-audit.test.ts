import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  buildSeparationAuditArtifacts,
  collectSeparationAuditSnapshot,
  renderAuditMarkdown,
} from "../../scripts/lib/control-plane-separation-audit";
import { CONTROL_PLANE_CONTRACT_NAMES } from "@shared-neutral/control-plane-contracts";

const repoRoot = process.cwd();

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), "utf8")) as T;
}

describe("Control-plane separation audit", () => {
  it("keeps route/runtime snapshots aligned with the generated audit artifacts", () => {
    const generated = buildSeparationAuditArtifacts(repoRoot);
    const routeSnapshot = readJson<typeof generated.routeInventory>("docs/config/control-plane-route-inventory.json");
    const topologySnapshot = readJson<typeof generated.runtimeTopology>("docs/config/runtime-topology-matrix.json");

    expect(routeSnapshot.generatedAt).toBeTypeOf("string");
    expect(topologySnapshot.generatedAt).toBeTypeOf("string");
    expect({ ...routeSnapshot, generatedAt: "__SNAPSHOT__" }).toEqual({
      ...generated.routeInventory,
      generatedAt: "__SNAPSHOT__",
    });
    expect({ ...topologySnapshot, generatedAt: "__SNAPSHOT__" }).toEqual({
      ...generated.runtimeTopology,
      generatedAt: "__SNAPSHOT__",
    });
    expect(routeSnapshot.entries.some((entry) => entry.kind === "api")).toBe(true);
    expect(routeSnapshot.entries.some((entry) => entry.kind === "ui")).toBe(true);
  });

  it("keeps audit snapshot aligned and publishes neutral contract catalog", () => {
    const generated = collectSeparationAuditSnapshot(repoRoot);
    const snapshot = readJson<typeof generated>("docs/config/control-plane-separation-audit.json");

    expect(snapshot.generatedAt).toBeTypeOf("string");
    expect({ ...snapshot, generatedAt: "__SNAPSHOT__" }).toEqual({
      ...generated,
      generatedAt: "__SNAPSHOT__",
    });
    expect(snapshot.contractsCatalog).toEqual(CONTROL_PLANE_CONTRACT_NAMES);
    expect(snapshot.routeSummary.total).toBeGreaterThan(0);
    expect(snapshot.topologySummary.runtimes).toBeGreaterThan(0);
  });

  it("keeps neutral contracts free from product/control-plane internals and SQL logic", () => {
    const contractsSource = readFileSync(
      path.join(repoRoot, "packages/shared-neutral/src/control-plane-contracts.ts"),
      "utf8",
    );

    expect(contractsSource).not.toContain("@/lib/socialflow/");
    expect(contractsSource).not.toContain("@/lib/mentoria/");
    expect(contractsSource).not.toContain("@/lib/campamento-base/");
    expect(contractsSource).not.toContain("@/lib/factory/");
    expect(contractsSource).not.toMatch(/\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b/);
  });

  it("renders markdown output with separation summary and snapshot paths", () => {
    const markdown = renderAuditMarkdown(buildSeparationAuditArtifacts(repoRoot));

    expect(markdown).toContain("# Control Plane Separation Audit");
    expect(markdown).toContain("Route inventory: docs/config/control-plane-route-inventory.json");
    expect(markdown).toContain("Runtime topology: docs/config/runtime-topology-matrix.json");
  });
});
