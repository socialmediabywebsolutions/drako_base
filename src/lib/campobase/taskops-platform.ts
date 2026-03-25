import { AutomationCoreError, triggerAutomation } from "@/lib/automation-core";
import type { SaasPlatformBootstrap, SaasPlatformDefinition } from "@/lib/saas-contract";
import { defineSaasPlatform, defineSaasPlatformBootstrap } from "@/lib/saas-contract";
import { WHATSAPP_INTEGRATION_KEY } from "@/lib/integration-core/providers/whatsapp";
import { TASKOPS_PENDING_TASK_AUDIT_KEY, registerTaskOpsPlatform as bootstrapTaskOpsPlatform } from "@/lib/campobase/taskops-platform-service";

export const TASKOPS_PLATFORM_SAAS_ID = "taskops";

function isTaskOpsSaas(saasId: string): boolean {
  const normalized = saasId.trim().toLowerCase();
  return normalized === TASKOPS_PLATFORM_SAAS_ID || normalized.includes(TASKOPS_PLATFORM_SAAS_ID);
}

export const taskOpsPlatformDefinition: SaasPlatformDefinition = defineSaasPlatform({
  saasId: TASKOPS_PLATFORM_SAAS_ID,
  displayName: "TaskOps",
  category: "operations",
  supportsOperatorSurface: true,
  matchesSaasId: isTaskOpsSaas,
  automations: [
    {
      automationKey: TASKOPS_PENDING_TASK_AUDIT_KEY,
      displayName: "TaskOps pending task audit",
      enabledByDefault: true,
      description: "Audits pending, overdue and critical tasks for an operational workspace.",
    },
  ],
  integrations: [
    {
      integrationKey: WHATSAPP_INTEGRATION_KEY,
      required: false,
      description: "Optional reusable WhatsApp connection for operational notifications.",
    },
  ],
});

export const taskOpsPlatformBootstrap: SaasPlatformBootstrap = defineSaasPlatformBootstrap({
  saasId: TASKOPS_PLATFORM_SAAS_ID,
  async connect({ tenantId, saasId }) {
    await bootstrapTaskOpsPlatform(tenantId, saasId);
  },
  signalHandlers: {
    async "task.overdue"({ signal, targetTenantId, targetSaasId }) {
      try {
        await triggerAutomation({
          tenantId: targetTenantId,
          saasId: targetSaasId,
          automationKey: TASKOPS_PENDING_TASK_AUDIT_KEY,
          triggerType: "system",
          triggeredBy: `signal:${signal.type}`,
        });
      } catch (error) {
        if (error instanceof AutomationCoreError && error.code === "AUTOMATION_EXECUTION_IN_PROGRESS") {
          return;
        }
        throw error;
      }
    },
  },
});
