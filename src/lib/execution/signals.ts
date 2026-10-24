export type CrossSaasSignal = {
  signalId: string;
  type: string;
  sourceSaasId: string;
  sourceTenantId: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
  correlationId?: string | null;
  chainDepth: number;
};

export type EmitSignalInput = {
  signalId?: string | null;
  type: string;
  sourceSaasId: string;
  sourceTenantId: string;
  payload?: Record<string, unknown> | null;
  correlationId?: string | null;
  chainDepth?: number | null;
};

function generateSignalId(): string {
  const globalCrypto = typeof globalThis !== "undefined"
    ? (globalThis.crypto as { randomUUID?: () => string } | undefined)
    : undefined;
  if (globalCrypto?.randomUUID) {
    try {
      return globalCrypto.randomUUID();
    } catch {
      // ignore and fallback
    }
  }

  return `signal_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function createSignal(input: EmitSignalInput): CrossSaasSignal {
  if (!input.type?.trim()) {
    throw new Error("SIGNAL_TYPE_REQUIRED");
  }
  if (!input.sourceSaasId?.trim()) {
    throw new Error("SIGNAL_SOURCE_SAAS_REQUIRED");
  }
  if (!input.sourceTenantId?.trim()) {
    throw new Error("SIGNAL_SOURCE_TENANT_REQUIRED");
  }
  const normalizedChainDepth = input.chainDepth ?? 0;
  if (!Number.isInteger(normalizedChainDepth) || normalizedChainDepth < 0) {
    throw new Error("SIGNAL_CHAIN_DEPTH_INVALID");
  }

  return {
    signalId: input.signalId?.trim() || generateSignalId(),
    type: input.type.trim(),
    sourceSaasId: input.sourceSaasId.trim(),
    sourceTenantId: input.sourceTenantId.trim(),
    payload: input.payload ?? null,
    createdAt: new Date().toISOString(),
    correlationId: input.correlationId?.trim() || null,
    chainDepth: normalizedChainDepth,
  };
}
