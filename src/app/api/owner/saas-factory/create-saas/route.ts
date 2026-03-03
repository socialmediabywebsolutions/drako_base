
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

    const env = resolveEnv();
    if (!env?.PROVISIONING_QUEUE) {
      return NextResponse.json(
        { ok: false, code: "PROVISIONING_QUEUE_MISSING", message: "PROVISIONING_QUEUE binding is required." },
        { status: 503 },
      );
    }

    const correlationId = payload.correlationId
      ?? req.headers.get("x-correlation-id")
      ?? fallbackCorrelationId;
    const idempotencyKey = payload.idempotencyKey ?? `create_saas:${session.tenantId}:${blueprint.proposedSlug}`;
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
