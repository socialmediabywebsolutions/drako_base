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

    // La librería legacy src/lib/social se eliminó en la P2 de SocialCors; no debe reaparecer.
    expect(existsSync(path.join(repoRoot, "src/lib/social"))).toBe(false);
  });

  it("keeps profile repository canonical in SocialFlow", () => {
    const socialFlowProfileRepository = read("src/lib/socialflow/profile/repository.ts");
    const socialFlowProfileTypes = read("src/lib/socialflow/profile/types.ts");

    expect(socialFlowProfileRepository).toContain("getChannelKnowledge");
    expect(socialFlowProfileRepository).toContain("upsertChannelProfile");
    expect(socialFlowProfileRepository).not.toMatch(/@\/lib\/social\/profile\/repository/);

    expect(socialFlowProfileTypes).toContain("export type ChannelProfile");
    expect(socialFlowProfileTypes).not.toMatch(/@\/lib\/social\/profile\/types/);
  });

  it("exposes SocialFlow observability through an operator contract", () => {
    const contract = read("src/lib/socialflow/contracts/observability.ts");
    // Canonical service migrated to campamento-base; adapter re-exports
    const adapterService = read("src/lib/campobase/socialflow-service.ts");
    const canonicalService = read("src/lib/campamento-base/socialflow-control-plane-service.ts");

    expect(contract).toContain("getSocialFlowOperatorObservability");
    expect(contract).toContain("@/lib/socialflow/repository");
    expect(contract).toContain("@/lib/observability-core");
    expect(contract).not.toMatch(/@\/lib\/socialflow\/(live-publishing|scheduler|linkedin\/publishing)/);

    expect(adapterService).toContain("@/lib/campamento-base/socialflow-control-plane-service");
    expect(canonicalService).toContain("@/lib/capabilities/internal-api-clients/socialflow-control-plane");
    expect(canonicalService).not.toMatch(/@\/lib\/socialflow\/(repository|live-publishing|scheduler|linkedin\/publishing)/);
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
    const legacyPosts = read("apps/socialcors/src/app/api/social/posts/route.ts");
    const legacyLinkedInPublish = read("apps/socialcors/src/app/api/social/linkedin/publish/route.ts");

    for (const source of [legacyPosts, legacyLinkedInPublish]) {
      expect(source).toContain("LEGACY_SOCIAL_ROUTE_DISABLED");
      expect(source).toContain("status: 410");
      expect(source).not.toMatch(/publishSocialPostLive|publishLinkedInMemberPost|accessToken/);
    }
  });

  it("keeps the isolated SocialFlow app routes detached from cross-product modules", () => {
    const socialFlowLayout = read("apps/socialcors/src/app/socialflow/(workspace)/layout.tsx");
    const billingPage = read("apps/socialcors/src/app/socialflow/(workspace)/settings/billing/page.tsx");
    const sessionsPage = read("apps/socialcors/src/app/socialflow/(workspace)/sessions/page.tsx");
    const analysisPage = read("apps/socialcors/src/app/socialflow/(workspace)/analysis/page.tsx");
    const planPage = read("apps/socialcors/src/app/socialflow/(workspace)/plan/page.tsx");
    const setupPage = read("apps/socialcors/src/app/socialflow/(workspace)/setup/page.tsx");

    expect(socialFlowLayout).not.toMatch(/@\/modules\/socialflow-app\/layout|DRACO_DB|tenant_strategic_dossiers/);
    expect(billingPage).not.toMatch(/@\/modules\/socialflow-app\/settings\/billing-page|@\/lib\/auth\/campamento-core/);
    expect(sessionsPage).not.toMatch(/@\/modules\/socialflow-app\/pages\/sessions-page|@\/components\/mentoria|\/api\/mentoria\//);
    expect(analysisPage).not.toMatch(/@\/modules\/socialflow-app\/pages\/analysis-page/);
    expect(planPage).not.toMatch(/@\/modules\/socialflow-app\/pages\/plan-page/);
    expect(setupPage).not.toMatch(/@\/modules\/socialflow-app\/pages\/setup-page/);
  });

  it("keeps legacy SocialFlow modules detached from Mentoría, Campamento Base and operator surfaces", () => {
    const files = [
      path.join(repoRoot, "src/components/layouts/socialflow-shell.tsx"),
    ];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/@\/components\/mentoria/);
      expect(source).not.toMatch(/@\/lib\/mentoria/);
      expect(source).not.toMatch(/\/api\/mentoria\//);
      expect(source).not.toMatch(/@\/lib\/campobase|@\/lib\/campamento-base/);
      expect(source).not.toMatch(/@\/lib\/auth\/campamento-core/);
      expect(source).not.toMatch(/@\/components\/operator|@\/components\/owner/);
      expect(source).not.toMatch(/\/api\/operator\/|\/api\/owner\/|\/api\/campobase\/|\/api\/campamento-base\//);
    }
  });

  it("keeps owner and campobase compatibility routes pinned to operator-only reexports", () => {
    const compatFiles = [
      ...listFiles(path.join(repoRoot, "src/app/api/owner")),
      ...listFiles(path.join(repoRoot, "src/app/api/campobase")),
    ];

    expect(compatFiles.length).toBeGreaterThan(0);

    for (const file of compatFiles) {
      const source = readFileSync(file, "utf8");
      expect(source).toMatch(/export\s+\{[^}]+\}\s+from\s+"@\/app\/api\/(operator|factory)\//);
      expect(source).not.toMatch(/@\/app\/api\/mentoria|@\/app\/api\/socialflow/);
      expect(source).not.toMatch(/\/api\/mentoria\/|\/api\/socialflow\//);
    }
  });

  it("keeps operator UI reading Mentoria health through operator contracts only", () => {
    const operatorPage = read("src/app/operator/page.tsx");

    expect(operatorPage).toContain("/api/operator/mentoria/health/system");
    expect(operatorPage).not.toContain("/api/mentoria/health/system");
  });

  it("keeps the SocialFlow runtime and smoke checks fail-closed", () => {
    const socialFlowWorkerConfig = read("workers/socialflows/wrangler.workers.toml");
    const socialFlowMiswireWorker = read("workers/socialflows/src/workers.ts");
    const sharedWorkersHandlers = read("packages/shared/workers-handlers/index.ts");
    const socialFlowSmoke = read("scripts/smoke/socialflow-canonical-domain-smoke.mjs");
    const artifactBuilder = read("scripts/build-artifact-matrix-skeleton.mjs");
    const deployWorkflow = read(".github/workflows/drako-factory-deploy.yml");

    expect(socialFlowWorkerConfig).toContain('main = "../../.open-next/socialflows-standalone/worker.js"');
    expect(socialFlowWorkerConfig).toContain('directory = "../../.open-next/socialflows-standalone/assets"');
    expect(socialFlowWorkerConfig).not.toContain('main = "../../.open-next/socialflows/worker.js"');
    expect(socialFlowWorkerConfig).not.toContain('main = "src/workers.ts"');

    expect(socialFlowMiswireWorker).toContain("SOCIALFLOW_RUNTIME_MISWIRED");
    expect(socialFlowMiswireWorker).toContain("status: 500");
    expect(socialFlowMiswireWorker).not.toContain("success: true");
    expect(socialFlowMiswireWorker).not.toContain("text/html");

    expect(sharedWorkersHandlers).not.toMatch(/case\s+"socialflow"/);
    expect(sharedWorkersHandlers).not.toMatch(/case\s+"socialflows"/);

    expect(socialFlowSmoke).toContain('path: "/api/socialflow/profile"');
    expect(socialFlowSmoke).toContain('path: "/api/socialflow/campaigns?saasId=socialflow"');
    expect(socialFlowSmoke).toContain('path: "/api/socialflow/posts?saasId=socialflow"');
    expect(socialFlowSmoke).toContain('path: "/api/social/posts"');
    expect(socialFlowSmoke).toContain('expectedStatuses: [410]');
    expect(socialFlowSmoke).not.toContain("405");
    expect(socialFlowSmoke).toContain("placeholder token detected");

    expect(artifactBuilder).toContain("artifact-manifest.json");
    expect(artifactBuilder).toContain("standalone-runtime");
    expect(artifactBuilder).toContain("emitStandaloneArtifact");
    expect(artifactBuilder).toContain("copyOpenNextRuntimeSubset");
    expect(artifactBuilder).toContain("sourceRuntime");
    expect(artifactBuilder).toContain("buildServerFunctionsScopeAudit");
    expect(artifactBuilder).toContain("scope-audit.json");
    expect(artifactBuilder).toContain("foreignRouteHits");
    expect(artifactBuilder).toContain("standalone-runtime-copy");
    expect(artifactBuilder).toContain("emitSocialflowProductScopedPreviewArtifact");
    expect(artifactBuilder).toContain("filter-report.json");
    expect(artifactBuilder).toContain("runtime-audit.json");
    expect(artifactBuilder).toContain("buildSocialflowProductScopedRuntimeAudit");
    expect(artifactBuilder).toContain("runtimeRiskScore");
    expect(artifactBuilder).toContain("scopedActivationReady");
    expect(artifactBuilder).toContain("CROSS_PRODUCT_LEAK");
    expect(artifactBuilder).toContain("SUSPICIOUS_SHARED_SURFACE");
    expect(artifactBuilder).toContain("tenantIsolationVerificationVersion");
    expect(artifactBuilder).toContain("VERIFIED_TENANT_ISOLATED");
    expect(artifactBuilder).toContain("PARTIALLY_ISOLATED");
    expect(artifactBuilder).toContain("UNVERIFIED");
    expect(artifactBuilder).toContain("UNSAFE");
    expect(artifactBuilder).toContain("product-scoped-preview");
    expect(artifactBuilder).toContain("validateProductScopedPreviewRuntime");

    // P3b: SocialCors se despliega desde apps/socialcors con su propio lane fail-closed.
    expect(deployWorkflow).toContain("SocialCors bundle budget and route scope");
    expect(deployWorkflow).toContain("SOCIALCORS_HANDLER_MISSING");
    expect(deployWorkflow).toContain("SOCIALCORS_BUNDLE_OVER_BUDGET");
    expect(deployWorkflow).toContain("FOREIGN_ROUTES_IN_SOCIALCORS");
    expect(deployWorkflow).toContain("SOCIALCORS_ROUTE_MISSING");
    expect(deployWorkflow).toContain("SOCIALCORS_SCHEDULED_HANDLER_MISSING");
    expect(deployWorkflow).toContain("Guard SocialCors Worker config before deploy");
    expect(deployWorkflow).toContain("HOLDING_BUNDLE_OVER_CLOUDFLARE_LIMIT");
    expect(deployWorkflow).toContain("SOCIALCORS_ROUTES_IN_HOLDING");
  });

  it("keeps shared-db SocialFlow routes guarded by tenant isolation evidence", () => {
    const rootLayout = read("src/app/layout.tsx");
    const mentoriaLayout = read("src/app/mentoria/layout.tsx");
    const middleware = read("src/middleware.ts");
    const tenantIsolation = read("src/lib/socialflow/auth/tenant-isolation.ts");
    const authServer = read("src/lib/socialflow/auth/server.ts");
    const authRequest = read("src/lib/socialflow/auth/request.ts");
    const authRepositories = read("src/lib/socialflow/platform/auth/repository.ts");
    const exportRoute = read("apps/socialcors/src/app/api/socialflow/exports/current/route.ts");
    const exportService = read("src/lib/socialflow/export.ts");
    const wipeout = read("src/lib/export/wipeout-package.ts");
    const workspaceLayout = read("apps/socialcors/src/app/socialflow/(workspace)/layout.tsx");
    const billingPage = read("apps/socialcors/src/app/socialflow/(workspace)/settings/billing/page.tsx");
    const billingCheckoutRoute = read("apps/socialcors/src/app/api/socialflow/billing/checkout/route.ts");
    const billingPortalRoute = read("apps/socialcors/src/app/api/socialflow/billing/portal/route.ts");
    const accountPage = read("apps/socialcors/src/app/socialflow/(workspace)/settings/account/page.tsx");
    const socialFlowAccountSettings = read("src/components/socialflow/settings/socialflow-account-settings.tsx");
    const ownershipPage = read("apps/socialcors/src/app/socialflow/(workspace)/settings/ownership/page.tsx");
    const teamPage = read("apps/socialcors/src/app/socialflow/(workspace)/settings/team/page.tsx");

    expect(rootLayout).not.toContain("ShellLayout");
    expect(rootLayout).not.toContain("HostSwitcher");
    expect(rootLayout).not.toContain("NextAuthProviders");
    expect(rootLayout).not.toContain("initializeMentoriaWorkers");
    expect(mentoriaLayout).toContain("initializeMentoriaWorkers()");

    expect(middleware).toContain("CROSS_TENANT_ACCESS_FORBIDDEN");
    expect(middleware).toContain("TenantMismatch");
    expect(middleware).toContain('contextHeaders.set("x-drako-tenant-id", resolution.tenantId)');
    expect(middleware).toContain('contextHeaders.set("x-tenant-id", resolution.tenantId)');

    expect(tenantIsolation).toContain("HEADER_TENANT_MISMATCH");
    expect(tenantIsolation).toContain("AUTH_USER_MISSING");
    expect(tenantIsolation).toContain("AUTH_USER_TENANT_MISMATCH");

    expect(authServer).toContain("SOCIALFLOW_SESSION_TENANT_ISOLATION_FAILED");
    expect(authServer).toContain("requireAuthUser: true");
    expect(authRequest).toContain("SOCIALFLOW_REQUEST_TENANT_ISOLATION_FAILED");
    expect(authRequest).toContain("requireAuthUser: true");

    expect(authRepositories).toContain("listSocialFlowAuthUsersByTenant");
    expect(authRepositories).toContain("WHERE tenant_id = ?");

    expect(exportRoute).toContain("generateSocialFlowExportForTenant(session.tenantId)");
    expect(exportService).toContain("WHERE tenant_id = ?");
    expect(wipeout).toContain("agent_work_logs WHERE tenant_id = ? AND saas_id = ?");
    expect(wipeout).toContain("orchestrator_messages WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1000");
    expect(wipeout).toContain("economic_events WHERE tenant_id = ? AND saas_id = ?");
    expect(wipeout).toContain("saas_domains WHERE tenant_id = ? AND saas_id = ?");
    expect(wipeout).toContain("assertTenantScopedRows(");

    expect(workspaceLayout).toContain("getCurrentSocialFlowSession()");
    expect(workspaceLayout).toContain('redirect("/socialflow/auth")');
    expect(accountPage).toContain("SocialFlowAccountSettings");
    expect(accountPage).toContain("currentTenantId: session.tenantId");
    expect(accountPage).toContain("tenantId: session.tenantId");
    expect(socialFlowAccountSettings).not.toContain("next-auth/react");
    expect(socialFlowAccountSettings).toContain('fetch(logoutEndpoint, { method: "POST" })');
    expect(billingPage).toContain('getCurrentSocialFlowSession()');
    expect(billingPage).toContain('getCanonicalBillingSnapshot({ tenantId: session.tenantId, saasSlug: "socialflow" })');
    expect(billingPage).toContain("SocialFlowBillingSettings");
    expect(billingPage).not.toMatch(/@\/lib\/campobase|@\/lib\/campamento-base|@\/lib\/auth\/campamento-core/);

    expect(billingCheckoutRoute).toContain("requireCurrentSocialFlowSession(request)");
    expect(billingCheckoutRoute).toContain('saasSlug: "socialflow"');
    expect(billingCheckoutRoute).not.toMatch(/@\/lib\/campobase|@\/lib\/campamento-base|@\/lib\/auth\/campamento-core/);

    expect(billingPortalRoute).toContain("requireCurrentSocialFlowSession(request)");
    expect(billingPortalRoute).toContain('saasSlug: "socialflow"');
    expect(billingPortalRoute).not.toMatch(/@\/lib\/campobase|@\/lib\/campamento-base|@\/lib\/auth\/campamento-core/);
    expect(ownershipPage).toContain('link.href = "/api/socialflow/exports/current"');
    expect(teamPage).toContain("listSocialFlowAuthUsersByTenant(session.tenantId)");
  });

  it("keeps legacy linkedin connect and callback routes as redirect-only bridges", () => {
    const legacyConnect = read("apps/socialcors/src/app/api/social/linkedin/connect/route.ts");
    const legacyCallback = read("apps/socialcors/src/app/api/social/linkedin/callback/route.ts");

    expect(legacyConnect).toContain("/api/socialflow/linkedin/connect");
    expect(legacyConnect).toContain("308");
    expect(legacyConnect).not.toMatch(/requireTenantAccess|exchangeLinkedInCodeForAccessToken|fetchLinkedInUserProfile|persistLinkedInConnection/);

    expect(legacyCallback).toContain("/api/socialflow/linkedin/callback");
    expect(legacyCallback).toContain("308");
    expect(legacyCallback).not.toMatch(/exchangeLinkedInCodeForAccessToken|fetchLinkedInUserProfile|persistLinkedInConnection/);
  });
});
