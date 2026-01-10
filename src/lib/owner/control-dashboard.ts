import { resolveEmployeesContext } from "@/lib/employees/context";
import { checkEmployeeCompliance, getSaasComplianceSummary } from "@/lib/employees/compliance";
import { listEmployees, listEmployeesProfitability, loadHrSettings } from "@/lib/employees/repository";
import { getPricingSuggestions } from "@/lib/economy/pricing";
import {
  estimateMonthlyUsageForItem,
  getSaasProfitabilitySnapshot,
  listSaasInventoryItems,
  listSaasServices,
  resolveEconomyContext,
} from "@/lib/economy/repository";
import { analyzeSupplierOffer } from "@/lib/email-intake/classifier";
import { getEmailIntakeSnapshot, listEmailMessages, resolveEmailIntakeContext } from "@/lib/email-intake/repository";
import type { OwnerControlSnapshot, OwnerPortfolioSnapshot, OwnerPortfolioSaasItem, CanHireAdvice, CanHireStatus } from "@/lib/owner/types";
import { buildOwnerAutopilotActions } from "@/lib/owner/autopilot";
import { getSocialConversionSnapshot, getSocialOwnerSummary, resolveSocialContext } from "@/lib/social/repository";
import { getSaasBlueprint, listSaasModules, resolveBlueprintsContext } from "@/lib/blueprints/repository";
import type { BusinessType, BlueprintPrimaryGoal, SaasModuleCode } from "@/lib/blueprints/types";
import { resolveFeaturesContext, listSaasFeatures, getCompanyFeatures } from "@/lib/features/repository";
import { getDemoSaasPackForSaas } from "@/lib/admin/demo-data";
import { guessPackForSaas, getCompanyPacks } from "@/lib/packs/repository";
import { resolveTasksContext, listTasks } from "@/lib/tasks/repository";
import { getSaasTaxSummary } from "@/lib/tax/engine";
import { listSaasForOwner } from "@/lib/owner/portfolio";

type BuildOwnerControlParams = {
  tenantId: string;
  saasId: string;
  env?: Parameters<typeof resolveEconomyContext>[0]["env"];
};

function computeCanHireAdvice(params: {
  marginPercent: number | null;
  overworkedCount: number;
  lowActivityCount: number;
  potentialSavings: number;
}): CanHireAdvice {
  const margin = params.marginPercent ?? 0;
  let status: CanHireStatus = "BORDERLINE";
  let reason = "Revisa margen y carga antes de contratar.";
  if (margin < 20) {
    status = "CANNOT_HIRE";
    reason = "Margen demasiado bajo, ajusta precios/costes antes de contratar.";
  } else if (margin > 30 && params.overworkedCount > 0) {
    status = "CAN_HIRE";
    reason = "Hay sobrecarga y margen suficiente para refuerzo.";
  } else if (margin >= 25 && margin <= 30 && params.lowActivityCount > 0 && params.overworkedCount === 0) {
    status = "BORDERLINE";
    reason = "Hay baja actividad; reordena equipo antes de contratar.";
  }

  const details =
    params.potentialSavings > 0
      ? `Aplica ofertas de proveedores y podrías liberar ~${params.potentialSavings.toFixed(0)} €/mes para refuerzo.`
      : null;

  return { status, reason, details };
}

function buildRecommendations(params: {
  pricingPressureServices: OwnerControlSnapshot["economy"]["pricingPressureServices"];
  supplierSavings: number;
  overworkedCount: number;
}): string[] {
  const recommendations: string[] = [];
  if (params.pricingPressureServices.some((service) => service.status !== "OK")) {
    recommendations.push("Sube precios de servicios en estado LOSS para acercarte al margen objetivo.");
  }
  if (params.supplierSavings > 0) {
    recommendations.push(`Revisa ofertas de proveedor: puedes ahorrar ~${params.supplierSavings.toFixed(0)} €/mes con datos de consumo.`);
  }
  if (params.overworkedCount > 0) {
    recommendations.push(`Tienes ${params.overworkedCount} empleados con sobrecarga; valora ajustar agenda o contratar un extra.`);
  }
  return recommendations;
}

function resolveCriticalModules(businessType: BusinessType, primaryGoal: BlueprintPrimaryGoal): SaasModuleCode[] {
  if (businessType === "SALON" && primaryGoal === "FILL_AGENDA") {
    return ["APPOINTMENTS", "CUSTOMERS", "CLIENT_PORTAL", "SOCIAL", "ECONOMY", "HR"];
  }
  if (primaryGoal === "MAX_MARGIN") {
    return ["ECONOMY", "EMAIL_INTAKE", "HR", "OWNER_CONTROL"];
  }
  return [];
}

