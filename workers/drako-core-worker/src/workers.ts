import { buildGovernanceEventSpecsV1, publishGlobalEvents } from "./publishers";
import {
  insertAuditLogs,
  insertGovernanceEvents,
  upsertAgentsRegistry,
  upsertLoopRuns,
  upsertSaasesRegistry,
} from "./repositories";
import { buildJsonResponses, readJsonBodies, readRequestIds, readRequestIps } from "./responses";
import type { AuditStatuses, DrkoCoreEnv, GovernanceEventSpecsV1 } from "./types";
import {
  validateAgentsRegistryPayloads,
  validateAuditLogsPayloads,
  validateGovernanceEventSpecsV1,
  validateLoopRunsPayloads,
  validateSaasesRegistryPayloads,
} from "./validations";

const CORE_SOURCE_NAME = "drako-core-worker";

function detectPagesExecutions(env: DrkoCoreEnv): boolean {
  return env.CF_PAGES === "1" || Boolean(env.CF_PAGES_ENVIRONMENT) || Boolean(env.CF_PAGES_URL);
}

function readActorTypes(request: Request): string {
  return request.headers.get("x-drko-actor-type") ?? "system";
}

function readActorIds(request: Request): string | null {
  return request.headers.get("x-drko-actor-id") ?? null;
}

function readTraceIds(request: Request): string {
  return request.headers.get("x-drko-trace-id") ?? request.headers.get("x-trace-id") ?? crypto.randomUUID();
}

function readCorrelationIds(request: Request, traceId: string): string {
  return request.headers.get("x-drko-correlation-id") ?? request.headers.get("x-correlation-id") ?? traceId;
}

function readEventActorIds(request: Request, preferredActorId?: string | null): string {
  const actorId = preferredActorId?.trim() || readActorIds(request)?.trim() || "system";
  return actorId;
}

