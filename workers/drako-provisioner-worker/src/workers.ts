import type { D1Database, KVNamespace, Queue } from "@cloudflare/workers-types";
import { readProvisioningDefaults, readSaasesRegistryBySlugs } from "./repositories";
import {
  buildProvisioningGovernanceEventSpecsV1,
  type GovernanceEventSpecsV1,
  validateGovernanceEventSpecsV1,
  validateProvisionSaasesApplyPayloads,
  validateProvisionSaasesPlanPayloads,
} from "./validations";

type DrkoProvisionerEnv = {
  DRKO_HOLDING_DB: D1Database;
  DRKO_GLOBAL_CONFIG: KVNamespace;
  DRKO_GLOBAL_EVENTS: Queue<GovernanceEventSpecsV1>;
  DRKO_CORE_WORKER_URL: string;
  DRKO_INTERNAL_TOKEN?: string;
  DRKO_PROVISIONER_CONTEXT?: string;
  WORKERS_ONLY_MODE?: string;
  CF_PAGES?: string;
  CF_PAGES_ENVIRONMENT?: string;
  CF_PAGES_URL?: string;
};

const PROVISIONER_SOURCE_NAME = "drako-provisioner-worker";

function detectPagesExecutions(env: DrkoProvisionerEnv): boolean {
  return env.CF_PAGES === "1" || Boolean(env.CF_PAGES_ENVIRONMENT) || Boolean(env.CF_PAGES_URL);
}

function buildJsonResponses(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function readJsonBodies(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return {};
    }
    return body as Record<string, unknown>;
  } catch {
    return {};
  }
}

function buildProvisioningPlans(params: {
  saasSlug: string;
  domainName: string;
  defaults: Record<string, unknown>;
}): Record<string, unknown> {
  const setupCost = Number(params.defaults.estimated_setup_major ?? 120);
  const monthlyCost = Number(params.defaults.estimated_monthly_base_major ?? 35);

  return {
    resources: {
      d1_database_name: `saas_${params.saasSlug}_prod_db`,
      kv_namespace_name: `saas_${params.saasSlug}_prod_cache`,
      r2_bucket_name: `saas-${params.saasSlug}-assets`,
      queue_name: `saas-${params.saasSlug}-events`,
      worker_name: `saas-${params.saasSlug}-prod`,
      domain_name: params.domainName,
    },
    costs: {
      estimated_setup_major: setupCost,
      estimated_monthly_base_major: monthlyCost,
      currency: "USD",
    },
    execution_mode: "intent_only",
  };
}

async function postCoreApis(params: {
  env: DrkoProvisionerEnv;
  pathName: "/registry/saases" | "/governance/events";
  payload: Record<string, unknown>;
  requestId: string;
}): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const baseUrl = String(params.env.DRKO_CORE_WORKER_URL ?? "").trim();
  if (!baseUrl) {
    throw new Error("Missing DRKO_CORE_WORKER_URL.");
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-drko-request-id": params.requestId,
  };

  if (params.env.DRKO_INTERNAL_TOKEN) {
    headers["x-drko-internal-token"] = params.env.DRKO_INTERNAL_TOKEN;
  }

  const response = await fetch(`${baseUrl}${params.pathName}`, {
    method: "POST",
    headers,
    body: JSON.stringify(params.payload),
  });

  const responseText = await response.text();
  let responseData: Record<string, unknown> = {};
  try {
    responseData = responseText ? (JSON.parse(responseText) as Record<string, unknown>) : {};
  } catch {
    responseData = { raw: responseText };
  }

  return { ok: response.ok, status: response.status, data: responseData };
}

async function handleProvisionSaasesPlan(request: Request, env: DrkoProvisionerEnv): Promise<Response> {
  const body = await readJsonBodies(request);
  const parsed = validateProvisionSaasesPlanPayloads(body);
  if (parsed.ok === false) {
    return buildJsonResponses({ ok: false, errorCode: "INVALID_PAYLOADS", errorMessage: parsed.errorMessage }, 400);
  }

  const defaults = await readProvisioningDefaults(env.DRKO_GLOBAL_CONFIG);
  const domainName = parsed.value.domainName ?? `${parsed.value.saasSlug}.drako.systems`;
  const plan = buildProvisioningPlans({
    saasSlug: parsed.value.saasSlug,
    domainName,
    defaults,
  });

  const event = buildProvisioningGovernanceEventSpecsV1({
    eventType: "provisioning.plan.created",
    source: PROVISIONER_SOURCE_NAME,
    saasSlug: parsed.value.saasSlug,
    tenantId: parsed.value.ownerTenantId,
    actorType: parsed.value.actorType,
    actorId: parsed.value.actorId,
    traceId: parsed.value.traceId,
    correlationId: parsed.value.correlationId,
    metadata: {
      saas_id: parsed.value.saasId,
      display_name: parsed.value.displayName,
      plan,
    },
  });

  const contractValidation = validateGovernanceEventSpecsV1(event as unknown as Record<string, unknown>);
  if (contractValidation.ok === false) {
    return buildJsonResponses(
      { ok: false, errorCode: "INVALID_GOVERNANCE_EVENTS", errorMessage: contractValidation.errorMessage },
      500,
    );
  }

  const requestId = crypto.randomUUID();
  const governanceResponse = await postCoreApis({
    env,
    pathName: "/governance/events",
    payload: event,
    requestId,
  });

  if (!governanceResponse.ok) {
    return buildJsonResponses(
      {
        ok: false,
        errorCode: "CORES_GOVERNANCE_REQUESTS_FAILED",
        status: governanceResponse.status,
        details: governanceResponse.data,
      },
      502,
    );
  }

  return buildJsonResponses({
    ok: true,
    mode: "dry-run",
    plan,
    governanceEvent: event,
    governanceAck: governanceResponse.data,
  });
}