export async function buildOwnerControlSnapshot({ tenantId, saasId, env }: BuildOwnerControlParams): Promise<OwnerControlSnapshot> {
  const employeesCtx = await resolveEmployeesContext(tenantId, saasId);
  const economyCtx = await resolveEconomyContext({ tenantId, saasId, env });
  const emailCtx = await resolveEmailIntakeContext({ tenantId, saasId, env });

  let blueprintSummary: OwnerControlSnapshot["blueprintSummary"];
  try {
    const blueprintCtx = await resolveBlueprintsContext({ tenantId, saasId, env });
    const [blueprint, modules] = await Promise.all([
      getSaasBlueprint(blueprintCtx, saasId),
      listSaasModules(blueprintCtx, saasId),
    ]);
    if (blueprint) {
      const activeModules = modules.filter((module) => module.status === "ACTIVE");
      const plannedModules = modules.filter((module) => module.status === "PLANNED");
      const criticalModules = resolveCriticalModules(blueprint.businessType, blueprint.primaryGoal);
      const activeSet = new Set(activeModules.map((module) => module.code));
      blueprintSummary = {
        businessType: blueprint.businessType,
        primaryGoal: blueprint.primaryGoal,
        maturityStage: blueprint.maturityStage,
        activeModulesCount: activeModules.length,
        plannedModulesCount: plannedModules.length,
        missingCriticalModules: criticalModules.filter((code) => !activeSet.has(code)),
      };
    } else {
      blueprintSummary = undefined;
    }
  } catch (error) {
    console.warn("OWNER_CONTROL_BLUEPRINT_ERROR", error);
    blueprintSummary = undefined;
  }

  let socialSummary: OwnerControlSnapshot["social"];
  let socialConversion: OwnerControlSnapshot["socialConversion"];
  try {
    const socialCtx = await resolveSocialContext({ tenantId, saasId, env });
    const [ownerSummary, conversionSummary] = await Promise.all([
      getSocialOwnerSummary(socialCtx),
      getSocialConversionSnapshot(socialCtx),
    ]);
    socialSummary = ownerSummary;
    const topCampaign = conversionSummary.topCampaigns[0];
    socialConversion = {
      totalAppointmentsFromSocial: conversionSummary.totalAppointmentsFromSocial,
      totalRevenueFromSocial: conversionSummary.totalRevenueFromSocial,
      topCampaignName: topCampaign?.name,
      topCampaignRevenue: topCampaign?.estimatedRevenue,
    };
  } catch (error) {
    console.warn("OWNER_CONTROL_SOCIAL_SUMMARY_ERROR", error);
    socialSummary = undefined;
    socialConversion = undefined;
  }

  let taxSummary: OwnerControlSnapshot["taxSummary"];
  try {
    taxSummary = await getSaasTaxSummary({ tenantId, saasId, env });
  } catch (error) {
    console.warn("OWNER_CONTROL_TAX_SUMMARY_ERROR", error);
    taxSummary = undefined;
  }

  const [complianceSummary, employees, profitability, pricingSuggestions, inventoryItems, emailSnapshot, emailMessages, hrSettings, services] =
    await Promise.all([
    getSaasComplianceSummary(employeesCtx, saasId),
    listEmployees(employeesCtx),
    getSaasProfitabilitySnapshot(economyCtx),
    getPricingSuggestions(economyCtx),
    listSaasInventoryItems(economyCtx),
    getEmailIntakeSnapshot(emailCtx),
    listEmailMessages(emailCtx),
    loadHrSettings(employeesCtx),
    listSaasServices(economyCtx),
  ]);

  let currentPack: OwnerControlSnapshot["currentPack"];
  let recommendedPackId: OwnerControlSnapshot["recommendedPackId"];
  let companyFeatures: OwnerControlSnapshot["companyFeatures"];
  let companyPacks: OwnerControlSnapshot["companyPacks"];
  let companyResolvedSaasId: string | null = null;
  try {
    const demoPack = getDemoSaasPackForSaas(saasId);
    const featuresCtx = await resolveFeaturesContext({ tenantId, saasId, env });
    const features = await listSaasFeatures(featuresCtx);
    const featureKeys = features.map((feature) => feature.featureKey);
    const serviceNames = services.map((service) => service.name);
    companyFeatures = features;
    companyResolvedSaasId = featuresCtx.saasId ?? saasId;
    try {
      const packResult = await getCompanyPacks({ tenantId, saasId: companyResolvedSaasId, env });
      companyPacks = packResult.items;
      companyResolvedSaasId = packResult.resolvedSaasId ?? companyResolvedSaasId;
    } catch (error) {
      console.warn("OWNER_CONTROL_PACKS_QUERY_ERROR", error);
      companyPacks = undefined;
    }
    try {
      const featureResult = await getCompanyFeatures({ tenantId, saasId: companyResolvedSaasId, env });
      companyFeatures = featureResult.items;
      companyResolvedSaasId = featureResult.resolvedSaasId ?? companyResolvedSaasId;
    } catch (error) {
      console.warn("OWNER_CONTROL_FEATURES_QUERY_ERROR", error);
    }
    if (demoPack) {
      currentPack = {
        id: demoPack.id,
        slug: demoPack.slug,
        label: demoPack.label,
        vertical: demoPack.vertical,
      };
    } else {
      const guessed = guessPackForSaas({
        businessType: blueprintSummary?.businessType,
        featureKeys,
        serviceNames,
      });
      if (guessed) {
        currentPack = {
          id: guessed.id,
          slug: guessed.slug,
          label: guessed.label,
          vertical: guessed.vertical,
        };
      }
    }
    const recommended = guessPackForSaas({
      businessType: blueprintSummary?.businessType,
      featureKeys,
      serviceNames,
    });
    if (recommended && recommended.id !== currentPack?.id) {
      recommendedPackId = recommended.id;
    }
  } catch (error) {
    console.warn("OWNER_CONTROL_PACK_ERROR", error);
    currentPack = undefined;
    recommendedPackId = undefined;
    companyFeatures = undefined;
    companyPacks = undefined;
    companyResolvedSaasId = null;
  }

  let employeesProfitabilitySummary: OwnerControlSnapshot["employeesProfitabilitySummary"];
  try {
    const profitabilityList = await listEmployeesProfitability(employeesCtx, saasId);
    const counts = {
      employeesCount: profitabilityList.length,
      healthyCount: profitabilityList.filter((item) => item.status === "HEALTHY").length,
      tightCount: profitabilityList.filter((item) => item.status === "TIGHT").length,
      unprofitableCount: profitabilityList.filter((item) => item.status === "UNPROFITABLE").length,
      lowActivityCount: profitabilityList.filter((item) => item.status === "LOW_ACTIVITY").length,
    };
    const topProfitable = [...profitabilityList].sort((a, b) => (b.marginPercent ?? 0) - (a.marginPercent ?? 0))[0];
    const mostUnprofitable = [...profitabilityList].sort((a, b) => (a.marginPercent ?? 0) - (b.marginPercent ?? 0))[0];
    employeesProfitabilitySummary = {
      ...counts,
      topProfitableEmployee: topProfitable
        ? { employeeId: topProfitable.employeeId, name: topProfitable.name, marginPercent: topProfitable.marginPercent }
        : undefined,
      mostUnprofitableEmployee: mostUnprofitable
        ? { employeeId: mostUnprofitable.employeeId, name: mostUnprofitable.name, marginPercent: mostUnprofitable.marginPercent }
        : undefined,
    };
  } catch (error) {
    console.warn("OWNER_CONTROL_EMPLOYEE_ROI_ERROR", error);
    employeesProfitabilitySummary = undefined;
  }

  const complianceReports = await Promise.all(employees.map((employee) => checkEmployeeCompliance(employeesCtx, employee.id)));
  const overworkedCount = complianceReports.filter((report) => report.issues.some((issue) => issue.type === "OVERWORKED")).length;
  const underpaidCount = complianceReports.filter((report) => report.issues.some((issue) => issue.type === "UNDERPAID")).length;
  const lowActivityCount = complianceReports.filter((report) => report.issues.some((issue) => issue.type === "LOW_ACTIVITY")).length;
  const criticalIssues = complianceReports
    .filter((report) => report.status === "CRITICAL")
    .flatMap((report) => report.issues.map((issue) => issue.message))
    .slice(0, 5);

  const pricingPressureServices = pricingSuggestions.map((suggestion) => ({
    serviceId: suggestion.serviceId,
    serviceName: suggestion.serviceName,
    marginCurrent: suggestion.marginCurrent ?? null,
    marginTarget: profitability.targetMarginPercent ?? null,
    status: suggestion.status,
  }));

  const costBreakdown = {
    rent: profitability.rentCosts ?? 0,
    utilities: profitability.utilitiesCosts ?? 0,
    payroll: profitability.payrollCosts ?? 0,
    products: profitability.productCosts ?? 0,
    other: Math.max(
      0,
      (profitability.totalCosts ?? 0) -
        (profitability.rentCosts ?? 0) -
        (profitability.utilitiesCosts ?? 0) -
        (profitability.payrollCosts ?? 0) -
        (profitability.productCosts ?? 0),
    ),
  };

  const invoiceMessages = emailMessages.filter((message) => message.classification === "INVOICE");
  const lastInvoiceAt = invoiceMessages.length
    ? invoiceMessages.map((item) => item.receivedAt).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
    : null;

  const suggestionsWithEmail = emailMessages.flatMap((message) =>
    analyzeSupplierOffer(message, inventoryItems).map((suggestion) => ({ suggestion, email: message })),
  );

  const savingsOpportunities = (
    await Promise.all(
      suggestionsWithEmail
        .filter((entry) => entry.suggestion.type === "SUPPLIER" && entry.suggestion.savingsEstimate)
        .map(async (entry) => {
          const inventoryItem = inventoryItems.find((item) => item.id === entry.suggestion.relatedInventoryItemId);
          if (!inventoryItem) return null;
          const monthlyUsage = await estimateMonthlyUsageForItem(economyCtx, inventoryItem.id);
          const offeredUnitCost = inventoryItem.costPerUnit - (entry.suggestion.savingsEstimate ?? 0);
          return {
            supplierName: entry.email?.parsedSupplierName ?? null,
            itemName: inventoryItem.name,
            currentUnitCost: inventoryItem.costPerUnit,
            offeredUnitCost,
            estimatedMonthlyUsage: monthlyUsage,
            estimatedMonthlySaving: (entry.suggestion.savingsEstimate ?? 0) * monthlyUsage,
          };
        }),
    )
  )
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => b.estimatedMonthlySaving - a.estimatedMonthlySaving);

  const potentialSavingsPerMonth = savingsOpportunities.reduce((acc, item) => acc + item.estimatedMonthlySaving, 0);

  const canHireAdvice = computeCanHireAdvice({
    marginPercent: profitability.marginPercent ?? null,
    overworkedCount,
    lowActivityCount,
    potentialSavings: potentialSavingsPerMonth,
  });

  const snapshotCore: OwnerControlSnapshot = {
    tenantId,
    saasId,
    currentPack,
    recommendedPackId,
    companyFeatures,
    companyPacks,
    companyResolvedSaasId,
    blueprintSummary,
    guardrailsEnforcementSummary: {
      blockOverwork: hrSettings.blockOverwork,
      blockUnderpay: hrSettings.blockUnderpay,
      minRestHoursBetweenShifts: hrSettings.minRestHoursBetweenShifts,
    },
    economy: {
      marginPercentEstimated: profitability.marginPercent ?? null,
      targetMarginPercent: profitability.targetMarginPercent ?? null,
      totalRevenueEstimated: profitability.estimatedMonthlyRevenue ?? profitability.totalRevenue ?? null,
      totalCostsEstimated: profitability.estimatedMonthlyCosts ?? profitability.totalCosts ?? null,
      costBreakdown,
      pricingPressureServices,
    },
    hr: {
      employeesTotal: complianceSummary.totalEmployees,
      overworkedCount,
      underpaidCount,
      lowActivityCount,
      criticalIssues,
    },
    emailIntake: {
      totalMessages: emailMessages.length,
      invoicesCount: emailSnapshot.countsByClassification.INVOICE,
      supplierOffersCount: emailSnapshot.countsByClassification.SUPPLIER,
      leadMessagesCount: emailSnapshot.countsByClassification.LEAD,
      lastInvoiceAt,
      potentialSavingsPerMonth,
      topSavingsOpportunities: savingsOpportunities.slice(0, 3),
    },
    canHireAdvice,
    social: socialSummary,
    socialConversion,
    taxSummary,
    employeesProfitabilitySummary,
    recommendations: buildRecommendations({
      pricingPressureServices,
      supplierSavings: potentialSavingsPerMonth,
      overworkedCount,
    }),
  };

  let autopilotActions: OwnerControlSnapshot["autopilotActions"] = [];
  try {
    autopilotActions = buildOwnerAutopilotActions(snapshotCore);
  } catch (error) {
    console.warn("OWNER_CONTROL_AUTOPILOT_ERROR", error);
    autopilotActions = [];
  }

  return { ...snapshotCore, autopilotActions };
}

