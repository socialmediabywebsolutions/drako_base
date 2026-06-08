import { socialFlowPlatformDefinition } from "@/lib/campamento-base/socialflow-platform";

export type PlatformBootstrapLoaderDefinition = {
  saasId: string;
  name: string;
  status?: string;
};

export type PlatformBootstrapLoaderResult = {
  saasId: string;
  success: boolean;
  status: "READY" | "SKIPPED" | "FAILED";
  message: string;
};

export type PlatformBootstrapLoaderRegistry = {
  definitions: PlatformBootstrapLoaderDefinition[];
};

const SOCIALFLOW_SAAS_ID = socialFlowPlatformDefinition.saasId.trim().toLowerCase();
const CLINIC_SAAS_ID = "clinic";
const TASKOPS_SAAS_ID = "taskops";

const SOCIALFLOW_DEFINITION: PlatformBootstrapLoaderDefinition = {
  saasId: SOCIALFLOW_SAAS_ID,
  name: socialFlowPlatformDefinition.displayName,
  status: "READY",
};

const CLINIC_DEFINITION: PlatformBootstrapLoaderDefinition = {
  saasId: CLINIC_SAAS_ID,
  name: "Clinic",
  status: "SKIPPED",
};

const TASKOPS_DEFINITION: PlatformBootstrapLoaderDefinition = {
  saasId: TASKOPS_SAAS_ID,
  name: "TaskOps",
  status: "SKIPPED",
};

export const PLATFORM_BOOTSTRAP_LOADER_REGISTRY: PlatformBootstrapLoaderRegistry = {
  definitions: [SOCIALFLOW_DEFINITION, CLINIC_DEFINITION, TASKOPS_DEFINITION],
};

function normalizeSaasId(saasId: string): string {
  return saasId.trim().toLowerCase();
}

function normalizeDefinitionStatus(status?: string): "READY" | "SKIPPED" | "FAILED" {
  if (status === "SKIPPED") {
    return "SKIPPED";
  }

  if (status === "FAILED") {
    return "FAILED";
  }

  return "READY";
}

function cloneRegistry(registry: PlatformBootstrapLoaderRegistry): PlatformBootstrapLoaderRegistry {
  return {
    definitions: registry.definitions.map((definition) => ({ ...definition })),
  };
}

function resolveKnownSaasId(saasId: string): string | null {
  if (!saasId) {
    return null;
  }

  if (saasId === SOCIALFLOW_SAAS_ID || saasId.includes(SOCIALFLOW_SAAS_ID)) {
    return SOCIALFLOW_SAAS_ID;
  }

  if (saasId === CLINIC_SAAS_ID || saasId.includes(CLINIC_SAAS_ID)) {
    return CLINIC_SAAS_ID;
  }

  if (saasId === TASKOPS_SAAS_ID || saasId.includes(TASKOPS_SAAS_ID)) {
    return TASKOPS_SAAS_ID;
  }

  return null;
}

function isSocialFlowSaasId(saasId: string): boolean {
  const normalizedSaasId = normalizeSaasId(saasId);
  if (!normalizedSaasId) {
    return false;
  }

  if (normalizedSaasId === SOCIALFLOW_SAAS_ID) {
    return true;
  }

  return socialFlowPlatformDefinition.matchesSaasId?.(normalizedSaasId) ?? false;
}

export function getPlatformBootstrapLoaderRegistry(): PlatformBootstrapLoaderRegistry {
  return cloneRegistry(PLATFORM_BOOTSTRAP_LOADER_REGISTRY);
}

export function listPlatformBootstrapDefinitions(): PlatformBootstrapLoaderDefinition[] {
  return getPlatformBootstrapLoaderRegistry().definitions;
}

export function resolvePlatformBootstrapDefinition(
  saasId: string,
): PlatformBootstrapLoaderDefinition | null {
  const normalizedSaasId = normalizeSaasId(saasId);
  if (!normalizedSaasId) {
    return null;
  }

  const resolvedKnownSaasId = resolveKnownSaasId(normalizedSaasId);

  for (const definition of getPlatformBootstrapLoaderRegistry().definitions) {
    if (definition.saasId === normalizedSaasId || definition.saasId === resolvedKnownSaasId) {
      return { ...definition };
    }

    if (definition.saasId === SOCIALFLOW_SAAS_ID && isSocialFlowSaasId(normalizedSaasId)) {
      return { ...definition };
    }
  }

  return null;
}

