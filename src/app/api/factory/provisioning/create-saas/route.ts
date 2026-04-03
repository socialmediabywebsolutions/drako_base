
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env as resolveEnv } from "@/lib/cf";
import { ensureDatabase, queryOne } from "@/lib/db";
import { extractSessionFromRequest } from "@/lib/edge-auth";
import { authorizeSaasAccess } from "@/lib/authz/saas-access";
import { JobRunner } from "@/lib/provisioning/job-runner";
import type { SaasBlueprintDraft } from "@/lib/campamento-base/saas-factory-types";
import { withCampamentoBaseProfile } from "@/lib/campamento-base/saas-factory-helpers";
import { recordCampamentoEvent } from "@/lib/empire/events";
import { FactoryBillingError, assertFactoryQuota, getFactoryBillingState } from "@/lib/billing/factory-billing";

export const dynamic = "force-dynamic";

const legacyPlansSchema = z.array(
  z.object({
    planCode: z.enum(["starter", "pro", "scale"]),
    monthlyPriceCents: z.number().int().min(0),
  }),
).optional();

const createSaasRequestSchema = z.object({
  idempotencyKey: z.string().min(8).max(180).optional(),
  correlationId: z.string().min(8).max(180).optional(),
  name: z.string().min(2).max(120).optional(),
  slug: z.string().min(2).max(64).regex(/^[a-z0-9-]+$/).optional(),
  saasSlug: z.string().min(2).max(64).regex(/^[a-z0-9-]+$/).optional(),
  dryRun: z.boolean().optional(),
  plans: legacyPlansSchema,
  blueprintDraft: z.record(z.string(), z.unknown()).optional(),
});

function cleanJobIdSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 140);
}

async function hashCreateRequest(input: {
  tenantId: string;
  blueprint: SaasBlueprintDraft;
  dryRun: boolean;
}): Promise<string> {
  const stablePayload = JSON.stringify({
    tenantId: input.tenantId,
    slug: input.blueprint.proposedSlug,
    name: input.blueprint.saasName,
    dryRun: input.dryRun,
    packs: input.blueprint.packsByDepartment,
    pricing: input.blueprint.initialPricing,
    aiTier: input.blueprint.aiProfile?.tier ?? null,
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stablePayload));
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 20);
}

function normalizeBlueprint(params: {
  tenantId: string;
  payload: z.infer<typeof createSaasRequestSchema>;
}): SaasBlueprintDraft {
  const draft = (params.payload.blueprintDraft ?? {}) as Partial<SaasBlueprintDraft>;
  const fallbackSlug = draft.proposedSlug ?? params.payload.slug ?? params.payload.saasSlug ?? "";
  const fallbackName = draft.saasName ?? params.payload.name ?? "";
  if (!fallbackSlug || !fallbackName) {
    throw new Error("INVALID_SAAS_INPUT");
  }

  const pricingFromPlans = params.payload.plans?.find((plan) => plan.planCode === "pro")
    ?? params.payload.plans?.[0]
    ?? null;
  const currentMonthlyPrice = pricingFromPlans ? pricingFromPlans.monthlyPriceCents / 100 : 0;

  return withCampamentoBaseProfile({
    ownerTenantId: params.tenantId,
    saasName: fallbackName,
    proposedSlug: fallbackSlug,
    proposedSubdomain: draft.proposedSubdomain ?? fallbackSlug,
    verticalId: draft.verticalId ?? "OTHER",
    summary: draft.summary ?? "SaaS creado con flujo canonico de fabrica.",
    targetAudience: draft.targetAudience ?? "Clientes del vertical",
    mainProblem: draft.mainProblem ?? "Operacion dispersa",
    mainGoal: draft.mainGoal ?? "Estandarizar y escalar",
    packsByDepartment: draft.packsByDepartment ?? {},
    initialPricing: {
      currentMonthlyPrice: draft.initialPricing?.currentMonthlyPrice ?? currentMonthlyPrice,
      estimatedVendorCostMonthly: draft.initialPricing?.estimatedVendorCostMonthly ?? null,
      recommendedMinPriceMonthly: draft.initialPricing?.recommendedMinPriceMonthly ?? null,
      recommendedTargetPriceMonthly: draft.initialPricing?.recommendedTargetPriceMonthly ?? null,
      recommendedStretchPriceMonthly: draft.initialPricing?.recommendedStretchPriceMonthly ?? null,
    },
    aiProfile: {
      tier: draft.aiProfile?.tier ?? "BALANCED",
      notes: draft.aiProfile?.notes,
    },
    knowledgeSeeds: draft.knowledgeSeeds ?? [],
    initialFeatures: draft.initialFeatures ?? [],
    interviewSummary: draft.interviewSummary ?? "",
    provisioning: draft.provisioning,
    campamentoBaseProfile: draft.campamentoBaseProfile,
  });
}