function deriveFairnessStatus(snapshot: OwnerControlSnapshot): "OK" | "WARNING" | "CRITICAL" {
  if (snapshot.hr.criticalIssues.length > 0) return "CRITICAL";
  if (snapshot.hr.overworkedCount > 0 || snapshot.hr.underpaidCount > 0) return "WARNING";
  return "OK";
}

function deriveEmployeesRoiStatus(snapshot: OwnerControlSnapshot): "HEALTHY" | "TIGHT" | "LOW_ACTIVITY" {
  const summary = snapshot.employeesProfitabilitySummary;
  if (!summary) return "LOW_ACTIVITY";
  if (summary.lowActivityCount > 0 && summary.healthyCount === 0 && summary.tightCount === 0 && summary.unprofitableCount === 0) {
    return "LOW_ACTIVITY";
  }
  if (summary.tightCount > 0 || summary.unprofitableCount > 0) return "TIGHT";
  return "HEALTHY";
}

function deriveSocialRoiStatus(snapshot: OwnerControlSnapshot): "GOOD" | "NEUTRAL" | "POOR" {
  if (snapshot.socialConversion?.totalRevenueFromSocial && snapshot.socialConversion.totalRevenueFromSocial > 0) return "GOOD";
  if (snapshot.social?.accountsConnected && snapshot.social.accountsConnected > 0) return "NEUTRAL";
  return "POOR";
}

