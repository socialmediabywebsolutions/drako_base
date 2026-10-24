import {
  getAutomation,
  registerAutomation,
  registerAutomationHandler,
  type AutomationExecutionResult,
} from "@/lib/automation-core";
import { connectIntegration, getIntegrationConnection } from "@/lib/integration-core";
import { ensureWhatsappIntegrationAvailable, WHATSAPP_INTEGRATION_KEY } from "@/lib/integration-core/providers/whatsapp";
import {
  defineSaasPlatform,
  defineSaasPlatformBootstrap,
  registerSaasPlatformBootstrap,
  registerSaasPlatformDefinition,
  type SaasAutomationDefinition,
  type SaasIntegrationDefinition,
  type SaasPlatformBootstrap,
  type SaasPlatformDefinition,
  type ResolvedSaasPlatform,
} from "@/lib/saas-contract";
import { registerFactorySaas } from "@/lib/factory/registry";
import { listTasks, resolveTasksContext } from "@/lib/tasks/repository";
import { listWhatsappIdentities, resolveWhatsappContext } from "@/lib/whatsapp/repository";

export type SaasFactoryTemplate = "basic-operational-saas";

export type CreateSaasInstanceInput = {
  saasId: string;
  displayName: string;
  template?: SaasFactoryTemplate;
  initialAutomations?: SaasAutomationDefinition[];
  initialIntegrations?: string[];
  createdBy?: string | null;
  metadata?: Record<string, unknown> | null;
};

function normalizeSaasIdentity(input: CreateSaasInstanceInput) {
  const saasId = input.saasId.trim();
  const displayName = input.displayName.trim();

  if (!saasId) {
    throw new Error("FACTORY_SAAS_ID_REQUIRED");
  }
  if (!displayName) {
    throw new Error("FACTORY_DISPLAY_NAME_REQUIRED");
  }

  return { saasId, displayName };
}

function buildHealthCheckAutomationDefinition(saasId: string, displayName: string): SaasAutomationDefinition {
  return {
    automationKey: `${saasId}.daily_health_check`,
    displayName: `${displayName} daily health check`,
    enabledByDefault: true,
    description: `Checks operational health for ${displayName}.`,
  };
}

function dedupeAutomations(definitions: SaasAutomationDefinition[]): SaasAutomationDefinition[] {
  const map = new Map<string, SaasAutomationDefinition>();
  for (const definition of definitions) {
    map.set(definition.automationKey, definition);
  }

  return [...map.values()];
}

function dedupeIntegrations(definitions: SaasIntegrationDefinition[]): SaasIntegrationDefinition[] {
  const map = new Map<string, SaasIntegrationDefinition>();
  for (const definition of definitions) {
    map.set(definition.integrationKey, definition);
  }

  return [...map.values()];
}

function buildTemplateDefinitions(input: {
  saasId: string;
  displayName: string;
  initialAutomations?: SaasAutomationDefinition[];
  initialIntegrations?: string[];
}): {
  automations: SaasAutomationDefinition[];
  integrations: SaasIntegrationDefinition[];
} {
  const baseAutomation = buildHealthCheckAutomationDefinition(input.saasId, input.displayName);
  const automations = dedupeAutomations([baseAutomation, ...(input.initialAutomations ?? [])]);
  const integrations = dedupeIntegrations(
    (input.initialIntegrations ?? []).map((integrationKey) => ({
      integrationKey,
      required: false,
      description: integrationKey === WHATSAPP_INTEGRATION_KEY
        ? "Optional reusable WhatsApp connection for notifications."
        : `Optional integration ${integrationKey}.`,
    })),
  );

  return { automations, integrations };
}

function registerBasicOperationalAutomationHandler(params: {
  automationKey: string;
  displayName: string;
}) {
  registerAutomationHandler(params.automationKey, async ({ tenantId, saasId }) => {
    const tasksCtx = await resolveTasksContext({ tenantId, saasId });
    const tasks = await listTasks(tasksCtx, {});
    const openTasks = tasks.filter((task) => task.status === "OPEN").length;
    const inProgressTasks = tasks.filter((task) => task.status === "IN_PROGRESS").length;
    const criticalOpenTasks = tasks.filter(
      (task) => (task.status === "OPEN" || task.status === "IN_PROGRESS") && task.severity === "CRITICAL",
    ).length;

    const summary = `${params.displayName} health check: ${openTasks} open, ${inProgressTasks} in progress, ${criticalOpenTasks} critical open.`;
    const result: AutomationExecutionResult = {
      ok: true,
      summary,
      metrics: {
        openTasks,
        inProgressTasks,
        criticalOpenTasks,
      },
      output: {
        summary,
      },
    };

    return result;
  });
}

