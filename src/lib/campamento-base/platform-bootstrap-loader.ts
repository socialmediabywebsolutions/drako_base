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
const SOCIALFLOW_DEFINITION: PlatformBootstrapLoaderDefinition = {
  saasId: SOCIALFLOW_SAAS_ID,
  name: socialFlowPlatformDefinition.displayName,
  status: "READY",
};

const PLATFORM_BOOTSTRAP_LOADER_REGISTRY: PlatformBootstrapLoaderRegistry = {
  definitions: [SOCIALFLOW_DEFINITION],
};

function normalizeSaasId(saasId: string): string {
  return saasId.trim().toLowerCase();
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

export function listPlatformBootstrapDefinitions(): PlatformBootstrapLoaderDefinition[] {
  return PLATFORM_BOOTSTRAP_LOADER_REGISTRY.definitions.map((definition) => ({ ...definition }));
}

export function resolvePlatformBootstrapDefinition(
  saasId: string,
): PlatformBootstrapLoaderDefinition | null {
  const normalizedSaasId = normalizeSaasId(saasId);
  if (!normalizedSaasId) {
    return null;
  }

  for (const definition of PLATFORM_BOOTSTRAP_LOADER_REGISTRY.definitions) {
    if (definition.saasId === normalizedSaasId) {
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
  if (definition) {
    return {
      saasId: normalizedSaasId,
      success: true,
      status: "READY",
      message: `${definition.name} canonical loader definition is ready for migration coverage.`,
    };
  }

  if (normalizedSaasId.includes("clinic")) {
    return {
      saasId: normalizedSaasId,
      success: false,
      status: "SKIPPED",
      message: "Clinic bootstrap remains outside neutral loader scope until dedicated neutral adapter migration.",
    };
  }

  if (normalizedSaasId.includes("taskops")) {
    return {
      saasId: normalizedSaasId,
      success: false,
      status: "SKIPPED",
      message: "TaskOps bootstrap remains outside neutral loader scope until dedicated neutral adapter migration.",
    };
  }

  return {
    saasId: normalizedSaasId,
    success: false,
    status: "FAILED",
    message: "No neutral platform bootstrap definition was found for the provided saasId.",
  };
}

export function validatePlatformBootstrapRegistry(): PlatformBootstrapLoaderResult[] {
  const definitions = listPlatformBootstrapDefinitions();
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

  const seenSaasIds = new Set<string>();

  return definitions.map((definition) => {
    const normalizedSaasId = normalizeSaasId(definition.saasId);
    const normalizedName = definition.name.trim();

    if (!normalizedSaasId || !normalizedName) {
      return {
        saasId: normalizedSaasId || definition.saasId,
        success: false,
        status: "FAILED",
        message: "Neutral platform bootstrap registry contains an invalid definition.",
      };
    }

    if (seenSaasIds.has(normalizedSaasId)) {
      return {
        saasId: normalizedSaasId,
        success: false,
        status: "FAILED",
        message: "Neutral platform bootstrap registry contains duplicated saasId entries.",
      };
    }

    seenSaasIds.add(normalizedSaasId);

    return {
      saasId: normalizedSaasId,
      success: true,
      status: "READY",
      message: `${normalizedName} neutral platform bootstrap definition is valid.`,
    };
  });
}
