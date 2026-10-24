import {
  getObservabilityStatusSummary,
  listObservabilityActivities,
  type ObservabilityActivity,
  type ObservabilityStatusSummary,
} from "@/lib/observability-core";
import { resolveSaasPlatform } from "@/lib/saas-contract";
import {
  archiveFactorySaas,
  getFactorySaas,
  listFactorySaas,
  setFactorySaasStatus,
  type FactorySaasRecord,
  type FactorySaasStatus,
} from "@/lib/factory/registry";

export type FactoryControlPlaneItem = FactorySaasRecord & {
  runtimeRegistered: boolean;
  participatesInExecutionLayer: boolean;
  operationalSummary: ObservabilityStatusSummary | null;
  latestActivityAt: string | null;
  recentSignals: ObservabilityActivity[];
};

function getOperatorTenantId(metadata: Record<string, unknown> | null): string | null {
  const tenantId = metadata && typeof metadata.operatorTenantId === "string"
    ? metadata.operatorTenantId.trim()
    : "";
  return tenantId || null;
}

async function composeFactoryItem(item: FactorySaasRecord): Promise<FactoryControlPlaneItem> {
  const resolved = resolveSaasPlatform(item.saasId);
  const operatorTenantId = getOperatorTenantId(item.metadata);
  const [operationalSummary, recentSignals] = await Promise.all([
    item.supportsOperatorSurface && operatorTenantId
      ? getObservabilityStatusSummary({ tenantId: operatorTenantId, saasId: item.saasId }).catch(() => null)
      : Promise.resolve(null),
    item.supportsOperatorSurface && operatorTenantId
      ? listObservabilityActivities({
          tenantId: operatorTenantId,
          saasId: item.saasId,
          sourceType: "saas",
          sourceKey: item.saasId,
          limit: 10,
        }).then((items) => items.filter((activity) => activity.activityType.startsWith("signal_")))
      : Promise.resolve([]),
  ]);

  return {
    ...item,
    runtimeRegistered: Boolean(resolved),
    participatesInExecutionLayer: Boolean(resolved?.bootstrap?.signalHandlers && Object.keys(resolved.bootstrap.signalHandlers).length > 0),
    operationalSummary,
    latestActivityAt: operationalSummary?.latestActivityAt ?? null,
    recentSignals,
  };
}

export async function listFactoryControlPlane(): Promise<FactoryControlPlaneItem[]> {
  const items = await listFactorySaas();
  return Promise.all(items.map(composeFactoryItem));
}

export async function getFactoryControlPlaneItem(saasId: string): Promise<FactoryControlPlaneItem | null> {
  const item = await getFactorySaas(saasId);
  if (!item) {
    return null;
  }

  return composeFactoryItem(item);
}

export async function setFactoryControlPlaneStatus(
  saasId: string,
  status: FactorySaasStatus,
): Promise<FactoryControlPlaneItem> {
  const item = await setFactorySaasStatus(saasId, status);
  return composeFactoryItem(item);
}

export async function archiveFactoryControlPlaneSaas(saasId: string): Promise<FactoryControlPlaneItem> {
  const item = await archiveFactorySaas(saasId);
  return composeFactoryItem(item);
}
