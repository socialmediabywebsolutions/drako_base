import {
  listSaasPlatformBootstraps,
} from "@/lib/saas-contract";
import {
  openObservabilityIncident,
  recordObservabilityActivity,
  resolveObservabilityIncidentsByScope,
} from "@/lib/observability-core";
import { createSignal, type CrossSaasSignal, type EmitSignalInput } from "@/lib/execution/signals";

const PROCESSED_SIGNAL_TTL_MS = 10 * 60 * 1000;
const MAX_SIGNAL_CHAIN_DEPTH = 4;
const processedSignals = new Map<string, { processedAt: number; chainDepth: number }>();

function cleanupProcessedSignals(now: number): void {
  for (const [signalId, entry] of processedSignals.entries()) {
    if (now - entry.processedAt > PROCESSED_SIGNAL_TTL_MS) {
      processedSignals.delete(signalId);
    }
  }
}

function resolveSignalChainDepth(input: EmitSignalInput): number {
  if (typeof input.chainDepth === "number") {
    return input.chainDepth;
  }

  const correlationId = input.correlationId?.trim();
  if (!correlationId) {
    return 0;
  }

  const parent = processedSignals.get(correlationId);
  return parent ? parent.chainDepth + 1 : 1;
}

function getSignalTraceMetadata(signal: CrossSaasSignal): Record<string, unknown> {
  return {
    signalId: signal.signalId,
    correlationId: signal.correlationId ?? null,
    originSignalId: signal.correlationId ?? signal.signalId,
    chainDepth: signal.chainDepth,
  };
}

async function recordSignalActivity(params: {
  tenantId: string;
  saasId: string;
  sourceKey: string;
  activityType: string;
  status: "info" | "success" | "warning" | "error";
  summary: string;
  metadata?: Record<string, unknown> | null;
}) {
  try {
    await recordObservabilityActivity({
      tenantId: params.tenantId,
      saasId: params.saasId,
      sourceType: "saas",
      sourceKey: params.sourceKey,
      activityType: params.activityType,
      status: params.status,
      summary: params.summary,
      metadata: params.metadata ?? null,
    });
  } catch (error) {
    console.error("SIGNAL_BUS_ACTIVITY_ERROR", error);
  }
}

async function openSignalIncident(params: {
  tenantId: string;
  saasId: string;
  sourceKey: string;
  summary: string;
  details?: Record<string, unknown> | null;
}) {
  try {
    await openObservabilityIncident({
      tenantId: params.tenantId,
      saasId: params.saasId,
      sourceType: "saas",
      sourceKey: params.sourceKey,
      incidentType: "signal_handler_failed",
      severity: "medium",
      summary: params.summary,
      details: params.details ?? null,
    });
  } catch (error) {
    console.error("SIGNAL_BUS_INCIDENT_ERROR", error);
  }
}

async function resolveSignalIncidents(params: {
  tenantId: string;
  saasId: string;
  sourceKey: string;
}) {
  try {
    await resolveObservabilityIncidentsByScope({
      tenantId: params.tenantId,
      saasId: params.saasId,
      sourceType: "saas",
      sourceKey: params.sourceKey,
      incidentType: "signal_handler_failed",
    });
  } catch (error) {
    console.error("SIGNAL_BUS_RESOLVE_INCIDENT_ERROR", error);
  }
}

export async function emitSignal(input: EmitSignalInput): Promise<CrossSaasSignal> {
  const now = Date.now();
  cleanupProcessedSignals(now);
  const signal = createSignal({
    ...input,
    chainDepth: resolveSignalChainDepth(input),
  });

  if (processedSignals.has(signal.signalId)) {
    await recordSignalActivity({
      tenantId: signal.sourceTenantId,
      saasId: signal.sourceSaasId,
      sourceKey: signal.sourceSaasId,
      activityType: "signal_deduped",
      status: "warning",
      summary: `Signal ${signal.type} skipped because ${signal.signalId} was already processed.`,
      metadata: {
        ...getSignalTraceMetadata(signal),
        payload: signal.payload,
      },
    });
    return signal;
  }

  if (signal.chainDepth > MAX_SIGNAL_CHAIN_DEPTH) {
    await recordSignalActivity({
      tenantId: signal.sourceTenantId,
      saasId: signal.sourceSaasId,
      sourceKey: signal.sourceSaasId,
      activityType: "signal_dropped",
      status: "warning",
      summary: `Signal ${signal.type} dropped because chain depth ${signal.chainDepth} exceeded limit.`,
      metadata: {
        ...getSignalTraceMetadata(signal),
        payload: signal.payload,
      },
    });
    await openSignalIncident({
      tenantId: signal.sourceTenantId,
      saasId: signal.sourceSaasId,
      sourceKey: signal.sourceSaasId,
      summary: `Signal ${signal.type} exceeded chaining depth limit.`,
      details: {
        ...getSignalTraceMetadata(signal),
        maxChainDepth: MAX_SIGNAL_CHAIN_DEPTH,
      },
    });
    return signal;
  }

  processedSignals.set(signal.signalId, {
    processedAt: now,
    chainDepth: signal.chainDepth,
  });

  await recordSignalActivity({
    tenantId: signal.sourceTenantId,
    saasId: signal.sourceSaasId,
    sourceKey: signal.sourceSaasId,
    activityType: "signal_emitted",
    status: "info",
    summary: `Signal ${signal.type} emitted by ${signal.sourceSaasId}.`,
    metadata: {
      ...getSignalTraceMetadata(signal),
      payload: signal.payload,
    },
  });

  const bootstraps = listSaasPlatformBootstraps();
  for (const bootstrap of bootstraps) {
    const handler = bootstrap.signalHandlers?.[signal.type];
    if (!handler) {
      continue;
    }

    try {
      if (typeof handler !== "function") {
        throw new Error("SIGNAL_HANDLER_INVALID");
      }

      await handler({
        signal,
        targetTenantId: signal.sourceTenantId,
        targetSaasId: bootstrap.saasId,
      });

      await recordSignalActivity({
        tenantId: signal.sourceTenantId,
        saasId: bootstrap.saasId,
        sourceKey: bootstrap.saasId,
        activityType: "signal_handled",
        status: "success",
        summary: `Signal ${signal.type} handled by ${bootstrap.saasId}.`,
        metadata: {
          ...getSignalTraceMetadata(signal),
          sourceSaasId: signal.sourceSaasId,
          targetSaasId: bootstrap.saasId,
        },
      });
      await resolveSignalIncidents({
        tenantId: signal.sourceTenantId,
        saasId: bootstrap.saasId,
        sourceKey: bootstrap.saasId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Signal handler failed";
      await recordSignalActivity({
        tenantId: signal.sourceTenantId,
        saasId: bootstrap.saasId,
        sourceKey: bootstrap.saasId,
        activityType: "signal_handled",
        status: "error",
        summary: `Signal ${signal.type} failed in ${bootstrap.saasId}: ${message}`,
        metadata: {
          ...getSignalTraceMetadata(signal),
          sourceSaasId: signal.sourceSaasId,
          targetSaasId: bootstrap.saasId,
        },
      });
      await openSignalIncident({
        tenantId: signal.sourceTenantId,
        saasId: bootstrap.saasId,
        sourceKey: bootstrap.saasId,
        summary: `Signal ${signal.type} failed in ${bootstrap.saasId}.`,
        details: {
          ...getSignalTraceMetadata(signal),
          sourceSaasId: signal.sourceSaasId,
          errorMessage: message,
        },
      });
    }
  }

  return signal;
}