function isOwnerRole(role: string | null | undefined): boolean {
  return role === "owner" || role === "superadmin" || role === "admin";
}

function normalizeHostname(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

function resolveBaseDomain(envLike: unknown): string {
  const fromEnvValue = envLike && typeof envLike === "object"
    ? Reflect.get(envLike, "DRAKO_BASE_DOMAIN")
    : undefined;
  const fromEnv = typeof fromEnvValue === "string" ? fromEnvValue.trim() : "";
  return fromEnv.length > 0 ? fromEnv.toLowerCase() : "drako.systems";
}

async function validateDomainEntitlement(params: {
  tenantId: string;
  env: ReturnType<typeof resolveEnv>;
  blueprint: SaasBlueprintDraft;
  entitlements: {
    hasVerifiedSubscription: boolean;
    subscriptionStatus: string | null;
  };
}): Promise<{ ok: true } | { ok: false; code: "DOMAIN_PLAN_NOT_ALLOWED" | "DOMAIN_ALREADY_EXISTS"; message: string; status: number }> {
  const baseDomain = resolveBaseDomain(params.env);
  const domainCandidate = normalizeHostname(
    params.blueprint.provisioning?.domains.customDomainRequested
      ?? `${params.blueprint.proposedSubdomain || params.blueprint.proposedSlug}.${baseDomain}`,
  );

  const tenantPlanRow = await queryOne<{ plan: string | null }>(
    "SELECT plan FROM tenants WHERE id = ? LIMIT 1",
    params.tenantId,
  );
  const tenantPlan = (tenantPlanRow?.plan ?? "").trim().toLowerCase();
  const planBlocked = tenantPlan === "free" || tenantPlan === "starter" || tenantPlan === "locked";
  const activeSubscription = ["active", "trialing"].includes((params.entitlements.subscriptionStatus ?? "").trim().toLowerCase());

  if (planBlocked || !params.entitlements.hasVerifiedSubscription || !activeSubscription) {
    return {
      ok: false,
      code: "DOMAIN_PLAN_NOT_ALLOWED",
      message: "Domain provisioning requires eligible plan and active verified subscription.",
      status: 403,
    };
  }

  const existingDomain = await queryOne<{ id: string }>(
    "SELECT id FROM saas_domains WHERE lower(domain) = lower(?) LIMIT 1",
    domainCandidate,
  );

  if (existingDomain) {
    return {
      ok: false,
      code: "DOMAIN_ALREADY_EXISTS",
      message: "Domain is already in use.",
      status: 409,
    };
  }

  return { ok: true };
}

export async function POST(req: NextRequest) {
  const fallbackCorrelationId = globalThis.crypto?.randomUUID?.() ?? `create_saas_${Date.now()}`;
  try {
    ensureDatabase();

    const session = await extractSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ ok: false, code: "SESSION_REQUIRED", message: "Owner session is required." }, { status: 401 });
    }

    const access = await authorizeSaasAccess(session, req);
    if (!access.authorized) {
      const status = access.error === "UNAUTHORIZED" ? 401 : 403;
      return NextResponse.json(
        { ok: false, code: "OWNER_ACCESS_DENIED", message: access.error ?? "FORBIDDEN" },
        { status },
      );
    }

    if (!isOwnerRole(session.role)) {
      return NextResponse.json(
        { ok: false, code: "OWNER_ROLE_REQUIRED", message: "Only owner-level roles can create SaaS." },
        { status: 403 },
      );
    }

    const ownerRow = await queryOne<{ id: string }>(
      "SELECT id FROM owners WHERE tenant_id = ? ORDER BY created_at ASC LIMIT 1",
      session.tenantId,
    );
    if (!ownerRow) {
      return NextResponse.json(
        { ok: false, code: "OWNER_CONTEXT_REQUIRED", message: "Owner context is missing for this tenant." },
        { status: 403 },
      );
    }

    const rawBody = await req.json().catch(() => null);
    const payload = createSaasRequestSchema.parse(rawBody ?? {});
    const blueprint = normalizeBlueprint({ tenantId: session.tenantId, payload });
    const correlationId = payload.correlationId
      ?? req.headers.get("x-correlation-id")
      ?? fallbackCorrelationId;
    const requestHash = await hashCreateRequest({
      tenantId: session.tenantId,
      blueprint,
      dryRun: payload.dryRun ?? false,
    });
    const idempotencyKey =
      payload.idempotencyKey?.trim()
      || `create_saas:${session.tenantId}:${blueprint.proposedSlug}:${requestHash}`;

    const existingJob = await queryOne<{ job_id: string; current_state: string; entity_id: string }>(
      "SELECT job_id, current_state, entity_id FROM provisioning_jobs WHERE idempotency_key = ? AND tenant_id = ? LIMIT 1",
      idempotencyKey,
      session.tenantId,
    );

    if (existingJob) {
      await recordCampamentoEvent({
        tenantId: session.tenantId,
        saasId: existingJob.entity_id,
        type: "provision.saas_factory.job.reused",
        severity: "INFO",
        source: "OWNER_API",
        message: "SaaS provisioning request matched existing idempotent job.",
        metadata: {
          jobId: existingJob.job_id,
          idempotencyKey,
          slug: blueprint.proposedSlug,
          dryRun: payload.dryRun ?? false,
        },
        correlationId,
      });

      return NextResponse.json(
        {
          ok: true,
          canonical: true,
          queued: false,
          jobId: existingJob.job_id,
          state: existingJob.current_state,
          saasId: existingJob.entity_id,
          correlationId,
          idempotencyKey,
        },
        { status: 200 },
      );
    }

    const factoryBilling = await getFactoryBillingState(session.tenantId);
    await assertFactoryQuota(session.tenantId, factoryBilling);

    const env = resolveEnv();
    if (!env?.PROVISIONING_QUEUE) {
      return NextResponse.json(
        { ok: false, code: "PROVISIONING_QUEUE_MISSING", message: "PROVISIONING_QUEUE binding is required." },
        { status: 503 },
      );
    }

    if (!factoryBilling.eligibleToCreate) {
      return NextResponse.json(
        {
          ok: false,
          code: "PLAN_REQUIRED",
          message: "Active subscription with SaaS Factory entitlement is required to create SaaS.",
        },
        { status: 403 },
      );
    }

    const domainGate = await validateDomainEntitlement({
      tenantId: session.tenantId,
      env,
      blueprint,
      entitlements: {
        hasVerifiedSubscription: factoryBilling.hasVerifiedSubscription,
        subscriptionStatus: factoryBilling.subscriptionStatus,
      },
    });
    if (!domainGate.ok) {
      return NextResponse.json(
        { ok: false, code: domainGate.code, message: domainGate.message },
        { status: domainGate.status },
      );
    }

    const entityId = globalThis.crypto?.randomUUID?.() ?? `saas_${Date.now()}`;
    const jobId = `job_${cleanJobIdSegment(idempotencyKey)}`;

    const job = await JobRunner.ensureJob({
      jobId,
      type: "SAAS_PROVISIONING",
      entityId,
      correlationId,
      idempotencyKey,
      initialState: "CREATED",
      payload: blueprint,
      tenantId: session.tenantId,
      queue: env.PROVISIONING_QUEUE,
    });

    await recordCampamentoEvent({
      tenantId: session.tenantId,
      saasId: job.entityId,
      type: job.created ? "provision.saas_factory.job.queued" : "provision.saas_factory.job.reused",
      severity: "INFO",
      source: "OWNER_API",
      message: job.created
        ? "SaaS provisioning job queued in canonical factory flow."
        : "SaaS provisioning request matched existing idempotent job.",
      metadata: {
        jobId: job.jobId,
        idempotencyKey,
        slug: blueprint.proposedSlug,
        dryRun: payload.dryRun ?? false,
      },
      correlationId,
    });

    return NextResponse.json(
      {
        ok: true,
        canonical: true,
        queued: job.created,
        jobId: job.jobId,
        state: job.state,
        saasId: job.entityId,
        correlationId,
        idempotencyKey,
      },
      { status: job.created ? 202 : 200 },
    );
  } catch (error: unknown) {
    if (error instanceof FactoryBillingError) {
      const status = error.code === "FACTORY_CONCURRENCY_LIMIT" ? 409 : 402;
      return NextResponse.json(
        { ok: false, error: error.code },
        { status },
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, code: "INVALID_CREATE_SAAS_PAYLOAD", message: "Invalid create SaaS payload.", details: error.issues },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message === "INVALID_SAAS_INPUT") {
      return NextResponse.json(
        { ok: false, code: "INVALID_SAAS_INPUT", message: "name/slug or blueprintDraft.proposedSlug/saasName are required." },
        { status: 400 },
      );
    }

    console.error("OWNER_CREATE_SAAS_CANONICAL_ERROR", error);
    return NextResponse.json(
      { ok: false, code: "INTERNAL_ERROR", correlationId: fallbackCorrelationId },
      { status: 500 },
    );
  }
}
