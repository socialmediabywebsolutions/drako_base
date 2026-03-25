import {
  getSaasPlatformBootstrapByKey,
  getSaasPlatformDefinitionByKey,
  registerSaasPlatformDefinition,
  registerSaasPlatformBootstrap,
  resolveSaasPlatform,
} from "@/lib/saas-contract";

let defaultsRegistered = false;

async function ensureDefaultPlatformDefinitionsRegistered() {
  if (defaultsRegistered) {
    return;
  }

  const socialflowModule = await import("@/lib/campobase/socialflow-platform");
  const clinicModule = await import("@/lib/campobase/clinic-platform");
  const taskOpsModule = await import("@/lib/campobase/taskops-platform");

  registerSaasPlatformDefinition(socialflowModule.socialFlowPlatformDefinition);
  registerSaasPlatformBootstrap(socialflowModule.socialFlowPlatformBootstrap);
  registerSaasPlatformDefinition(clinicModule.clinicPlatformDefinition);
  registerSaasPlatformBootstrap(clinicModule.clinicPlatformBootstrap);
  registerSaasPlatformDefinition(taskOpsModule.taskOpsPlatformDefinition);
  registerSaasPlatformBootstrap(taskOpsModule.taskOpsPlatformBootstrap);

  defaultsRegistered = true;
}

export async function registerSocialFlowPlatform(tenantId: string, saasId: string): Promise<void> {
  await ensureDefaultPlatformDefinitionsRegistered();
  const definition = getSaasPlatformDefinitionByKey("socialflow");
  const bootstrap = getSaasPlatformBootstrapByKey("socialflow");
  if (!definition || !(definition.matchesSaasId?.(saasId.trim().toLowerCase()) ?? definition.saasId === saasId.trim().toLowerCase())) {
    return;
  }

  await bootstrap?.connect({ tenantId, saasId });
}

export async function registerClinicPlatform(tenantId: string, saasId: string): Promise<void> {
  await ensureDefaultPlatformDefinitionsRegistered();
  const definition = getSaasPlatformDefinitionByKey("clinic");
  const bootstrap = getSaasPlatformBootstrapByKey("clinic");
  if (!definition || !(definition.matchesSaasId?.(saasId.trim().toLowerCase()) ?? definition.saasId === saasId.trim().toLowerCase())) {
    return;
  }

  await bootstrap?.connect({ tenantId, saasId });
}

export async function registerTaskOpsPlatform(tenantId: string, saasId: string): Promise<void> {
  await ensureDefaultPlatformDefinitionsRegistered();
  const definition = getSaasPlatformDefinitionByKey("taskops");
  const bootstrap = getSaasPlatformBootstrapByKey("taskops");
  if (!definition || !(definition.matchesSaasId?.(saasId.trim().toLowerCase()) ?? definition.saasId === saasId.trim().toLowerCase())) {
    return;
  }

  await bootstrap?.connect({ tenantId, saasId });
}

export async function loadPlatformForSaas(tenantId: string, saasId: string): Promise<void> {
  await ensureDefaultPlatformDefinitionsRegistered();
  const resolved = resolveSaasPlatform(saasId);
  await resolved?.bootstrap?.connect({ tenantId, saasId });
}
