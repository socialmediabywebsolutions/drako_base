import {
  getAutomation,
  registerAutomation,
  registerAutomationHandler,
  type AutomationExecutionResult,
} from "@/lib/automation-core";
import { connectIntegration, getIntegrationConnection } from "@/lib/integration-core";
import { ensureWhatsappIntegrationAvailable, WHATSAPP_INTEGRATION_KEY } from "@/lib/integration-core/providers/whatsapp";
import { listTasks, resolveTasksContext } from "@/lib/tasks/repository";
import { listWhatsappIdentities, resolveWhatsappContext } from "@/lib/whatsapp/repository";

export const TASKOPS_PENDING_TASK_AUDIT_KEY = "taskops.pending_task_audit";

type TaskOpsAutomationConfig = {
  overdueAfterHours?: number;
};

function normalizeTaskOpsConfig(config: Record<string, unknown> | null): Required<TaskOpsAutomationConfig> {
  const overdueAfterHours = typeof config?.overdueAfterHours === "number" && config.overdueAfterHours > 0
    ? Math.floor(config.overdueAfterHours)
    : 24;

  return { overdueAfterHours };
}

registerAutomationHandler(TASKOPS_PENDING_TASK_AUDIT_KEY, async ({ tenantId, saasId, config }) => {
  const normalized = normalizeTaskOpsConfig(config as Record<string, unknown> | null);
  const tasksCtx = await resolveTasksContext({ tenantId, saasId });
  const tasks = await listTasks(tasksCtx, {});
  const now = Date.now();
  const overdueCutoff = now - normalized.overdueAfterHours * 60 * 60 * 1000;

  const pendingOpenTasks = tasks.filter((task) => task.status === "OPEN" || task.status === "IN_PROGRESS").length;
  const criticalOpenTasks = tasks.filter(
    (task) => (task.status === "OPEN" || task.status === "IN_PROGRESS") && task.severity === "CRITICAL",
  ).length;
  const overdueTasks = tasks.filter((task) => {
    if (task.status !== "OPEN" && task.status !== "IN_PROGRESS") {
      return false;
    }

    if (!task.dueDate) {
      return false;
    }

    const dueDate = Date.parse(task.dueDate);
    return !Number.isNaN(dueDate) && dueDate <= overdueCutoff;
  }).length;

  const summary = `TaskOps audit: ${pendingOpenTasks} pending tasks, ${overdueTasks} overdue, ${criticalOpenTasks} critical open.`;

  const result: AutomationExecutionResult = {
    ok: true,
    summary,
    metrics: {
      pendingOpenTasks,
      overdueTasks,
      criticalOpenTasks,
    },
    output: {
      summary,
      overdueAfterHours: normalized.overdueAfterHours,
    },
  };

  return result;
});

export async function registerTaskOpsPlatform(tenantId: string, saasId: string): Promise<void> {
  await ensureWhatsappIntegrationAvailable();

  const existingAutomation = await getAutomation(tenantId, saasId, TASKOPS_PENDING_TASK_AUDIT_KEY);
  if (!existingAutomation) {
    await registerAutomation({
      tenantId,
      saasId,
      automationKey: TASKOPS_PENDING_TASK_AUDIT_KEY,
      displayName: "TaskOps pending task audit",
      description: "Audits pending, overdue and critical tasks for an operational workspace.",
      enabled: true,
      scheduleMode: "scheduled",
      frequencyUnit: "day",
      frequencyValue: 1,
      config: {
        overdueAfterHours: 24,
      },
      ownerScope: "OWNER",
    });
  }

  const existingIntegration = await getIntegrationConnection(tenantId, saasId, WHATSAPP_INTEGRATION_KEY);
  if (!existingIntegration) {
    const whatsappCtx = await resolveWhatsappContext({ tenantId, saasId });
    const identities = await listWhatsappIdentities(whatsappCtx);
    const primaryIdentity = identities[0] ?? null;

    await connectIntegration({
      tenantId,
      saasId,
      integrationKey: WHATSAPP_INTEGRATION_KEY,
      connectionLabel: "TaskOps WhatsApp",
      status: primaryIdentity ? "CONNECTED" : "PENDING",
      metadata: {
        platform: "taskops",
        bootstrap: "platform",
      },
      credentials: primaryIdentity
        ? {
            phoneNumber: primaryIdentity.phoneNumber,
            actorType: primaryIdentity.actorType,
            actorId: primaryIdentity.actorId,
          }
        : {
            phoneNumber: "",
          },
    });
  }
}
