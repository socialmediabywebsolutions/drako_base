import type { OwnerControlSnapshot, DrakoSuggestedAction, AutopilotActionSeverity } from "@/lib/owner/types";
import { getSaasPackById } from "@/lib/packs/repository";

const SEVERITY_PRIORITY: Record<AutopilotActionSeverity, number> = {
  CRITICAL: 0,
  WARNING: 1,
  SUGGESTION: 2,
  INFO: 3,
};

function buildId(category: string, index: number) {
  return `autopilot_${category.toLowerCase()}_${Date.now()}_${index}`;
}

function buildKey(parts: string[]) {
  return parts
    .filter(Boolean)
    .join("_")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export function buildOwnerAutopilotActions(snapshot: OwnerControlSnapshot): DrakoSuggestedAction[] {
  const actions: DrakoSuggestedAction[] = [];
  const createdAt = new Date().toISOString();
  let index = 0;

  const margin = snapshot.economy.marginPercentEstimated ?? null;
  const targetMargin = snapshot.economy.targetMarginPercent ?? null;
  if (typeof margin === "number" && typeof targetMargin === "number" && margin < targetMargin - 5) {
    actions.push({
      id: buildId("PRICING", index++),
      key: "pricing_margin_gap",
      category: "PRICING",
      severity: "WARNING",
      title: "Sube precios de servicios clave",
      description: `Tu margen estimado es ${margin.toFixed(0)}% y tu objetivo es ${targetMargin.toFixed(0)}%. Revisa los servicios en presión y aplica precios sugeridos.`,
      target: { type: "GENERAL" },
      knowledgeHints: { spaceSlug: "pricing", tags: ["pricing", "margen"] },
      targetArea: "pricing",
      createdAt,
    });
  }

  const lossServices = snapshot.economy.pricingPressureServices.filter((service) => service.status === "LOSS");
  if (lossServices.length > 0) {
    const firstLoss = lossServices[0];
    actions.push({
      id: buildId("ECONOMY", index++),
      key: "economy_loss_services",
      category: "ECONOMY",
      severity: "CRITICAL",
      title: "Servicios con pérdidas activas",
      description: `Detectamos ${lossServices.length} servicios en estado LOSS. Ajusta precios o costes para recuperar margen.`,
      targetArea: "economy",
      serviceId: firstLoss?.serviceId,
      target: { type: "SERVICE", id: firstLoss?.serviceId ?? null },
      knowledgeHints: { spaceSlug: "pricing", tags: ["margen", "loss"], targetType: "SERVICE", targetId: firstLoss?.serviceId ?? undefined },
      createdAt,
    });
  }

  if (snapshot.hr.overworkedCount > 0) {
    actions.push({
      id: buildId("FAIRNESS", index++),
      key: "fairness_overwork_detected",
      category: "FAIRNESS",
      severity: "CRITICAL",
      title: "Revisa horarios: sobrecarga detectada",
      description: `Hay ${snapshot.hr.overworkedCount} empleados cerca o por encima del límite de horas. Ajusta agenda o valora refuerzo.`,
      target: { type: "GENERAL" },
      knowledgeHints: { spaceSlug: "hr", tags: ["fairness", "horas"] },
      targetArea: "hr",
      createdAt,
    });
  }

  if (snapshot.hr.underpaidCount > 0) {
    actions.push({
      id: buildId("HR", index++),
      key: "hr_underpaid_detected",
      category: "HR",
      severity: "WARNING",
      title: "Salarios por debajo de mínimos recomendados",
      description: `Hay ${snapshot.hr.underpaidCount} empleados con salario/hora por debajo de los mínimos. Revisa contratos en HR & Compliance.`,
      target: { type: "GENERAL" },
      knowledgeHints: { spaceSlug: "hr", tags: ["salario", "compliance"] },
      targetArea: "hr",
      createdAt,
    });
  }

  if (snapshot.hr.lowActivityCount > 0) {
    actions.push({
      id: buildId("HR", index++),
      key: "hr_low_activity",
      category: "HR",
      severity: "SUGGESTION",
      title: "Baja actividad en equipo",
      description: `Hay ${snapshot.hr.lowActivityCount} empleados con baja actividad. Revisa agenda y asignaciones.`,
      target: { type: "GENERAL" },
      knowledgeHints: { spaceSlug: "operations", tags: ["agenda", "productividad"] },
      targetArea: "hr",
      createdAt,
    });
  }

  if (snapshot.guardrailsEnforcementSummary) {
    if (snapshot.hr.overworkedCount > 0) {
      actions.push({
        id: buildId("FAIRNESS", index++),
        key: "fairness_overwork_guardrails",
        category: "FAIRNESS",
        severity: snapshot.guardrailsEnforcementSummary.blockOverwork ? "CRITICAL" : "WARNING",
        title: "Sobrecarga detectada en el equipo",
        description: snapshot.guardrailsEnforcementSummary.blockOverwork
          ? "Fairness Guard está configurado para bloquear sobrecarga. Ajusta agenda o refuerza el equipo."
          : "Hay señales de sobrecarga. Revisa horarios antes de seguir llenando la agenda.",
        target: { type: "GENERAL" },
        targetArea: "hr",
        createdAt,
      });
    }

    if (snapshot.hr.underpaidCount > 0) {
      actions.push({
        id: buildId("HR", index++),
        key: "hr_underpay_guardrails",
        category: "HR",
        severity: snapshot.guardrailsEnforcementSummary.blockUnderpay ? "CRITICAL" : "WARNING",
        title: "Salario por debajo del mínimo configurado",
        description: snapshot.guardrailsEnforcementSummary.blockUnderpay
          ? "Fairness Guard puede bloquear nuevas citas hasta ajustar salarios. Revisa contratos."
          : "Revisa salarios y el mínimo configurado para evitar incumplimientos.",
        target: { type: "GENERAL" },
        targetArea: "hr",
        createdAt,
      });
    }
  }

  if (snapshot.emailIntake.potentialSavingsPerMonth > 0) {
    actions.push({
      id: buildId("EMAIL", index++),
      key: "email_supplier_savings",
      category: "EMAIL",
      severity: "SUGGESTION",
      title: "Ahorro con proveedores disponible",
      description: `Tienes oportunidades de ahorro de ~${snapshot.emailIntake.potentialSavingsPerMonth.toFixed(0)} €/mes. Revisa la bandeja de proveedores.`,
      target: { type: "GENERAL" },
      knowledgeHints: { spaceSlug: "operations", tags: ["proveedores", "ahorro"] },
      targetArea: "email",
      createdAt,
    });
  }

  if (snapshot.social && snapshot.social.accountsConnected > 0 && snapshot.social.scheduledPostsThisWeek === 0) {
    actions.push({
      id: buildId("SOCIAL", index++),
      key: "social_no_scheduled_posts",
      category: "SOCIAL",
      severity: "WARNING",
      title: "Cuentas conectadas sin publicaciones programadas",
      description: "Tienes redes conectadas pero ninguna publicación programada esta semana. Crea un post o campaña.",
      target: { type: "GENERAL" },
      knowledgeHints: { spaceSlug: "social-playbooks", tags: ["social", "cadencia"] },
      targetArea: "social",
      createdAt,
    });
  }

  if (snapshot.socialConversion) {
    if (snapshot.socialConversion.totalAppointmentsFromSocial === 0) {
      actions.push({
        id: buildId("SOCIAL", index++),
        key: "social_no_conversions",
        category: "SOCIAL",
        severity: "INFO",
        title: "Campañas sociales sin citas atribuibles",
        description: "Tus campañas sociales no están generando citas. Ajusta mensajes, ofertas y segmentación.",
        target: { type: "GENERAL" },
        knowledgeHints: { spaceSlug: "social-playbooks", tags: ["conversion", "ofertas"] },
        targetArea: "social",
        createdAt,
      });
    } else if (snapshot.socialConversion.topCampaignName && (snapshot.socialConversion.topCampaignRevenue ?? 0) > 0) {
      actions.push({
        id: buildId("SOCIAL", index++),
        key: buildKey(["social_top_campaign", snapshot.socialConversion.topCampaignName]),
        category: "SOCIAL",
        severity: "SUGGESTION",
        title: `Refuerza la campaña “${snapshot.socialConversion.topCampaignName}”`,
        description: "Es la campaña con más ingresos. Considera replicarla en otros días con menor ocupación.",
        target: { type: "CAMPAIGN" },
        knowledgeHints: { spaceSlug: "social-playbooks", tags: ["campañas"] },
        targetArea: "social",
        createdAt,
      });
    }
  }

  if (snapshot.taxSummary) {
    const taxStatus = snapshot.taxSummary.status;
    const marginPercent = snapshot.economy.marginPercentEstimated ?? 0;
    if (taxStatus === "RISK" && marginPercent < 15) {
      actions.push({
        id: buildId("TAX", index++),
        key: "tax_high_due_low_margin",
        category: "TAX",
        severity: "CRITICAL",
        title: "IVA alto con margen bajo",
        description: "El IVA estimado es alto y el margen está justo. Revisa precios y gastos antes del cierre trimestral.",
        target: { type: "GENERAL" },
        knowledgeHints: { spaceSlug: "pricing", tags: ["tax", "iva", "quarterly"] },
        targetArea: "tax",
        createdAt,
      });
    } else if (taxStatus === "RISK") {
      actions.push({
        id: buildId("TAX", index++),
        key: "tax_high_due",
        category: "TAX",
        severity: "WARNING",
        title: "IVA estimado alto",
        description: "Revisa ingresos/gastos del trimestre y prepara el cierre con antelación.",
        target: { type: "GENERAL" },
        knowledgeHints: { spaceSlug: "pricing", tags: ["tax", "iva", "quarterly"] },
        targetArea: "tax",
        createdAt,
      });
    }
  }

  if (snapshot.employeesProfitabilitySummary) {
    if (snapshot.employeesProfitabilitySummary.unprofitableCount > 0) {
      actions.push({
        id: buildId("ECONOMY", index++),
        key: "economy_negative_margin_team",
        category: "ECONOMY",
        severity: "CRITICAL",
        title: "Margen negativo en equipo",
        description: "Hay empleados con margen negativo recurrente. Revisa precios, distribución de servicios o carga de trabajo.",
        target: { type: "GENERAL" },
        knowledgeHints: { spaceSlug: "pricing", tags: ["margen", "equipo"] },
        targetArea: "hr",
        createdAt,
      });
    } else if (snapshot.employeesProfitabilitySummary.tightCount > 0) {
      actions.push({
        id: buildId("ECONOMY", index++),
        key: "economy_tight_margin_team",
        category: "ECONOMY",
        severity: "WARNING",
        title: "Margen muy bajo en parte del equipo",
        description: "Tienes empleados con margen apretado. Ajusta precios o asigna servicios de mayor ticket.",
        target: { type: "GENERAL" },
        knowledgeHints: { spaceSlug: "pricing", tags: ["margen", "servicios"] },
        targetArea: "pricing",
        createdAt,
      });
    }
    if (snapshot.employeesProfitabilitySummary.topProfitableEmployee?.name) {
      const topEmployee = snapshot.employeesProfitabilitySummary.topProfitableEmployee;
      actions.push({
        id: buildId("GENERAL", index++),
        key: buildKey(["general_top_profitable_employee", topEmployee.employeeId]),
        category: "GENERAL",
        severity: "SUGGESTION",
        title: "Refuerza al mejor perfil",
        description: `El mejor margen lo tiene ${topEmployee.name}. Refuerza agenda o campañas alrededor de este perfil.`,
        targetArea: "employees",
        employeeId: topEmployee.employeeId,
        target: { type: "EMPLOYEE", id: topEmployee.employeeId },
        knowledgeHints: { spaceSlug: "operations", tags: ["agenda", "upsell"], targetType: "EMPLOYEE", targetId: topEmployee.employeeId },
        createdAt,
      });
    }
  }

  if (snapshot.blueprintSummary?.missingCriticalModules?.length) {
    const missing = snapshot.blueprintSummary.missingCriticalModules;
      actions.push({
        id: buildId("SYSTEM", index++),
        key: buildKey(["blueprint_missing_modules", ...missing]),
        category: "SYSTEM",
        severity: "WARNING",
        title: "Activa módulos clave del blueprint",
        description: `Faltan módulos críticos para tu objetivo: ${missing.join(", ")}. Actívalos para alinear el sistema.`,
        target: { type: "FEATURE", id: missing[0] ?? null },
        knowledgeHints: { spaceSlug: "operations", tags: ["blueprint"] },
        targetArea: "blueprint",
        createdAt,
      });
    }

  if (!snapshot.currentPack && snapshot.recommendedPackId) {
    const pack = getSaasPackById(snapshot.recommendedPackId);
    actions.push({
      id: buildId("SYSTEM", index++),
      key: buildKey(["pack_recommended", snapshot.recommendedPackId]),
      category: "SYSTEM",
      severity: "SUGGESTION",
      title: pack ? `Aplica el pack ${pack.label}` : "Aplica el pack recomendado para tu vertical",
      description: pack
        ? `Activa el pack ${pack.label} para habilitar módulos coherentes con tu negocio.`
        : "Aplica el pack recomendado para alinear módulos y playbooks.",
      target: { type: "PACK", id: snapshot.recommendedPackId },
      knowledgeHints: pack ? { tags: pack.recommendedKnowledgeTags } : { tags: ["pack"] },
      targetArea: "blueprint",
      createdAt,
    });
  }

  if (snapshot.canHireAdvice.status === "CAN_HIRE") {
    actions.push({
      id: buildId("GENERAL", index++),
      key: "general_can_hire",
      category: "GENERAL",
      severity: "SUGGESTION",
      title: "Puedes valorar contratar refuerzo",
      description: "El margen actual permite ampliar equipo. Revisa HR & Compliance antes de decidir.",
      target: { type: "GENERAL" },
      knowledgeHints: { spaceSlug: "hr", tags: ["contratacion"] },
      targetArea: "hr",
      createdAt,
    });
  }

  if (snapshot.recommendations.length > 0) {
    snapshot.recommendations.forEach((rec) => {
      actions.push({
        id: buildId("GENERAL", index++),
        key: buildKey(["general_recommendation", rec]),
        category: "GENERAL",
        severity: "SUGGESTION",
        title: "Recomendación rápida",
        description: rec,
        target: { type: "GENERAL" },
        knowledgeHints: { spaceSlug: "operations", tags: ["general"] },
        targetArea: "general",
        createdAt,
      });
    });
  }

  return actions.sort((a, b) => SEVERITY_PRIORITY[a.severity] - SEVERITY_PRIORITY[b.severity]);
}
