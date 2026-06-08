export type ClinicControlPlaneBootstrapInput = {
  tenantId: string;
  saasId: string;
  automationExists?: boolean;
  whatsappProviderAvailable?: boolean;
  whatsappIntegrationExists?: boolean;
  hasPrimaryWhatsappIdentity?: boolean;
};

export type ClinicControlPlaneBootstrapPlan = {
  tenantId: string;
  saasId: string;
  automationKey: "clinic.daily_appointment_health";
  shouldRegisterAutomation: boolean;
  shouldEnsureWhatsappProvider: boolean;
  shouldCreateWhatsappIntegration: boolean;
  integrationStatus: "CONNECTED" | "PENDING" | "MISSING";
  hasPrimaryWhatsappIdentity: boolean;
  summary: string;
};

const CLINIC_DAILY_APPOINTMENT_HEALTH_KEY = "clinic.daily_appointment_health";

function assertIdentity(input: ClinicControlPlaneBootstrapInput): void {
  if (!input.tenantId.trim() || !input.saasId.trim()) {
    throw new Error("Clinic bootstrap plan requires tenantId and saasId.");
  }
}

export function planClinicControlPlaneBootstrap(
  input: ClinicControlPlaneBootstrapInput,
): ClinicControlPlaneBootstrapPlan {
  assertIdentity(input);

  const automationExists = input.automationExists ?? false;
  const whatsappProviderAvailable = input.whatsappProviderAvailable ?? true;
  const whatsappIntegrationExists = input.whatsappIntegrationExists ?? false;
  const hasPrimaryWhatsappIdentity = input.hasPrimaryWhatsappIdentity ?? false;

  const shouldRegisterAutomation = !automationExists;
  const shouldEnsureWhatsappProvider = true;

  const shouldCreateWhatsappIntegration = whatsappProviderAvailable && !whatsappIntegrationExists;

  const integrationStatus: "CONNECTED" | "PENDING" | "MISSING" = !whatsappProviderAvailable
    ? "MISSING"
    : hasPrimaryWhatsappIdentity
      ? "CONNECTED"
      : "PENDING";

  const summary = [
    `Clinic bootstrap plan for ${input.tenantId}/${input.saasId}:`,
    `registerAutomation=${shouldRegisterAutomation ? "yes" : "no"}`,
    `ensureWhatsappProvider=${shouldEnsureWhatsappProvider ? "yes" : "no"}`,
    `createWhatsappIntegration=${shouldCreateWhatsappIntegration ? "yes" : "no"}`,
    `integrationStatus=${integrationStatus}`,
    `hasPrimaryWhatsappIdentity=${hasPrimaryWhatsappIdentity ? "yes" : "no"}`,
  ].join(" ");

  return {
    tenantId: input.tenantId,
    saasId: input.saasId,
    automationKey: CLINIC_DAILY_APPOINTMENT_HEALTH_KEY,
    shouldRegisterAutomation,
    shouldEnsureWhatsappProvider,
    shouldCreateWhatsappIntegration,
    integrationStatus,
    hasPrimaryWhatsappIdentity,
    summary,
  };
}
