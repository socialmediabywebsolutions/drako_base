import "./register-paths";
import { strict as assert } from "node:assert";

import { resolveCompanyFeaturePackContext } from "@/lib/orchestrator/company-context";
import { buildOwnerAutopilotActions } from "@/lib/owner/autopilot";
import type { OwnerControlSnapshot } from "@/lib/owner/types";
import type { SaasFeature, SaasFeatureKey } from "@/lib/features/types";
import type { SaasPackDefinition } from "@/lib/packs/types";
import type { CompanyFeaturesResult } from "@/lib/features/repository";
import type { CompanyPacksResult } from "@/lib/packs/repository";

function makeFeature(featureKey: SaasFeatureKey, status: SaasFeature["status"], overrides: Partial<SaasFeature> = {}): SaasFeature {
  const iso = new Date().toISOString();
  return {
    id: overrides.id ?? `feature_${featureKey.toLowerCase()}`,
    tenantId: overrides.tenantId ?? "tenant_test",
    saasId: overrides.saasId ?? "saas_ctx",
    featureKey,
    label: overrides.label ?? featureKey,
    category: overrides.category ?? "CORE",
    status,
    source: overrides.source ?? "BLUEPRINT",
    phaseOrder: overrides.phaseOrder ?? 0,
    metadata: overrides.metadata ?? null,
    createdAt: overrides.createdAt ?? iso,
    updatedAt: overrides.updatedAt ?? iso,
  };
}

function makePack(id: string, overrides: Partial<SaasPackDefinition> = {}): SaasPackDefinition {
  return {
    id,
    slug: overrides.slug ?? id,
    label: overrides.label ?? id,
    vertical: overrides.vertical ?? "SALON",
    description: overrides.description ?? "Test pack",
    recommendedFeatureKeys: overrides.recommendedFeatureKeys ?? [],
    recommendedBlueprintModuleKeys: overrides.recommendedBlueprintModuleKeys ?? [],
    recommendedKnowledgeTags: overrides.recommendedKnowledgeTags ?? [],
    recommendedSocialCampaignSlugs: overrides.recommendedSocialCampaignSlugs ?? [],
    catalog: overrides.catalog,
  };
}

function makeBaseSnapshot(): OwnerControlSnapshot {
  return {
    tenantId: "tenant_test",
    saasId: "saas_test",
    currentPack: undefined,
    recommendedPackId: undefined,
    companyFeatures: undefined,
    companyPacks: undefined,
    companyResolvedSaasId: "saas_test",
    blueprintSummary: undefined,
    guardrailsEnforcementSummary: { blockOverwork: false, blockUnderpay: false, minRestHoursBetweenShifts: 8 },
    social: undefined,
    taxSummary: undefined,
    socialConversion: undefined,
    employeesProfitabilitySummary: undefined,
    autopilotActions: undefined,
    economy: {
      marginPercentEstimated: 30,
      targetMarginPercent: 30,
      totalRevenueEstimated: 0,
      totalCostsEstimated: 0,
      costBreakdown: { rent: 0, utilities: 0, payroll: 0, products: 0, other: 0 },
      pricingPressureServices: [],
    },
    hr: {
      employeesTotal: 0,
      overworkedCount: 0,
      underpaidCount: 0,
      lowActivityCount: 0,
      criticalIssues: [],
    },
    emailIntake: {
      totalMessages: 0,
      invoicesCount: 0,
      supplierOffersCount: 0,
      leadMessagesCount: 0,
      lastInvoiceAt: null,
      potentialSavingsPerMonth: 0,
      topSavingsOpportunities: [],
    },
    canHireAdvice: { status: "BORDERLINE", reason: "baseline", details: null },
    recommendations: [],
  };
}