async function connectOptionalIntegration(params: {
  tenantId: string;
  saasId: string;
  integrationKey: string;
  displayName: string;
}) {
  if (params.integrationKey !== WHATSAPP_INTEGRATION_KEY) {
    return;
  }

  await ensureWhatsappIntegrationAvailable();

  const existingIntegration = await getIntegrationConnection(params.tenantId, params.saasId, params.integrationKey);
  if (existingIntegration) {
    return;
  }

  const whatsappCtx = await resolveWhatsappContext({ tenantId: params.tenantId, saasId: params.saasId });
  const identities = await listWhatsappIdentities(whatsappCtx);
  const primaryIdentity = identities[0] ?? null;

  await connectIntegration({
    tenantId: params.tenantId,
    saasId: params.saasId,
    integrationKey: params.integrationKey,
    connectionLabel: `${params.displayName} WhatsApp`,
    status: primaryIdentity ? "CONNECTED" : "PENDING",
    metadata: {
      platform: params.saasId,
      bootstrap: "factory-orchestrator",
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

function buildRuntimeDefinition(input: {
  saasId: string;
  displayName: string;
  automations: SaasAutomationDefinition[];
  integrations: SaasIntegrationDefinition[];
}): SaasPlatformDefinition {
  return defineSaasPlatform({
    saasId: input.saasId,
    displayName: input.displayName,
    category: "factory-runtime",
    supportsOperatorSurface: true,
    automations: input.automations,
    integrations: input.integrations,
  });
}

function buildRuntimeBootstrap(input: {
  saasId: string;
  displayName: string;
  automations: SaasAutomationDefinition[];
  integrations: SaasIntegrationDefinition[];
}): SaasPlatformBootstrap {
  const primaryAutomation = input.automations[0];
  if (primaryAutomation) {
    registerBasicOperationalAutomationHandler({
      automationKey: primaryAutomation.automationKey,
      displayName: input.displayName,
    });
  }

  return defineSaasPlatformBootstrap({
    saasId: input.saasId,
    async connect({ tenantId, saasId }) {
      for (const automation of input.automations) {
        const existingAutomation = await getAutomation(tenantId, saasId, automation.automationKey);
        if (!existingAutomation) {
          await registerAutomation({
            tenantId,
            saasId,
            automationKey: automation.automationKey,
            displayName: automation.displayName,
            description: automation.description ?? null,
            enabled: automation.enabledByDefault,
            scheduleMode: "scheduled",
            frequencyUnit: "day",
            frequencyValue: 1,
            config: null,
            ownerScope: "OWNER",
          });
        }
      }

      for (const integration of input.integrations) {
        await connectOptionalIntegration({
          tenantId,
          saasId,
          integrationKey: integration.integrationKey,
          displayName: input.displayName,
        });
      }
    },
  });
}

export async function createSaasInstance(input: CreateSaasInstanceInput): Promise<ResolvedSaasPlatform> {
  const { saasId, displayName } = normalizeSaasIdentity(input);
  const template = input.template ?? "basic-operational-saas";
  if (template !== "basic-operational-saas") {
    throw new Error("FACTORY_TEMPLATE_NOT_SUPPORTED");
  }
  const templateDefinitions = buildTemplateDefinitions({
    saasId,
    displayName,
    initialAutomations: input.initialAutomations,
    initialIntegrations: input.initialIntegrations,
  });

  const definition = buildRuntimeDefinition({
    saasId,
    displayName,
    automations: templateDefinitions.automations,
    integrations: templateDefinitions.integrations,
  });
  const bootstrap = buildRuntimeBootstrap({
    saasId,
    displayName,
    automations: templateDefinitions.automations,
    integrations: templateDefinitions.integrations,
  });

  registerSaasPlatformDefinition(definition);
  registerSaasPlatformBootstrap(bootstrap);
  await registerFactorySaas({
    saasId,
    displayName,
    template,
    status: "ACTIVE",
    createdBy: input.createdBy ?? null,
    supportsOperatorSurface: definition.supportsOperatorSurface ?? false,
    metadata: input.metadata ?? null,
  });

  return {
    definition,
    bootstrap,
  };
}