async function handleProvisionSaasesApply(request: Request, env: DrkoProvisionerEnv): Promise<Response> {
  const body = await readJsonBodies(request);
  const parsed = validateProvisionSaasesApplyPayloads(body);
  if (parsed.ok === false) {
    return buildJsonResponses({ ok: false, errorCode: "INVALID_PAYLOADS", errorMessage: parsed.errorMessage }, 400);
  }

  const existingSaas = await readSaasesRegistryBySlugs(env.DRKO_HOLDING_DB, parsed.value.saasSlug);
  if (existingSaas) {
    return buildJsonResponses(
      {
        ok: false,
        errorCode: "SAASES_ALREADY_EXISTS",
        message: "The SaaS slug is already registered in holding registry.",
        existingSaas,
      },
      409,
    );
  }

  const defaults = await readProvisioningDefaults(env.DRKO_GLOBAL_CONFIG);
  const domainName = parsed.value.domainName ?? `${parsed.value.saasSlug}.drako.systems`;
  const plan = buildProvisioningPlans({
    saasSlug: parsed.value.saasSlug,
    domainName,
    defaults,
  });

  const requestId = crypto.randomUUID();
  const registryPayload = {
    saasId: parsed.value.saasId,
    saasSlug: parsed.value.saasSlug,
    displayName: parsed.value.displayName,
    statusName: "provisioning",
    ownerTenantId: parsed.value.ownerTenantId,
    domainName,
    workerName: parsed.value.workerName,
    databaseName: String((plan.resources as Record<string, unknown>).d1_database_name ?? ""),
    namespaceKey: String((plan.resources as Record<string, unknown>).kv_namespace_name ?? ""),
    metadata: {
      source: PROVISIONER_SOURCE_NAME,
      execution_mode: "intent_only",
      plan,
    },
  };

  const registryResponse = await postCoreApis({
    env,
    pathName: "/registry/saases",
    payload: registryPayload,
    requestId,
  });

  if (!registryResponse.ok) {
    return buildJsonResponses(
      {
        ok: false,
        errorCode: "CORES_REGISTRY_REQUESTS_FAILED",
        status: registryResponse.status,
        details: registryResponse.data,
      },
      502,
    );
  }

  const event = buildProvisioningGovernanceEventSpecsV1({
    eventType: "provisioning.apply.requested",
    source: PROVISIONER_SOURCE_NAME,
    saasSlug: parsed.value.saasSlug,
    tenantId: parsed.value.ownerTenantId,
    actorType: parsed.value.actorType,
    actorId: parsed.value.actorId,
    traceId: parsed.value.traceId,
    correlationId: parsed.value.correlationId,
    metadata: {
      saas_id: parsed.value.saasId,
      display_name: parsed.value.displayName,
      worker_name: parsed.value.workerName,
      domain_name: domainName,
      execution_mode: "intent_only",
      plan,
    },
  });

  const contractValidation = validateGovernanceEventSpecsV1(event as unknown as Record<string, unknown>);
  if (contractValidation.ok === false) {
    return buildJsonResponses(
      { ok: false, errorCode: "INVALID_GOVERNANCE_EVENTS", errorMessage: contractValidation.errorMessage },
      500,
    );
  }

  const governanceResponse = await postCoreApis({
    env,
    pathName: "/governance/events",
    payload: event,
    requestId,
  });

  if (!governanceResponse.ok) {
    return buildJsonResponses(
      {
        ok: false,
        errorCode: "CORES_GOVERNANCE_REQUESTS_FAILED",
        status: governanceResponse.status,
        details: governanceResponse.data,
      },
      502,
    );
  }

  return buildJsonResponses({
    ok: true,
    mode: "intent-only",
    registry: registryResponse.data,
    governance: governanceResponse.data,
    provisioningEvent: event,
    plan,
  });
}

export default {
  async fetch(request: Request, env: DrkoProvisionerEnv): Promise<Response> {
    try {
      if (detectPagesExecutions(env)) {
        return buildJsonResponses(
          {
            ok: false,
            errorCode: "WORKERS_ONLY_ENFORCEMENTS",
            message: "drako-provisioner-worker must run on Workers runtime only.",
          },
          503,
        );
      }

      const requestMethod = request.method.toUpperCase();
      const requestUrl = new URL(request.url);
      const requestPathName = requestUrl.pathname;

      if (requestMethod === "GET" && requestPathName === "/healths") {
        return buildJsonResponses({
          ok: true,
          workerName: PROVISIONER_SOURCE_NAME,
          context: env.DRKO_PROVISIONER_CONTEXT ?? "holding",
          workersOnly: true,
        });
      }

      if (requestMethod !== "POST") {
        return buildJsonResponses(
          {
            ok: false,
            errorCode: "METHODS_NOT_ALLOWEDS",
            method: requestMethod,
            pathName: requestPathName,
          },
          405,
        );
      }

      if (requestPathName === "/provision/saases/plan") {
        return handleProvisionSaasesPlan(request, env);
      }

      if (requestPathName === "/provision/saases/apply") {
        return handleProvisionSaasesApply(request, env);
      }

      return buildJsonResponses(
        {
          ok: false,
          errorCode: "ROUTINGS_NOT_FOUNDS",
          pathName: requestPathName,
        },
        404,
      );
    } catch (error) {
      return buildJsonResponses(
        {
          ok: false,
          errorCode: "INTERNAL_ERRORS",
          message: error instanceof Error ? error.message : "Unexpected error.",
        },
        500,
      );
    }
  },
};
