import type { OwnerControlSnapshot } from "@/lib/owner/types";
import { getSaasPackById } from "@/lib/packs/repository";
import type { SaasTask, SaasTaskCategory } from "@/lib/tasks/types";
import { createTask, listTasks, resolveTasksContext } from "@/lib/tasks/repository";

function mapCategory(actionCategory: string, targetArea?: string): SaasTaskCategory {
  if (actionCategory === "ECONOMY") return "ECONOMY";
  if (actionCategory === "HR" || actionCategory === "FAIRNESS") return "HR";
  if (actionCategory === "SOCIAL") return "SOCIAL";
  if (actionCategory === "EMAIL") return "EMAIL";
  if (actionCategory === "TAX") return "TAX";
  if (actionCategory === "SYSTEM" || targetArea === "blueprint") return "BLUEPRINT";
  return "OTHER";
}

export async function materializeAutopilotActionsAsTasks(
  ctx: { tenantId: string; saasId: string; env?: Parameters<typeof resolveTasksContext>[0]["env"] },
  snapshot: OwnerControlSnapshot,
  options?: { onlyCritical?: boolean },
): Promise<SaasTask[]> {
  const tasksCtx = await resolveTasksContext({ tenantId: ctx.tenantId, saasId: ctx.saasId, env: ctx.env });
  const existingTasks = await listTasks(tasksCtx, {});
  const existingKeys = new Set(
    existingTasks
      .map((task) => task.metadata?.autopilotKey)
      .filter((key): key is string => typeof key === "string" && key.length > 0),
  );

  const actions = snapshot.autopilotActions ?? [];
  const created: SaasTask[] = [];
  for (const action of actions) {
    if (options?.onlyCritical && action.severity !== "CRITICAL") continue;
    const key = action.key ?? action.id;
    if (existingKeys.has(key)) continue;
    const pack = snapshot.currentPack ? getSaasPackById(snapshot.currentPack.id) : undefined;
    const packTags = pack?.recommendedKnowledgeTags ?? [];
    const baseHints = action.knowledgeHints ?? null;
    const mergedTags = Array.from(new Set([...(baseHints?.tags ?? []), ...(action.target?.type === "FEATURE" ? packTags : [])]));
    const mergedHints = baseHints
      ? { ...baseHints, tags: mergedTags }
      : mergedTags.length > 0
        ? { tags: mergedTags }
        : null;
    const task = await createTask(tasksCtx, {
      saasId: ctx.saasId,
      title: action.title,
      description: action.description,
      category: mapCategory(action.category, action.targetArea),
      source: "AUTOPILOT",
      severity: action.severity,
      assigneeEmployeeId: action.employeeId ?? null,
      metadata: {
        autopilotKey: key,
        target: action.target ?? null,
        targetArea: action.targetArea ?? null,
        knowledgeHints: mergedHints,
        employeeId: action.employeeId ?? null,
        customerId: action.customerId ?? null,
        campaignId: action.campaignId ?? null,
        serviceId: action.serviceId ?? null,
      },
    });
    created.push(task);
  }
  return created;
}
