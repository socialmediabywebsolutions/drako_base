import {
  ensureClinicControlPlaneIntegration,
  getClinicControlPlaneAutomationRegistration,
  registerClinicControlPlaneAutomation,
  type ClinicControlPlaneAutomationRegistration,
  type ClinicControlPlaneIntegrationState,
} from "@/lib/capabilities/internal-api-clients/clinic-control-plane";
import {
  planClinicControlPlaneBootstrap,
  type ClinicControlPlaneBootstrapInput,
  type ClinicControlPlaneBootstrapPlan,
} from "@/lib/clinic/control-plane-orchestration";
import {
  planClinicControlPlaneHandlerRegistration,
  type ClinicControlPlaneHandlerRegistrationInput,
  type ClinicControlPlaneHandlerRegistrationPlan,
} from "@/lib/clinic/control-plane-handler-registration";
import {
  resolveClinicControlPlaneContext,
  resolveClinicControlPlaneHandlerOutput,
  type ClinicControlPlaneContextResolutionInput,
  type ClinicControlPlaneHandlerOutput,
} from "@/lib/clinic/control-plane-context-resolution";

export const CLINIC_DAILY_APPOINTMENT_HEALTH_KEY = "clinic.daily_appointment_health";

export type ClinicServiceRegistrationOptions = Pick<
  ClinicControlPlaneBootstrapInput,
  "automationExists" | "whatsappProviderAvailable" | "whatsappIntegrationExists" | "hasPrimaryWhatsappIdentity"
> & Pick<ClinicControlPlaneHandlerRegistrationInput, "handlerRegistered">;

export type ClinicServiceRegistrationInput = {
  tenantId: string;
  saasId: string;
  options?: ClinicServiceRegistrationOptions;
  handlerContext?: Pick<ClinicControlPlaneContextResolutionInput, "appointments" | "config">;
};

export type ClinicServiceRegistrationResult = {
  tenantId: string;
  saasId: string;
  bootstrapPlan: ClinicControlPlaneBootstrapPlan;
  handlerRegistrationPlan: ClinicControlPlaneHandlerRegistrationPlan;
  automationRegistration: ClinicControlPlaneAutomationRegistration | null;
  integrationState: ClinicControlPlaneIntegrationState;
  handlerOutput: ClinicControlPlaneHandlerOutput | null;
};

function integrationStatusFromPlan(plan: ClinicControlPlaneBootstrapPlan): ClinicControlPlaneIntegrationState["status"] {
  return plan.integrationStatus;
}

export async function registerClinicPlatform(
  tenantId: string,
  saasId: string,
  options: ClinicServiceRegistrationOptions = {},
): Promise<ClinicServiceRegistrationResult> {
  const context = resolveClinicControlPlaneContext({ tenantId, saasId });

  const bootstrapPlan = planClinicControlPlaneBootstrap({
    tenantId: context.tenantId,
    saasId: context.saasId,
    automationExists: options.automationExists,
    whatsappProviderAvailable: options.whatsappProviderAvailable,
    whatsappIntegrationExists: options.whatsappIntegrationExists,
    hasPrimaryWhatsappIdentity: options.hasPrimaryWhatsappIdentity,
  });

  const handlerRegistrationPlan = planClinicControlPlaneHandlerRegistration({
    tenantId: context.tenantId,
    saasId: context.saasId,
    automationExists: options.automationExists,
    handlerRegistered: options.handlerRegistered,
    whatsappProviderAvailable: options.whatsappProviderAvailable,
    whatsappIntegrationExists: options.whatsappIntegrationExists,
    hasPrimaryWhatsappIdentity: options.hasPrimaryWhatsappIdentity,
  });

  let automationRegistration = await getClinicControlPlaneAutomationRegistration(context.tenantId, context.saasId);

  if (!automationRegistration && bootstrapPlan.shouldRegisterAutomation) {
    automationRegistration = await registerClinicControlPlaneAutomation({
      tenantId: context.tenantId,
      saasId: context.saasId,
      automationKey: CLINIC_DAILY_APPOINTMENT_HEALTH_KEY,
      displayName: "Clinic daily appointment health",
      enabled: true,
      scheduleMode: "scheduled",
      config: {
        lookaheadDays: 7,
        overdueFollowupHours: 24,
      },
    });
  }

  const integrationState = await ensureClinicControlPlaneIntegration(context.tenantId, context.saasId, {
    status: integrationStatusFromPlan(bootstrapPlan),
    hasPrimaryWhatsappIdentity: bootstrapPlan.hasPrimaryWhatsappIdentity,
    connectionLabel: "Clinic WhatsApp",
  });

  return {
    tenantId: context.tenantId,
    saasId: context.saasId,
    bootstrapPlan,
    handlerRegistrationPlan,
    automationRegistration,
    integrationState,
    handlerOutput: null,
  };
}

export function resolveClinicServiceHandlerOutput(
  input: ClinicControlPlaneContextResolutionInput,
): ClinicControlPlaneHandlerOutput {
  return resolveClinicControlPlaneHandlerOutput(input);
}
