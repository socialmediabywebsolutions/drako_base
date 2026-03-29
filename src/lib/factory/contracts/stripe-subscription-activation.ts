import { env } from "@/lib/cf";
import { JobRunner } from "@/lib/provisioning/job-runner";
import { withCampamentoBaseProfile } from "@/lib/campamento-base/saas-factory-helpers";
import { recordCampamentoEvent } from "@/lib/empire/events";

function cleanJobIdSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 140);
}

export async function handleFactorySubscriptionActivation(params: {
  plan: string;
  tenantId: string;
  saasSlug?: string | null;
  correlationId?: string | null;
}): Promise<{ handled: boolean; contract: string; queued?: boolean; jobId?: string; saasId?: string }> {
  if (params.plan !== "mentoria_ia") {
    return { handled: false, contract: "billing_subscription_activation" };
  }

  const bindings = env();
  if (!bindings?.PROVISIONING_QUEUE) {
    throw new Error("FACTORY_SUBSCRIPTION_QUEUE_MISSING");
  }

  const slug = params.saasSlug?.trim().toLowerCase() || "mentor-ia-escolar";
  const correlationId = params.correlationId?.trim() || `stripe_factory_${Date.now()}`;
  const idempotencyKey = `billing_subscription_activation:${params.tenantId}:${slug}`;
  const jobId = `job_${cleanJobIdSegment(idempotencyKey)}`;

  const blueprint = withCampamentoBaseProfile({
    ownerTenantId: params.tenantId,
    saasName: "MentorIA Escolar",
    proposedSlug: slug,
    proposedSubdomain: slug,
    verticalId: "OTHER",
    summary: "SaaS activado desde billing mediante contrato factory asincrono.",
    targetAudience: "Instituciones educativas",
    mainProblem: "Falta de apoyo personalizado",
    mainGoal: "Brindar tutoria mediante IA",
    packsByDepartment: {
      accounting: "BASIC",
      marketing: "BASIC",
      support: "BASIC",
    },
    initialPricing: {
      currentMonthlyPrice: 49,
      estimatedVendorCostMonthly: 10,
    },
    aiProfile: {
      tier: "BALANCED",
    },
  });

  const job = await JobRunner.ensureJob({
    jobId,
    type: "SAAS_PROVISIONING",
    entityId: globalThis.crypto?.randomUUID?.() ?? `saas_${Date.now()}`,
    correlationId,
    idempotencyKey,
    initialState: "CREATED",
    payload: blueprint,
    tenantId: params.tenantId,
    queue: bindings.PROVISIONING_QUEUE,
  });

  await recordCampamentoEvent({
    tenantId: params.tenantId,
    saasId: job.entityId,
    type: job.created ? "factory.subscription_activation.queued" : "factory.subscription_activation.reused",
    severity: "INFO",
    source: "STRIPE_WEBHOOK",
    message: job.created
      ? "Factory activation queued from Stripe webhook."
      : "Factory activation matched an existing queued job.",
    metadata: {
      contract: "billing_subscription_activation",
      jobId: job.jobId,
      idempotencyKey,
      plan: params.plan,
      saasSlug: slug,
    },
    correlationId,
  });

  return {
    handled: true,
    contract: "billing_subscription_activation",
    queued: job.created,
    jobId: job.jobId,
    saasId: job.entityId,
  };
}
