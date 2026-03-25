export type SaasAutomationDefinition = {
  automationKey: string;
  displayName: string;
  enabledByDefault: boolean;
  description?: string | null;
};

export type SaasIntegrationDefinition = {
  integrationKey: string;
  required: boolean;
  description?: string | null;
};

export type SaasPlatformDefinition = {
  saasId: string;
  displayName: string;
  category?: string | null;
  supportsOperatorSurface?: boolean;
  matchesSaasId?: (saasId: string) => boolean;
  automations: SaasAutomationDefinition[];
  integrations: SaasIntegrationDefinition[];
};

export type SaasPlatformRuntimeContext = {
  tenantId: string;
  saasId: string;
};

export type SaasSignal = {
  signalId: string;
  type: string;
  sourceSaasId: string;
  sourceTenantId: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
  correlationId?: string | null;
};

export type SaasSignalHandlerInput = {
  signal: SaasSignal;
  targetTenantId: string;
  targetSaasId: string;
};

export type SaasSignalHandler = (input: SaasSignalHandlerInput) => Promise<void>;

export type SaasPlatformBootstrap = {
  saasId: string;
  connect: (context: SaasPlatformRuntimeContext) => Promise<void>;
  signalHandlers?: Record<string, SaasSignalHandler>;
};

export type ResolvedSaasPlatform = {
  definition: SaasPlatformDefinition;
  bootstrap: SaasPlatformBootstrap | null;
};
