import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) return listFiles(fullPath);
    return /\.(ts|tsx)$/.test(entry) ? [fullPath] : [];
  });
}

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Legacy compat sunset guards", () => {
  it("keeps owner and campobase API compat inventory stable and control-plane-only", () => {
    const files = [
      ...listFiles(path.join(repoRoot, "src/app/api/owner")),
      ...listFiles(path.join(repoRoot, "src/app/api/campobase")),
    ];

    expect(files.length).toBe(50);

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source).toMatch(/export\s+\{[^}]+\}\s+from\s+"@\/app\/api\/(operator|factory)\//);
      expect(source).not.toMatch(/@\/app\/api\/mentoria|@\/app\/api\/socialflow/);
      expect(source).not.toMatch(/\/api\/mentoria\/|\/api\/socialflow\//);
    }
  });

  it("keeps owner and campobase UI compat surfaces pinned to operator-only redirects or operator APIs", () => {
    const ownerPage = read("src/app/owner/page.tsx");
    const ownerCatalogPage = read("src/app/owner/catalog/page.tsx");
    const ownerDomainsPage = read("src/app/owner/domains/page.tsx");
    const ownerProjectsPage = read("src/app/owner/projects/page.tsx");
    const ownerProjectCreatePage = read("src/app/owner/projects/create/page.tsx");
    const ownerProjectDetailsPage = read("src/app/owner/projects/[id]/page.tsx");
    const campobaseSocialflowPage = read("src/app/campobase/socialflow/page.tsx");
    const campobasePlatformPage = read("src/app/campobase/platform/page.tsx");
    const ownerTaskBoard = read("src/app/owner/OwnerTasksBoard.tsx");
    const ownerMarketing = read("src/app/owner/OwnerMarketingSection.tsx");
    const ownerVendor = read("src/app/owner/OwnerVendorSection.tsx");
    const ownerPricing = read("src/app/owner/OwnerPricingSection.tsx");
    const ownerLeftPanel = read("src/app/owner/components/CampamentoLeftPanel.tsx");

    expect(ownerPage).toContain('redirect("/operator")');
    expect(ownerCatalogPage).toContain('redirect("/operator/catalog")');
    expect(ownerDomainsPage).toContain('redirect("/operator/domains")');
    expect(ownerProjectsPage).toContain('redirect("/operator/projects")');
    expect(ownerProjectCreatePage).toContain('redirect("/operator/projects/create")');
    expect(ownerProjectDetailsPage).toContain("/operator/projects/");
    expect(campobaseSocialflowPage).toContain('redirect("/operator/socialflow")');
    expect(campobasePlatformPage).toContain("/operator/platform");

    for (const source of [ownerTaskBoard, ownerMarketing, ownerVendor, ownerPricing, ownerLeftPanel]) {
      expect(source).toContain("/api/operator/");
      expect(source).not.toMatch(/\/api\/owner\/|\/api\/campobase\/|\/api\/mentoria\/|\/api\/socialflow\//);
    }
  });

  it("keeps middleware adding sunset telemetry and headers for legacy compat hits", () => {
    const middleware = read("src/middleware.ts");

    expect(middleware).toContain("X-Drako-Legacy-Compat");
    expect(middleware).toContain("X-Drako-Sunset");
    expect(middleware).toContain("X-Drako-Control-Plane-Only");
    expect(middleware).toContain("X-Drako-Compat-Canonical");
    expect(middleware).toContain("legacy.compat.route.hit");
    expect(middleware).toContain("LEGACY_COMPAT_ROUTE_HIT");
    expect(middleware).toContain("resolveLegacyCompatUsage");
  });
});