export async function buildOwnerPortfolioSnapshot(params: {
  tenantId: string;
  ownerId: string;
  env?: BuildOwnerControlParams["env"];
}): Promise<OwnerPortfolioSnapshot> {
  const saasList = await listSaasForOwner(params.tenantId, params.ownerId);
  const items: OwnerPortfolioSaasItem[] = [];
  let marginTotal = 0;
  let marginCount = 0;
  let totalEmployees = 0;
  let totalOpenTasks = 0;
  const totalHardGuardrails = 0;

  for (const saas of saasList) {
    const snapshot = await buildOwnerControlSnapshot({ tenantId: params.tenantId, saasId: saas.id, env: params.env });
    const tasksCtx = await resolveTasksContext({ tenantId: params.tenantId, saasId: saas.id, env: params.env });
    const openTasks = await listTasks(tasksCtx, { status: "OPEN" });
    totalOpenTasks += openTasks.length;

    if (typeof snapshot.economy.marginPercentEstimated === "number") {
      marginTotal += snapshot.economy.marginPercentEstimated;
      marginCount += 1;
    }
    totalEmployees += snapshot.hr.employeesTotal ?? 0;

    const autopilotSummary = {
      criticalActions: (snapshot.autopilotActions ?? []).filter((action) => action.severity === "CRITICAL").length,
      warningActions: (snapshot.autopilotActions ?? []).filter((action) => action.severity === "WARNING").length,
      suggestionActions: (snapshot.autopilotActions ?? []).filter((action) => action.severity === "SUGGESTION").length,
    };

    items.push({
      saasId: saas.id,
      name: saas.name,
      slug: saas.slug,
      verticalPack: snapshot.currentPack
        ? { id: snapshot.currentPack.id, slug: snapshot.currentPack.slug, label: snapshot.currentPack.label }
        : undefined,
      recommendedPackId: snapshot.recommendedPackId ?? undefined,
      keyMetrics: {
        marginPercent: snapshot.economy.marginPercentEstimated ?? undefined,
        hrFairnessStatus: deriveFairnessStatus(snapshot),
        employeesRoiStatus: deriveEmployeesRoiStatus(snapshot),
        socialRoiStatus: deriveSocialRoiStatus(snapshot),
        guardrailsViolationsLast30d: 0,
        autopilotPendingTasks: openTasks.length,
      },
      autopilotSummary,
    });
  }

  return {
    ownerId: params.ownerId,
    totalSaas: items.length,
    saas: items,
    highLevel: {
      totalMarginAverage: marginCount > 0 ? marginTotal / marginCount : undefined,
      totalEmployees,
      totalOpenTasks,
      totalHardGuardrailViolationsLast30d: totalHardGuardrails,
    },
  };
}
