import {
  AutomationCoreError,
  disableAutomation,
  enableAutomation,
  getAutomation,
  listAutomations,
  registerAutomation,
  type AutomationRegistration,
} from "@/lib/automation-core";

export type SocialAutomationRegistryItem = {
  tenantId: string;
  saasId: string;
  niche: string;
  tone: string;
  frequencyPerWeek: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UpsertSocialAutomationRegistryInput = {
  tenantId: string;
  saasId: string;
  niche: string;
  tone: string;
  frequencyPerWeek: number;
  enabled?: boolean;
};

const SOCIAL_AUTOMATION_REGISTRY_KEY = "socialflow.content_generation";
const SOCIAL_AUTOMATION_DISPLAY_NAME = "Socialcors content generation";
const SOCIAL_AUTOMATION_DESCRIPTION = "Generates and schedules Socialcors campaigns for an owned SaaS workspace.";

function normalizeText(value: string, errorCode: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new AutomationCoreError(errorCode);
  }
  return normalized;
}

function normalizeFrequencyPerWeek(value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new AutomationCoreError("SOCIAL_AUTOMATION_REGISTRY_FREQUENCY_INVALID");
  }
  return value;
}

function readConfigText(config: Record<string, unknown> | null, key: "niche" | "tone"): string {
  const value = config?.[key];
  return typeof value === "string" ? value : "";
}

function readConfigFrequency(registration: AutomationRegistration): number {
  const value = registration.config?.frequencyPerWeek;
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof registration.frequencyValue === "number" && Number.isInteger(registration.frequencyValue) && registration.frequencyValue > 0) {
    return registration.frequencyValue;
  }
  return 1;
}

function mapRegistration(registration: AutomationRegistration): SocialAutomationRegistryItem {
  const config = (registration.config ?? null) as Record<string, unknown> | null;

  return {
    tenantId: registration.tenantId,
    saasId: registration.saasId,
    niche: readConfigText(config, "niche"),
    tone: readConfigText(config, "tone"),
    frequencyPerWeek: readConfigFrequency(registration),
    enabled: registration.enabled,
    createdAt: registration.createdAt,
    updatedAt: registration.updatedAt,
  };
}

export async function upsertSocialAutomationRegistryItem(
  input: UpsertSocialAutomationRegistryInput,
): Promise<SocialAutomationRegistryItem> {
  const tenantId = normalizeText(input.tenantId, "SOCIAL_AUTOMATION_REGISTRY_TENANT_REQUIRED");
  const saasId = normalizeText(input.saasId, "SOCIAL_AUTOMATION_REGISTRY_SAAS_REQUIRED");
  const niche = normalizeText(input.niche, "SOCIAL_AUTOMATION_REGISTRY_NICHE_REQUIRED");
  const tone = normalizeText(input.tone, "SOCIAL_AUTOMATION_REGISTRY_TONE_REQUIRED");
  const frequencyPerWeek = normalizeFrequencyPerWeek(input.frequencyPerWeek);

  const registration = await registerAutomation({
    tenantId,
    saasId,
    automationKey: SOCIAL_AUTOMATION_REGISTRY_KEY,
    displayName: SOCIAL_AUTOMATION_DISPLAY_NAME,
    description: SOCIAL_AUTOMATION_DESCRIPTION,
    enabled: input.enabled,
    scheduleMode: "scheduled",
    frequencyUnit: "week",
    frequencyValue: frequencyPerWeek,
    config: {
      niche,
      tone,
      frequencyPerWeek,
    },
    ownerScope: "OWNER",
  });

  return mapRegistration(registration);
}

export async function getSocialAutomationRegistryItem(
  tenantId: string,
  saasId: string,
): Promise<SocialAutomationRegistryItem | null> {
  const registration = await getAutomation(tenantId, saasId, SOCIAL_AUTOMATION_REGISTRY_KEY);
  return registration ? mapRegistration(registration) : null;
}

export async function listSocialAutomationRegistryItems(): Promise<SocialAutomationRegistryItem[]> {
  const registrations = await listAutomations({
    automationKey: SOCIAL_AUTOMATION_REGISTRY_KEY,
  });
  return registrations.map(mapRegistration);
}

export async function listEnabledSocialAutomationRegistryItems(): Promise<SocialAutomationRegistryItem[]> {
  const registrations = await listAutomations({
    automationKey: SOCIAL_AUTOMATION_REGISTRY_KEY,
    enabled: true,
  });
  return registrations.map(mapRegistration);
}

export async function setSocialAutomationRegistryEnabled(
  tenantId: string,
  saasId: string,
  enabled: boolean,
): Promise<SocialAutomationRegistryItem | null> {
  const existing = await getAutomation(tenantId, saasId, SOCIAL_AUTOMATION_REGISTRY_KEY);
  if (!existing) {
    return null;
  }

  const registration = enabled
    ? await enableAutomation(tenantId, saasId, SOCIAL_AUTOMATION_REGISTRY_KEY)
    : await disableAutomation(tenantId, saasId, SOCIAL_AUTOMATION_REGISTRY_KEY);

  return mapRegistration(registration);
}

export async function removeSocialAutomationRegistryItem(
  tenantId: string,
  saasId: string,
): Promise<boolean> {
  const existing = await getAutomation(tenantId, saasId, SOCIAL_AUTOMATION_REGISTRY_KEY);
  if (!existing) {
    return false;
  }

  throw new AutomationCoreError(
    "SOCIAL_AUTOMATION_REGISTRY_REMOVE_UNSUPPORTED",
    "automation-core does not expose a safe delete operation for automation registrations",
  );
}
