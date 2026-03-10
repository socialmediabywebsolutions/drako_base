export type FactoryRecoveryOperation = {
  id: string;
  tenantId: string;
  type: "retry_job" | "retry_domain_verify";
  jobId?: string;
  domain?: string;
  createdAt: number;
  status: "pending";
};

type StoredFactoryRecoveryOperation = FactoryRecoveryOperation & {
  sequence: number;
};

const operations: StoredFactoryRecoveryOperation[] = [];
let sequenceCounter = 0;

function generateId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `recovery_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

export async function enqueueRecoveryOperation(input: {
  tenantId: string;
  type: "retry_job" | "retry_domain_verify";
  jobId?: string;
  domain?: string;
}): Promise<Pick<FactoryRecoveryOperation, "id" | "status">> {
  const operation: StoredFactoryRecoveryOperation = {
    id: generateId(),
    tenantId: input.tenantId,
    type: input.type,
    jobId: input.jobId,
    domain: input.domain,
    createdAt: Date.now(),
    status: "pending",
    sequence: sequenceCounter += 1,
  };

  operations.push(operation);

  return {
    id: operation.id,
    status: operation.status,
  };
}

export async function listPendingRecoveryOperations(params?: {
  tenantId?: string;
  limit?: number | null;
}): Promise<FactoryRecoveryOperation[]> {
  const limit =
    Number.isFinite(params?.limit) && Number(params?.limit) > 0
      ? Math.trunc(Number(params?.limit))
      : operations.length;

  return operations
    .filter((operation) => operation.status === "pending")
    .filter((operation) => !params?.tenantId || operation.tenantId === params.tenantId)
    .sort((left, right) => {
      if (right.createdAt !== left.createdAt) {
        return right.createdAt - left.createdAt;
      }
      return right.sequence - left.sequence;
    })
    .map(({ sequence: _sequence, ...operation }) => operation)
    .slice(0, limit);
}
