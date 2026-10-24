export type ClinicControlPlaneHandlerRegistrationInput = {
  tenantId: string;
  saasId: string;
  automationExists?: boolean;
  handlerRegistered?: boolean;
  whatsappProviderAvailable?: boolean;
  whatsappIntegrationExists?: boolean;
  hasPrimaryWhatsappIdentity?: boolean;
};

export type ClinicControlPlaneExpectedEffect =
  | "REGISTER_AUTOMATION"
  | "REGISTER_AUTOMATION_HANDLER"
  | "ENSURE_WHATSAPP_PROVIDER"
  | "CREATE_WHATSAPP_INTEGRATION";

export type ClinicControlPlaneHandlerRegistrationPlan = {
  tenantId: string;
  saasId: string;
  automationKey: "clinic.daily_appointment_health";
  shouldRegisterAutomation: boolean;
  shouldRegisterHandler: boolean;
  expectedEffects: ClinicControlPlaneExpectedEffect[];
  integrationStatus: "CONNECTED" | "PENDING" | "MISSING";
  summary: string;
};

const CLINIC_DAILY_APPOINTMENT_HEALTH_KEY = "clinic.daily_appointment_health";

function assertIdentity(input: ClinicControlPlaneHandlerRegistrationInput): void {
  if (!input.tenantId.trim() || !input.saasId.trim()) {
    throw new Error("Clinic handler registration plan requires tenantId and saasId.");
  }
}

export function planClinicControlPlaneHandlerRegistration(
  input: ClinicControlPlaneHandlerRegistrationInput,
): ClinicControlPlaneHandlerRegistrationPlan {
  assertIdentity(input);

  const automationExists = input.automationExists ?? false;
  const handlerRegistered = input.handlerRegistered ?? false;
  const whatsappProviderAvailable = input.whatsappProviderAvailable ?? true;
  const whatsappIntegrationExists = input.whatsappIntegrationExists ?? false;
  const hasPrimaryWhatsappIdentity = input.hasPrimaryWhatsappIdentity ?? false;

  const shouldRegisterAutomation = !automationExists;
  const shouldRegisterHandler = !handlerRegistered;
  const shouldCreateWhatsappIntegration = whatsappProviderAvailable && !whatsappIntegrationExists;

  const integrationStatus: "CONNECTED" | "PENDING" | "MISSING" = !whatsappProviderAvailable
    ? "MISSING"
    : hasPrimaryWhatsappIdentity
      ? "CONNECTED"
      : "PENDING";

  const expectedEffects: ClinicControlPlaneExpectedEffect[] = [];

  if (shouldRegisterHandler) {
    expectedEffects.push("REGISTER_AUTOMATION_HANDLER");
  }

  expectedEffects.push("ENSURE_WHATSAPP_PROVIDER");

  if (shouldRegisterAutomation) {
    expectedEffects.push("REGISTER_AUTOMATION");
  }

  if (shouldCreateWhatsappIntegration) {
    expectedEffects.push("CREATE_WHATSAPP_INTEGRATION");
  }

  const summary = [
    `Clinic handler-registration plan for ${input.tenantId}/${input.saasId}:`,
    `registerHandler=${shouldRegisterHandler ? "yes" : "no"}`,
    `registerAutomation=${shouldRegisterAutomation ? "yes" : "no"}`,
    `integrationStatus=${integrationStatus}`,
    `expectedEffects=${expectedEffects.join(",") || "none"}`,
  ].join(" ");

  return {
    tenantId: input.tenantId,
    saasId: input.saasId,
    automationKey: CLINIC_DAILY_APPOINTMENT_HEALTH_KEY,
    shouldRegisterAutomation,
    shouldRegisterHandler,
    expectedEffects,
    integrationStatus,
    summary,
  };
}
