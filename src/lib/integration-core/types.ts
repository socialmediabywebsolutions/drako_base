export type IntegrationCategory = "social" | "payments" | "email" | "crm" | "other";

export type IntegrationAuthMode = "token" | "api_key" | "basic" | "custom";

export type IntegrationConnectionStatus =
  | "CONNECTED"
  | "PENDING"
  | "INVALID"
  | "DISCONNECTED"
  | "NEEDS_REAUTH";

export type IntegrationOperationPayload = Record<string, unknown> | null;

export type IntegrationCredentials = Record<string, unknown> | null;

export type IntegrationMetadata = Record<string, unknown> | null;

export type IntegrationDefinition = {
  id: string;
  integrationKey: string;
  displayName: string;
  provider: string;
  category: IntegrationCategory;
  authMode: IntegrationAuthMode;
  enabled: boolean;
  supportedOperations: string[];
  createdAt: string;
  updatedAt: string;
};

export type RegisterIntegrationDefinitionInput = {
  integrationKey: string;
  displayName: string;
  provider: string;
  category: IntegrationCategory;
  authMode: IntegrationAuthMode;
  enabled?: boolean;
  supportedOperations: string[];
};

export type IntegrationConnection = {
  id: string;
  tenantId: string;
  saasId: string;
  integrationKey: string;
  connectionLabel: string | null;
  status: IntegrationConnectionStatus;
  metadata: IntegrationMetadata;
  credentials: IntegrationCredentials;
  lastValidatedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConnectIntegrationInput = {
  tenantId: string;
  saasId: string;
  integrationKey: string;
  connectionLabel?: string | null;
  status?: IntegrationConnectionStatus;
  metadata?: IntegrationMetadata;
  credentials?: IntegrationCredentials;
};

export type IntegrationProviderValidateInput = {
  tenantId: string;
  saasId: string;
  integrationKey: string;
  connection: IntegrationConnection;
};

export type IntegrationProviderValidateResult = {
  ok: boolean;
  status: IntegrationConnectionStatus;
  checkedAt?: string | null;
  metadata?: IntegrationMetadata;
  error?: {
    code: string;
    message: string;
  } | null;
};

export type ExecuteIntegrationOperationInput = {
  tenantId: string;
  saasId: string;
  integrationKey: string;
  operationKey: string;
  payload?: IntegrationOperationPayload;
};

export type IntegrationProviderExecuteInput = {
  tenantId: string;
  saasId: string;
  integrationKey: string;
  operationKey: string;
  payload: IntegrationOperationPayload;
  connection: IntegrationConnection;
};

export type IntegrationProviderExecuteResult = {
  ok: boolean;
  result?: Record<string, unknown> | null;
  error?: {
    code: string;
    message: string;
  } | null;
};

export type IntegrationProvider = {
  validate: (
    input: IntegrationProviderValidateInput,
  ) => Promise<IntegrationProviderValidateResult>;
  executeOperation: (
    input: IntegrationProviderExecuteInput,
  ) => Promise<IntegrationProviderExecuteResult>;
};

export class IntegrationCoreError extends Error {
  code: string;

  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = "IntegrationCoreError";
    this.code = code;
  }
}
