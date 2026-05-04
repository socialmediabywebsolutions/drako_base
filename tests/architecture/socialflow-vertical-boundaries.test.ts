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

describe("SocialFlow vertical boundaries", () => {
  it("keeps social-core neutral from product imports", () => {
    const files = listFiles(path.join(repoRoot, "src/lib/social-core"));
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/@\/lib\/socialflow/);
      expect(source).not.toMatch(/@\/lib\/mentoria/);
      expect(source).not.toMatch(/@\/lib\/campobase|@\/lib\/campamento-base/);
      expect(source).not.toMatch(/src\/app|\/api\/socialflow/);
    }
  });

  it("keeps Campamento Base away from SocialFlow product internals", () => {
    const files = [
      ...listFiles(path.join(repoRoot, "src/lib/campobase")),
      ...listFiles(path.join(repoRoot, "src/app/api/campobase")),
      ...listFiles(path.join(repoRoot, "src/app/api/campamento-base")),
      ...listFiles(path.join(repoRoot, "src/app/api/operator")),
      ...listFiles(path.join(repoRoot, "src/app/operator")),
    ];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/@\/lib\/social\/(ai|repository|live-publishing|scheduler|linkedin-service)/);
      expect(source).not.toMatch(/@\/lib\/socialflow\/(ai|repository|live-publishing|scheduler|profile|auth)\//);
    }
  });

  it("keeps socialflow linkedin boundary free from Mentoría and Campamento Base internals", () => {
    const files = listFiles(path.join(repoRoot, "src/lib/socialflow/linkedin"));
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/@\/lib\/mentoria/);
      expect(source).not.toMatch(/@\/lib\/campobase|@\/lib\/campamento-base/);
    }
  });

  it("keeps publishing reliability native to SocialFlow and legacy social as facades", () => {
    const socialFlowRepository = read("src/lib/socialflow/repository.ts");
    const socialFlowPublishing = read("src/lib/socialflow/live-publishing.ts");
    const socialFlowScheduler = read("src/lib/socialflow/scheduler.ts");

    expect(socialFlowRepository).toContain("claimScheduledPostForPublishing");
    expect(socialFlowRepository).toContain("recoverStalePublishingPosts");
    expect(socialFlowPublishing).toContain("export async function publishSocialPostLive");
    expect(socialFlowPublishing).toContain("@/lib/socialflow/linkedin/publishing");
    expect(socialFlowScheduler).toContain("export async function processScheduledPosts");
    expect(socialFlowScheduler).toContain("recoverStalePublishingPosts");

    const legacyRepository = read("src/lib/social/repository.ts");
    const legacyPublishing = read("src/lib/social/live-publishing.ts");
    const legacyScheduler = read("src/lib/social/scheduler.ts");

    for (const source of [legacyRepository, legacyPublishing, legacyScheduler]) {
      expect(source).toContain("@deprecated");
      expect(source).toMatch(/export \* from "@\/lib\/socialflow\//);
      expect(source).not.toMatch(/runStatement|recordObservabilityActivity|processScheduledPosts\(/);
      expect(source).not.toMatch(/claimScheduledPostForPublishing\(|recoverStalePublishingPosts\(/);
    }
  });

  it("keeps analytics window and profile repository canonical in SocialFlow", () => {
    const socialFlowAnalyticsWindow = read("src/lib/socialflow/analytics-window.ts");
    const socialFlowProfileRepository = read("src/lib/socialflow/profile/repository.ts");
    const socialFlowProfileTypes = read("src/lib/socialflow/profile/types.ts");

    expect(socialFlowAnalyticsWindow).toContain("getPostAnalyticsMetadata");
    expect(socialFlowAnalyticsWindow).not.toMatch(/@\/lib\/social\/analytics-window/);

    expect(socialFlowProfileRepository).toContain("getChannelKnowledge");
    expect(socialFlowProfileRepository).toContain("upsertChannelProfile");
    expect(socialFlowProfileRepository).not.toMatch(/@\/lib\/social\/profile\/repository/);

    expect(socialFlowProfileTypes).toContain("export type ChannelProfile");
    expect(socialFlowProfileTypes).not.toMatch(/@\/lib\/social\/profile\/types/);

    const legacyAnalyticsWindow = read("src/lib/social/analytics-window.ts");
    const legacyProfileRepository = read("src/lib/social/profile/repository.ts");
    const legacyProfileTypes = read("src/lib/social/profile/types.ts");

    for (const source of [legacyAnalyticsWindow, legacyProfileRepository, legacyProfileTypes]) {
      expect(source).toContain("@deprecated");
      expect(source).toMatch(/export \* from "@\/lib\/socialflow\//);
    }
  });

  it("exposes SocialFlow observability through an operator contract", () => {
    const contract = read("src/lib/socialflow/contracts/observability.ts");
    const operatorActions = read("src/lib/socialflow/contracts/operator-actions.ts");
    const campobaseService = read("src/lib/campobase/socialflow-service.ts");

    expect(contract).toContain("getSocialFlowOperatorObservability");
    expect(contract).toContain("@/lib/socialflow/repository");
    expect(contract).toContain("@/lib/observability-core");
    expect(contract).not.toMatch(/@\/lib\/socialflow\/(live-publishing|scheduler|linkedin\/publishing)/);

    expect(operatorActions).toContain("runSocialFlowOperatorAction");
    expect(operatorActions).toContain("@/lib/socialflow/repository");
    expect(operatorActions).toContain("@/lib/observability-core");
    expect(operatorActions).not.toMatch(/@\/lib\/socialflow\/(live-publishing|scheduler|linkedin\/publishing)/);

    expect(campobaseService).toContain("@/lib/socialflow/contracts/observability");
    expect(campobaseService).toContain("@/lib/socialflow/contracts/operator-actions");
    expect(campobaseService).not.toMatch(/@\/lib\/socialflow\/(repository|live-publishing|scheduler|linkedin\/publishing)/);
  });

  it("keeps socialflow export independent from Campamento Base internals", () => {
    const socialFlowExport = read("src/lib/socialflow/export.ts");
    const neutralWipeout = read("src/lib/export/wipeout-package.ts");
    const campamentoBaseWipeout = read("src/lib/campamento-base/export-engine/wipeout.ts");

    expect(socialFlowExport).toContain("generateSocialFlowExportForTenant");
    expect(socialFlowExport).toContain("@/lib/export/wipeout-package");
    expect(socialFlowExport).not.toMatch(/@\/lib\/campamento-base\/export-engine\/wipeout/);

    expect(neutralWipeout).toContain("export async function generateWipeoutPackage");
    expect(neutralWipeout).not.toMatch(/@\/lib\/campamento-base/);

    expect(campamentoBaseWipeout).toContain('export { generateWipeoutPackage } from "@/lib/export/wipeout-package"');
  });

  it("keeps dangerous legacy social routes disabled", () => {
    const legacyPosts = read("src/app/api/social/posts/route.ts");
    const legacyLinkedInPublish = read("src/app/api/social/linkedin/publish/route.ts");

    for (const source of [legacyPosts, legacyLinkedInPublish]) {
      expect(source).toContain("LEGACY_SOCIAL_ROUTE_DISABLED");
      expect(source).toContain("status: 410");
      expect(source).not.toMatch(/publishSocialPostLive|publishLinkedInMemberPost|accessToken/);
    }
  });

  it("keeps legacy linkedin connect and callback routes as redirect-only bridges", () => {
    const legacyConnect = read("src/app/api/social/linkedin/connect/route.ts");
    const legacyCallback = read("src/app/api/social/linkedin/callback/route.ts");

    expect(legacyConnect).toContain("/api/socialflow/linkedin/connect");
    expect(legacyConnect).toContain("308");
    expect(legacyConnect).not.toMatch(/requireTenantAccess|exchangeLinkedInCodeForAccessToken|fetchLinkedInUserProfile|persistLinkedInConnection/);

    expect(legacyCallback).toContain("/api/socialflow/linkedin/callback");
    expect(legacyCallback).toContain("308");
    expect(legacyCallback).not.toMatch(/exchangeLinkedInCodeForAccessToken|fetchLinkedInUserProfile|persistLinkedInConnection/);
  });
});
