import runtimeDeployContract from "../../runtime-deploy-contract.json";

type RuntimeDeployContract = typeof runtimeDeployContract;

export const socialFlowRuntimeDeployContract: RuntimeDeployContract = runtimeDeployContract;

export type SocialFlowRuntimeStringEnvKey =
  | (typeof socialFlowRuntimeDeployContract.runtimeVars.required)[number]
  | (typeof socialFlowRuntimeDeployContract.runtimeVars.optional)[number]
  | (typeof socialFlowRuntimeDeployContract.runtimeSecrets.required)[number]
  | (typeof socialFlowRuntimeDeployContract.runtimeSecrets.optional)[number];

export type SocialFlowRuntimeBindingKey =
  | (typeof socialFlowRuntimeDeployContract.bindings.d1)[number]
  | (typeof socialFlowRuntimeDeployContract.bindings.kv)[number]
  | (typeof socialFlowRuntimeDeployContract.bindings.r2)[number]
  | (typeof socialFlowRuntimeDeployContract.bindings.queues)[number]
  | (typeof socialFlowRuntimeDeployContract.bindings.services)[number]
  | (typeof socialFlowRuntimeDeployContract.bindings.ai)[number];

export function getSocialFlowRuntimeContractVersion() {
  return socialFlowRuntimeDeployContract.contractVersion;
}

export function getSocialFlowRuntimeTarget() {
  return socialFlowRuntimeDeployContract.workerIdentities.deployable.workerName;
}

export function getSocialFlowRuntimeActivationState() {
  return socialFlowRuntimeDeployContract.activationState;
}

export function getSocialFlowRuntimeCookieNames() {
  return {
    canonical: socialFlowRuntimeDeployContract.auth.cookieName,
    local: socialFlowRuntimeDeployContract.auth.localCookieName,
  };
}

export function isSocialFlowRuntimeStringEnvKey(value: string): value is SocialFlowRuntimeStringEnvKey {
  const allKeys = new Set<string>([
    ...socialFlowRuntimeDeployContract.runtimeVars.required,
    ...socialFlowRuntimeDeployContract.runtimeVars.optional,
    ...socialFlowRuntimeDeployContract.runtimeSecrets.required,
    ...socialFlowRuntimeDeployContract.runtimeSecrets.optional,
  ]);
  return allKeys.has(value);
}

export function isSocialFlowRuntimeBindingKey(value: string): value is SocialFlowRuntimeBindingKey {
  const allKeys = new Set<string>([
    ...socialFlowRuntimeDeployContract.bindings.d1,
    ...socialFlowRuntimeDeployContract.bindings.kv,
    ...socialFlowRuntimeDeployContract.bindings.r2,
    ...socialFlowRuntimeDeployContract.bindings.queues,
    ...socialFlowRuntimeDeployContract.bindings.services,
    ...socialFlowRuntimeDeployContract.bindings.ai,
  ]);
  return allKeys.has(value);
}
