import {
  resolvePlatformBootstrapDefinition,
  runPlatformBootstrap,
} from "@/lib/campamento-base/platform-bootstrap-loader";

export type FactoryOrchestratorRuntimeEffect =
  | "RESOLVE_PLATFORM"
  | "RUN_BOOTSTRAP"
  | "REGISTER_AUTOMATION"
  | "ENSURE_INTEGRATION"
  | "SKIP_LEGACY_RUNTIME";

export type FactoryOrchestratorRuntimeParityInput = {
  saasId: string;
  tenantId?: string;
  requestedBy?: string;
};

export type FactoryOrchestratorRuntimeParityResult = {
  saasId: string;
  tenantId: string | null;
  platformResolved: boolean;
  bootstrapStatus: "READY" | "SKIPPED" | "FAILED";
  success: boolean;
  effects: FactoryOrchestratorRuntimeEffect[];
  message: string;
};

const EMPTY_SAAS_ID_MESSAGE = "Factory orchestrator runtime parity requires a non-empty saasId.";
const UNKNOWN_SAAS_ID_MESSAGE = "Neutral platform definition not found for factory runtime parity.";

function normalizeSaasId(saasId: string): string {
  return saasId.trim().toLowerCase();
}

export async function planFactoryOrchestratorRuntimeParity(
  input: FactoryOrchestratorRuntimeParityInput,
): Promise<FactoryOrchestratorRuntimeParityResult> {
  const tenantId = input.tenantId ?? null;
  const normalizedSaasId = normalizeSaasId(input.saasId);
  const effects: FactoryOrchestratorRuntimeEffect[] = ["RESOLVE_PLATFORM"];

  if (!normalizedSaasId) {
    return {
      saasId: normalizedSaasId,
      tenantId,
      platformResolved: false,
      bootstrapStatus: "FAILED",
      success: false,
      effects,
      message: EMPTY_SAAS_ID_MESSAGE,
    };
  }

  const resolvedDefinition = resolvePlatformBootstrapDefinition(normalizedSaasId);
  if (!resolvedDefinition) {
    return {
      saasId: normalizedSaasId,
      tenantId,
      platformResolved: false,
      bootstrapStatus: "FAILED",
      success: false,
      effects,
      message: UNKNOWN_SAAS_ID_MESSAGE,
    };
  }

  const bootstrapResult = await runPlatformBootstrap(normalizedSaasId);
  effects.push("RUN_BOOTSTRAP");

  if (bootstrapResult.status === "READY") {
    effects.push("REGISTER_AUTOMATION", "ENSURE_INTEGRATION");
    return {
      saasId: normalizedSaasId,
      tenantId,
      platformResolved: true,
      bootstrapStatus: "READY",
      success: true,
      effects,
      message: bootstrapResult.message,
    };
  }

  effects.push("SKIP_LEGACY_RUNTIME");
  return {
    saasId: normalizedSaasId,
    tenantId,
    platformResolved: true,
    bootstrapStatus: bootstrapResult.status,
    success: false,
    effects,
    message: bootstrapResult.message,
  };
}