async function testResolveCompanyFeaturePackContextHappyPath(): Promise<void> {
  const featureResult: CompanyFeaturesResult = {
    items: [makeFeature("ECONOMY", "ENABLED")],
    resolvedSaasId: "company_resolved",
    contextMode: null,
  };
  const packResult: CompanyPacksResult = {
    items: [makePack("pack_pro")],
    resolvedSaasId: "company_resolved",
    matchReason: "FEATURE_MATCH",
  };

  const context = await resolveCompanyFeaturePackContext({
    tenantId: "tenant_test",
    companyId: "company_1",
    fallbackSaasId: "saas_fallback",
    env: null,
    featureFetcher: async () => featureResult,
    packFetcher: async () => packResult,
    packFallback: () => [makePack("pack_fallback")],
  });

  assert.deepEqual(context.features, featureResult.items, "Should expose feature items from fetcher");
  assert.deepEqual(context.packs, packResult.items, "Should expose pack items from fetcher");
  assert.equal(context.resolvedSaasId, "company_resolved", "Should use resolved saas id from fetchers");
  assert.deepEqual(context.errors, [], "No errors expected on happy path");
}

async function testResolveCompanyFeaturePackContextWithErrors(): Promise<void> {
  const fallbackPacks = [makePack("pack_fallback")];
  const context = await resolveCompanyFeaturePackContext({
    tenantId: "tenant_test",
    companyId: "company_fail",
    fallbackSaasId: null,
    env: null,
    featureFetcher: async () => {
      throw new Error("feature boom");
    },
    packFetcher: async () => {
      throw new Error("pack boom");
    },
    packFallback: () => fallbackPacks,
  });

  assert.equal(context.features, undefined, "Features should be undefined when fetch fails");
  assert.deepEqual(context.packs, fallbackPacks, "Fallback packs should be returned when fetch fails");
  assert(context.errors.includes("company features query failed"), "Should propagate feature error message");
  assert(context.errors.includes("company packs query failed"), "Should propagate pack error message");
}

function testAutopilotFeatureGating(): void {
  const snapshot = makeBaseSnapshot();
  snapshot.companyFeatures = [makeFeature("ECONOMY", "ENABLED")];
  snapshot.companyPacks = [];
  snapshot.economy = {
    ...snapshot.economy,
    marginPercentEstimated: 10,
    targetMarginPercent: 20,
    pricingPressureServices: [
      {
        serviceId: "svc_loss",
        serviceName: "Servicio",
        marginCurrent: -15,
        marginTarget: 25,
        status: "LOSS",
      },
    ],
  };
  snapshot.hr = {
    ...snapshot.hr,
    employeesTotal: 5,
    overworkedCount: 2,
    underpaidCount: 1,
    lowActivityCount: 0,
    criticalIssues: [],
  };
  snapshot.canHireAdvice = { status: "BORDERLINE", reason: "baseline", details: null };

  const actions = buildOwnerAutopilotActions(snapshot);
  assert(actions.some((action) => action.category === "ECONOMY"), "Economy actions should remain when ECONOMY feature enabled");
  assert(actions.every((action) => action.category !== "HR" && action.category !== "FAIRNESS"), "HR and Fairness actions should be gated without HR feature");
}

function testAutopilotPackGating(): void {
  const snapshot = makeBaseSnapshot();
  snapshot.companyFeatures = [];
  snapshot.companyPacks = [makePack("pack_existing")];
  snapshot.recommendedPackId = "pack_new";
  snapshot.currentPack = undefined;

  const actions = buildOwnerAutopilotActions(snapshot);
  assert(!actions.some((action) => action.key?.startsWith("pack_recommended")), "Pack suggestion should be gated if pack not entitled");
}

async function run() {
  const tests: Array<{ name: string; fn: () => void | Promise<void> }> = [
    { name: "resolveCompanyFeaturePackContext returns fetched data", fn: testResolveCompanyFeaturePackContextHappyPath },
    { name: "resolveCompanyFeaturePackContext collects errors and fallback", fn: testResolveCompanyFeaturePackContextWithErrors },
    { name: "buildOwnerAutopilotActions gates actions by features", fn: testAutopilotFeatureGating },
    { name: "buildOwnerAutopilotActions gates pack suggestions", fn: testAutopilotPackGating },
  ];

  let failures = 0;
  for (const test of tests) {
    try {
      await test.fn();
      console.log(`✅ ${test.name}`);
    } catch (error) {
      failures += 1;
      console.error(`❌ ${test.name}`);
      console.error(error instanceof Error ? error.stack : error);
    }
  }

  if (failures > 0) {
    console.error(`❌ Completed with ${failures} failing test(s).`);
    process.exit(1);
  }

  console.log("✅ All orchestrator company tests passed");
}

void run();