async function writeCriticalAuditLogs(params: {
  request: Request;
  env: DrkoCoreEnv;
  action: string;
  targetType: string;
  targetId: string | null;
  saasSlug: string | null;
  tenantId: string | null;
  actorType?: string | null;
  actorId?: string | null;
  statusName?: AuditStatuses;
  metadata: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  return insertAuditLogs(params.env.DRKO_HOLDING_DB, {
    logId: crypto.randomUUID(),
    actorType: params.actorType?.trim() || readActorTypes(params.request),
    actorId: params.actorId ?? readActorIds(params.request),
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    saasSlug: params.saasSlug,
    tenantId: params.tenantId,
    statusName: params.statusName ?? "success",
    requestId: readRequestIds(params.request),
    ipAddress: readRequestIps(params.request),
    userAgent: params.request.headers.get("user-agent"),
    metadata: JSON.stringify(params.metadata),
  });
}

async function handleRegistrySaases(request: Request, env: DrkoCoreEnv): Promise<Response> {
  const body = await readJsonBodies(request);
  const parsed = validateSaasesRegistryPayloads(body);
  if (parsed.ok === false) {
    return buildJsonResponses({ ok: false, errorCode: "INVALID_PAYLOADS", errorMessage: parsed.errorMessage }, 400);
  }

  const record = await upsertSaasesRegistry(env.DRKO_HOLDING_DB, parsed.value);

  const traceId = readTraceIds(request);
  const correlationId = readCorrelationIds(request, traceId);
  const actorType = readActorTypes(request);
  const actorId = readEventActorIds(request);

  const event = buildGovernanceEventSpecsV1({
    eventType: "registry.saases.upserted",
    source: CORE_SOURCE_NAME,
    saasSlug: parsed.value.saasSlug,
    tenantId: parsed.value.ownerTenantId,
    actorType,
    actorId,
    severity: "info",
    traceId,
    correlationId,
    metadata: {
      saas_id: parsed.value.saasId,
      status_name: parsed.value.statusName,
      domain_name: parsed.value.domainName,
      worker_name: parsed.value.workerName,
    },
  });
  await publishGlobalEvents({ env, event });

  const auditRecord = await writeCriticalAuditLogs({
    request,
    env,
    action: "registry.saases.upserted",
    targetType: "saases_registry",
    targetId: parsed.value.saasId,
    saasSlug: parsed.value.saasSlug,
    tenantId: parsed.value.ownerTenantId,
    actorType,
    actorId,
    metadata: {
      statusName: parsed.value.statusName,
      domainName: parsed.value.domainName,
      workerName: parsed.value.workerName,
      eventId: event.event_id,
      traceId: event.trace_id,
      correlationId: event.correlation_id,
    },
  });

  return buildJsonResponses({ ok: true, record, event, auditRecord });
}

async function handleRegistryAgents(request: Request, env: DrkoCoreEnv): Promise<Response> {
  const body = await readJsonBodies(request);
  const parsed = validateAgentsRegistryPayloads(body);
  if (parsed.ok === false) {
    return buildJsonResponses({ ok: false, errorCode: "INVALID_PAYLOADS", errorMessage: parsed.errorMessage }, 400);
  }

  const record = await upsertAgentsRegistry(env.DRKO_HOLDING_DB, parsed.value);

  const traceId = readTraceIds(request);
  const correlationId = readCorrelationIds(request, traceId);
  const actorType = readActorTypes(request);
  const actorId = readEventActorIds(request);

  const event = buildGovernanceEventSpecsV1({
    eventType: "registry.agents.upserted",
    source: CORE_SOURCE_NAME,
    saasSlug: parsed.value.saasSlug,
    tenantId: null,
    actorType,
    actorId,
    severity: "info",
    traceId,
    correlationId,
    metadata: {
      agent_id: parsed.value.agentId,
      role_name: parsed.value.roleName,
      model_name: parsed.value.modelName,
      status_name: parsed.value.statusName,
    },
  });
  await publishGlobalEvents({ env, event });

  const auditRecord = await writeCriticalAuditLogs({
    request,
    env,
    action: "registry.agents.upserted",
    targetType: "agents_registry",
    targetId: parsed.value.agentId,
    saasSlug: parsed.value.saasSlug,
    tenantId: null,
    actorType,
    actorId,
    metadata: {
      roleName: parsed.value.roleName,
      modelName: parsed.value.modelName,
      statusName: parsed.value.statusName,
      eventId: event.event_id,
      traceId: event.trace_id,
      correlationId: event.correlation_id,
    },
  });

  return buildJsonResponses({ ok: true, record, event, auditRecord });
}

async function handleGovernanceEvents(request: Request, env: DrkoCoreEnv): Promise<Response> {
  const body = await readJsonBodies(request);
  const parsed = validateGovernanceEventSpecsV1(body);
  if (parsed.ok === false) {
    return buildJsonResponses({ ok: false, errorCode: "INVALID_PAYLOADS", errorMessage: parsed.errorMessage }, 400);
  }

  const governanceEvent = parsed.value;
  const record = await insertGovernanceEvents(env.DRKO_HOLDING_DB, governanceEvent);
  const event = await publishGlobalEvents({ env, event: governanceEvent });

  const auditRecord = await writeCriticalAuditLogs({
    request,
    env,
    action: "governance.events.recorded",
    targetType: "governance_events",
    targetId: governanceEvent.event_id,
    saasSlug: governanceEvent.saas_slug,
    tenantId: governanceEvent.tenant_id,
    actorType: governanceEvent.actor_type,
    actorId: governanceEvent.actor_id,
    metadata: {
      eventType: governanceEvent.event_type,
      severity: governanceEvent.severity,
      source: governanceEvent.source,
      traceId: governanceEvent.trace_id,
      correlationId: governanceEvent.correlation_id,
      schemaVersion: governanceEvent.schema_version,
    },
  });

  return buildJsonResponses({ ok: true, record, event, auditRecord });
}

async function handleAuditLogs(request: Request, env: DrkoCoreEnv): Promise<Response> {
  const body = await readJsonBodies(request);
  const parsed = validateAuditLogsPayloads(body);
  if (parsed.ok === false) {
    return buildJsonResponses({ ok: false, errorCode: "INVALID_PAYLOADS", errorMessage: parsed.errorMessage }, 400);
  }

  const requestId = readRequestIds(request);
  const requestIp = readRequestIps(request);
  const userAgent = request.headers.get("user-agent");

  const record = await insertAuditLogs(env.DRKO_HOLDING_DB, {
    ...parsed.value,
    actorType: parsed.value.actorType || readActorTypes(request),
    requestId: parsed.value.requestId ?? requestId,
    ipAddress: parsed.value.ipAddress ?? requestIp,
    userAgent: parsed.value.userAgent ?? userAgent,
  });

  const traceId = readTraceIds(request);
  const correlationId = readCorrelationIds(request, traceId);
  const actorType = parsed.value.actorType || readActorTypes(request);
  const actorId = parsed.value.actorId ?? readEventActorIds(request);

  const event = buildGovernanceEventSpecsV1({
    eventType: "audit.logs.recorded",
    source: CORE_SOURCE_NAME,
    saasSlug: parsed.value.saasSlug,
    tenantId: parsed.value.tenantId,
    actorType,
    actorId,
    severity: parsed.value.statusName === "failure" ? "error" : "info",
    traceId,
    correlationId,
    metadata: {
      log_id: parsed.value.logId,
      action: parsed.value.action,
      status_name: parsed.value.statusName,
      request_id: requestId,
    },
  });
  await publishGlobalEvents({ env, event });

  return buildJsonResponses({ ok: true, record, event });
}

async function handleLoopRuns(request: Request, env: DrkoCoreEnv): Promise<Response> {
  const body = await readJsonBodies(request);
  const parsed = validateLoopRunsPayloads(body);
  if (parsed.ok === false) {
    return buildJsonResponses({ ok: false, errorCode: "INVALID_PAYLOADS", errorMessage: parsed.errorMessage }, 400);
  }

  const record = await upsertLoopRuns(env.DRKO_HOLDING_DB, {
    ...parsed.value,
    loopName: parsed.value.loopName || env.DRKO_LOOP_NAME || "ANALYZE_OPTIMIZE_SCALE",
  });

  const traceId = readTraceIds(request);
  const correlationId = readCorrelationIds(request, traceId);
  const actorType = readActorTypes(request);
  const actorId = readEventActorIds(request);

  const event = buildGovernanceEventSpecsV1({
    eventType: "loop.runs.upserted",
    source: CORE_SOURCE_NAME,
    saasSlug: parsed.value.saasSlug,
    tenantId: parsed.value.tenantId,
    actorType,
    actorId,
    severity: parsed.value.statusName === "failed" ? "error" : "info",
    traceId,
    correlationId,
    metadata: {
      run_id: parsed.value.runId,
      phase_name: parsed.value.phaseName,
      status_name: parsed.value.statusName,
      loop_name: parsed.value.loopName,
    },
  });
  await publishGlobalEvents({ env, event });

  const auditRecord = await writeCriticalAuditLogs({
    request,
    env,
    action: "loop.runs.upserted",
    targetType: "analyze_optimize_scale_runs",
    targetId: parsed.value.runId,
    saasSlug: parsed.value.saasSlug,
    tenantId: parsed.value.tenantId,
    actorType,
    actorId,
    metadata: {
      phaseName: parsed.value.phaseName,
      statusName: parsed.value.statusName,
      loopName: parsed.value.loopName,
      eventId: event.event_id,
      traceId: event.trace_id,
      correlationId: event.correlation_id,
    },
  });

  return buildJsonResponses({ ok: true, record, event, auditRecord });
}

export default {
  async fetch(request: Request, env: DrkoCoreEnv): Promise<Response> {
    try {
      if (detectPagesExecutions(env)) {
        return buildJsonResponses(
          {
            ok: false,
            errorCode: "WORKERS_ONLY_ENFORCEMENTS",
            message: "drako-core-worker must run on Workers runtime only.",
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
          workerName: CORE_SOURCE_NAME,
          context: env.DRKO_CORE_CONTEXT ?? "holding",
          loopName: env.DRKO_LOOP_NAME ?? "ANALYZE_OPTIMIZE_SCALE",
          build: {
            gitSha: env.GIT_SHA ?? "unknown",
            version: env.BUILD_VERSION ?? "1.0.0",
          },
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

      if (requestPathName === "/registry/saases") {
        return await handleRegistrySaases(request, env);
      }
      if (requestPathName === "/registry/agents") {
        return await handleRegistryAgents(request, env);
      }
      if (requestPathName === "/governance/events") {
        return await handleGovernanceEvents(request, env);
      }
      if (requestPathName === "/audit/logs") {
        return await handleAuditLogs(request, env);
      }
      if (requestPathName === "/loop/runs") {
        return await handleLoopRuns(request, env);
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
      const requestId = readRequestIds(request);
      return buildJsonResponses(
        {
          ok: false,
          errorCode: "INTERNAL_ERRORS",
          requestId,
          message: error instanceof Error ? error.message : "Unexpected error.",
        },
        500,
      );
    }
  },
};
