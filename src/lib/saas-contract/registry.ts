import type {
  ResolvedSaasPlatform,
  SaasPlatformBootstrap,
  SaasPlatformDefinition,
} from "@/lib/saas-contract/types";

const saasPlatformDefinitions = new Map<string, SaasPlatformDefinition>();
const saasPlatformBootstraps = new Map<string, SaasPlatformBootstrap>();

function normalizeSaasId(saasId: string): string {
  return saasId.trim().toLowerCase();
}

export function defineSaasPlatform(definition: SaasPlatformDefinition): SaasPlatformDefinition {
  return definition;
}

export function defineSaasPlatformBootstrap(bootstrap: SaasPlatformBootstrap): SaasPlatformBootstrap {
  return bootstrap;
}

export function registerSaasPlatformDefinition(definition: SaasPlatformDefinition): void {
  const key = normalizeSaasId(definition.saasId);
  if (!key) {
    throw new Error("SAAS_PLATFORM_ID_REQUIRED");
  }

  saasPlatformDefinitions.set(key, definition);
}

export function registerSaasPlatformBootstrap(bootstrap: SaasPlatformBootstrap): void {
  const key = normalizeSaasId(bootstrap.saasId);
  if (!key) {
    throw new Error("SAAS_PLATFORM_ID_REQUIRED");
  }

  saasPlatformBootstraps.set(key, bootstrap);
}

export function getSaasPlatformDefinitionByKey(saasId: string): SaasPlatformDefinition | null {
  const key = normalizeSaasId(saasId);
  return saasPlatformDefinitions.get(key) ?? null;
}

export function getSaasPlatformBootstrapByKey(saasId: string): SaasPlatformBootstrap | null {
  const key = normalizeSaasId(saasId);
  return saasPlatformBootstraps.get(key) ?? null;
}

export function resolveSaasPlatformDefinition(saasId: string): SaasPlatformDefinition | null {
  const normalized = normalizeSaasId(saasId);
  for (const definition of saasPlatformDefinitions.values()) {
    if (definition.matchesSaasId?.(normalized) ?? normalizeSaasId(definition.saasId) === normalized) {
      return definition;
    }
  }

  return null;
}

export function resolveSaasPlatformBootstrap(saasId: string): SaasPlatformBootstrap | null {
  const normalized = normalizeSaasId(saasId);
  for (const bootstrap of saasPlatformBootstraps.values()) {
    const definition = saasPlatformDefinitions.get(normalizeSaasId(bootstrap.saasId)) ?? null;
    if (definition && (definition.matchesSaasId?.(normalized) ?? normalizeSaasId(definition.saasId) === normalized)) {
      return bootstrap;
    }
    if (normalizeSaasId(bootstrap.saasId) === normalized) {
      return bootstrap;
    }
  }

  return null;
}

export function resolveSaasPlatform(saasId: string): ResolvedSaasPlatform | null {
  const definition = resolveSaasPlatformDefinition(saasId);
  if (!definition) {
    return null;
  }

  const bootstrap = getSaasPlatformBootstrapByKey(definition.saasId);
  return { definition, bootstrap };
}

export function listSaasPlatformDefinitions(): SaasPlatformDefinition[] {
  return [...saasPlatformDefinitions.values()];
}

export function listSaasPlatformBootstraps(): SaasPlatformBootstrap[] {
  return [...saasPlatformBootstraps.values()];
}