export async function runPlatformBootstrap(
  saasId: string,
): Promise<PlatformBootstrapLoaderResult> {
  const normalizedSaasId = normalizeSaasId(saasId);
  if (!normalizedSaasId) {
    return {
      saasId,
      success: false,
      status: "FAILED",
      message: "Neutral loader requires a non-empty saasId.",
    };
  }

  const definition = resolvePlatformBootstrapDefinition(normalizedSaasId);
  if (!definition) {
    return {
      saasId: normalizedSaasId,
      success: false,
      status: "FAILED",
      message: "Neutral platform bootstrap definition not found for provided saasId.",
    };
  }

  if (definition.saasId === SOCIALFLOW_SAAS_ID) {
    return {
      saasId: normalizedSaasId,
      success: true,
      status: "READY",
      message: "SocialFlow uses canonical Campamento Base platform definition in neutral loader.",
    };
  }

  if (definition.saasId === CLINIC_SAAS_ID) {
    return {
      saasId: normalizedSaasId,
      success: false,
      status: "SKIPPED",
      message: "Clinic requires a neutral orchestration boundary or future adapter before runtime bootstrap migration.",
    };
  }

  if (definition.saasId === TASKOPS_SAAS_ID) {
    return {
      saasId: normalizedSaasId,
      success: false,
      status: "SKIPPED",
      message: "TaskOps requires a neutral orchestration boundary or future adapter before runtime bootstrap migration.",
    };
  }

  const status = normalizeDefinitionStatus(definition.status);
  if (status === "READY") {
    return {
      saasId: normalizedSaasId,
      success: true,
      status,
      message: `${definition.name} neutral loader definition is ready.`,
    };
  }

  return {
    saasId: normalizedSaasId,
    success: false,
    status,
    message: `${definition.name} neutral loader definition is not executable in this phase.`,
  };
}

export function validatePlatformBootstrapRegistry(
  registry?: PlatformBootstrapLoaderRegistry,
): PlatformBootstrapLoaderResult[] {
  const definitions = cloneRegistry(registry ?? PLATFORM_BOOTSTRAP_LOADER_REGISTRY).definitions;
  if (definitions.length === 0) {
    return [
      {
        saasId: "*",
        success: false,
        status: "FAILED",
        message: "Neutral platform bootstrap registry has no definitions.",
      },
    ];
  }

  const saasIdCounts = new Map<string, number>();
  for (const definition of definitions) {
    const normalizedSaasId = normalizeSaasId(definition.saasId);
    if (!normalizedSaasId) {
      continue;
    }

    saasIdCounts.set(normalizedSaasId, (saasIdCounts.get(normalizedSaasId) ?? 0) + 1);
  }

  return definitions.map((definition) => {
    const normalizedSaasId = normalizeSaasId(definition.saasId);
    const normalizedName = definition.name.trim();
    const normalizedStatus = normalizeDefinitionStatus(definition.status);

    if (!normalizedSaasId) {
      return {
        saasId: definition.saasId,
        success: false,
        status: "FAILED",
        message: "Neutral platform bootstrap registry contains definition with empty saasId.",
      };
    }

    if (!normalizedName) {
      return {
        saasId: normalizedSaasId,
        success: false,
        status: "FAILED",
        message: "Neutral platform bootstrap registry contains definition with empty name.",
      };
    }

    if ((saasIdCounts.get(normalizedSaasId) ?? 0) > 1) {
      return {
        saasId: normalizedSaasId,
        success: false,
        status: "FAILED",
        message: "Neutral platform bootstrap registry contains duplicated saasId entries.",
      };
    }

    if (normalizedStatus === "FAILED") {
      return {
        saasId: normalizedSaasId,
        success: false,
        status: normalizedStatus,
        message: `${normalizedName} neutral platform bootstrap definition is marked as failed.`,
      };
    }

    if (normalizedStatus === "SKIPPED") {
      return {
        saasId: normalizedSaasId,
        success: true,
        status: normalizedStatus,
        message: `${normalizedName} neutral platform bootstrap definition is pending neutral boundary coverage.`,
      };
    }

    return {
      saasId: normalizedSaasId,
      success: true,
      status: normalizedStatus,
      message: `${normalizedName} neutral platform bootstrap definition is valid.`,
    };
  });
}
