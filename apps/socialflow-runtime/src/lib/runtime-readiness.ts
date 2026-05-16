import { getSocialFlowRuntimeReadinessSnapshot } from "./runtime-env";
import { buildRuntimeMetadata } from "./runtime-observability";
import { socialFlowRuntimeDeployContract } from "./runtime-contract";

export function getSocialFlowRuntimeHealthSnapshot() {
  return {
    ok: true,
    metadata: buildRuntimeMetadata(),
    contract: {
      bindings: socialFlowRuntimeDeployContract.bindings,
      runtimeVars: socialFlowRuntimeDeployContract.runtimeVars,
      runtimeSecrets: socialFlowRuntimeDeployContract.runtimeSecrets,
      observability: socialFlowRuntimeDeployContract.observability,
    },
  };
}

export function getSocialFlowRuntimeReadinessReport() {
  const readiness = getSocialFlowRuntimeReadinessSnapshot();
  return {
    ...readiness,
    metadata: buildRuntimeMetadata(),
    blockers: [
      ...readiness.missingBindings.map((binding) => `binding:${binding}`),
      ...readiness.missingRequiredVars.map((entry) => `var:${entry}`),
      ...readiness.missingRequiredSecrets.map((entry) => `secret:${entry}`),
    ],
  };
}
