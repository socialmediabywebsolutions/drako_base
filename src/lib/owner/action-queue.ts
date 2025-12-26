import { env } from "@/lib/cf";
import { queryAll } from "@/lib/db";
import { getDemoOwner } from "@/lib/admin/demo-data";
import { buildOwnerGrowthAutopilotSnapshot } from "@/lib/owner/growth-autopilot";
import { buildOwnerAccountingSnapshot } from "@/lib/owner/accounting";
import {
  createOrMergeActionFromAutopilot,
  listActionsForOwnerSnapshot,
  type CampamentoActionRow,
  type CampamentoActionStatus,
} from "@/lib/owner/action-queue-repository";
import type { OwnerGrowthAutopilotAction } from "@/lib/owner/types";

export type OwnerActionQueuePriority = "CRITICAL" | "HIGH" | "NORMAL" | "LOW";

export type OwnerActionQueueItem = {
  id: string;
  category: string;
  priority: OwnerActionQueuePriority;
  title: string;
  summary: string;
  source: string;
  status: CampamentoActionStatus;
  saasId?: string;
  saasName?: string;
  verticalId?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
};

export type OwnerActionQueueSnapshot = {
  items: OwnerActionQueueItem[];
  stats: {
    total: number;
    byPriority: Record<OwnerActionQueuePriority, number>;
    byCategory: Record<string, number>;
    byStatus: Record<CampamentoActionStatus, number>;
  };
};

type OwnerRow = {
  id: string;
};

function resolvePriority(action: OwnerGrowthAutopilotAction): OwnerActionQueuePriority {
  if (action.metadata && typeof action.metadata === "object" && (action.metadata as { lowPriority?: boolean }).lowPriority) {
    return "LOW";
  }
  if (action.severity === "CRITICAL") return "CRITICAL";
  if (action.severity === "WARNING") return "HIGH";
  if (action.category === "OPPORTUNITY") return "LOW";
  return "NORMAL";
}

function resolveSource(action: OwnerGrowthAutopilotAction): string {
  switch (action.category) {
    case "PRICING":
      return "pricing-engine";
    case "MARKETING":
      return "marketing";
    case "DEPARTMENT_COVERAGE":
      return "department-coverage";
    case "SAAS_HEALTH":
      return "saas-health";
    case "ECONOMY":
      return "treasury-vendor-baseline";
    case "RISK":
      return "risk";
    case "OPPORTUNITY":
      return "opportunity";
    default:
      return "growth-autopilot";
  }
}

function mapActionRowToSnapshot(params: {
  row: CampamentoActionRow;
  saasLookup: Map<string, { saasName: string; verticalId?: string }>;
}): OwnerActionQueueItem {
  const saasEntry = params.row.saas_id ? params.saasLookup.get(params.row.saas_id) : undefined;
  let metadata: Record<string, unknown> | undefined;
  if (params.row.metadata) {
    try {
      metadata = JSON.parse(params.row.metadata) as Record<string, unknown>;
    } catch {
      metadata = undefined;
    }
  }
  return {
    id: params.row.id,
    category: params.row.category,
    priority: params.row.priority,
    title: params.row.title,
    summary: params.row.summary ?? params.row.description,
    source: params.row.source,
    status: params.row.status,
    saasId: params.row.saas_id ?? undefined,
    saasName: saasEntry?.saasName,
    verticalId: saasEntry?.verticalId,
    createdAt: params.row.created_at,
    metadata,
  };
}

export async function getOwnerActionQueueSnapshot(args: {
  tenantId: string;
  now?: Date;
  ownerId?: string | null;
}): Promise<OwnerActionQueueSnapshot> {
  const hasEnv = Boolean(env());
  let ownerId = args.ownerId ?? null;
  if (!ownerId) {
    const rows = await queryAll<OwnerRow>("SELECT id FROM owners WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1", args.tenantId);
    ownerId = rows[0]?.id ?? getDemoOwner(args.tenantId)?.id ?? null;
  }
  if (!ownerId) {
    return {
      items: [],
      stats: {
        total: 0,
        byPriority: { CRITICAL: 0, HIGH: 0, NORMAL: 0, LOW: 0 },
        byCategory: {},
        byStatus: { OPEN: 0, EXECUTED: 0, DISMISSED: 0, SNOOZED: 0 },
      },
    };
  }

  const [actions, accounting] = await Promise.all([
    buildOwnerGrowthAutopilotSnapshot({ tenantId: args.tenantId, ownerId }),
    buildOwnerAccountingSnapshot({ tenantId: args.tenantId, ownerId }),
  ]);

  const saasLookup = new Map(accounting.rows.map((row) => [row.saasId, { saasName: row.saasName, verticalId: row.vertical }]));

  if (hasEnv) {
    await Promise.all(
      actions.map((action) =>
        createOrMergeActionFromAutopilot({
          tenantId: args.tenantId,
          action,
          priority: resolvePriority(action),
          source: resolveSource(action),
          now: args.now,
        }),
      ),
    );
  }

  let items: OwnerActionQueueItem[] = [];
  if (hasEnv) {
    const rows = await listActionsForOwnerSnapshot({ tenantId: args.tenantId });
    items = rows.map((row) => mapActionRowToSnapshot({ row, saasLookup }));
  } else {
    items = actions.map((action) => {
      const priority = resolvePriority(action);
      const saasId = action.target.type === "SAAS" ? action.target.saasId ?? undefined : undefined;
      const saasEntry = saasId ? saasLookup.get(saasId) : undefined;
      return {
        id: action.id,
        category: action.category,
        priority,
        title: action.title,
        summary: action.description,
        source: resolveSource(action),
        status: "OPEN",
        saasId,
        saasName: saasEntry?.saasName,
        verticalId: saasEntry?.verticalId,
        metadata: action.metadata ?? undefined,
      };
    });
  }

  const stats: OwnerActionQueueSnapshot["stats"] = {
    total: items.length,
    byPriority: { CRITICAL: 0, HIGH: 0, NORMAL: 0, LOW: 0 },
    byCategory: {},
    byStatus: { OPEN: 0, EXECUTED: 0, DISMISSED: 0, SNOOZED: 0 },
  };

  items.forEach((item) => {
    stats.byPriority[item.priority] += 1;
    stats.byCategory[item.category] = (stats.byCategory[item.category] ?? 0) + 1;
    stats.byStatus[item.status] += 1;
  });

  return { items, stats };
}
