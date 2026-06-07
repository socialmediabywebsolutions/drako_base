import type {
  SocialAutomationRegistryItem,
  UpsertSocialAutomationRegistryInput,
} from "@/lib/campamento-base/social-automation-registry";
import {
  getSocialAutomationRegistryItem,
  listEnabledSocialAutomationRegistryItems,
  listSocialAutomationRegistryItems,
  removeSocialAutomationRegistryItem,
  setSocialAutomationRegistryEnabled,
  upsertSocialAutomationRegistryItem,
} from "@/lib/campamento-base/social-automation-registry";

// Legacy namespace frozen:
// - src/lib/campobase/ is the frozen legacy namespace.
// - This file exists only as a temporary compatibility adapter.
// - Canonical module lives at src/lib/campamento-base/social-automation-registry.ts.
// - Consumers are migrated file-by-file to canonical namespaces.

export type CampoBaseSocialAutomationRegistryItem = SocialAutomationRegistryItem;
export type UpsertCampoBaseSocialAutomationRegistryInput = UpsertSocialAutomationRegistryInput;

export async function upsertCampoBaseSocialAutomationRegistry(
  input: UpsertCampoBaseSocialAutomationRegistryInput,
): Promise<CampoBaseSocialAutomationRegistryItem> {
  return upsertSocialAutomationRegistryItem(input);
}

export async function getCampoBaseSocialAutomationRegistryItem(
  tenantId: string,
  saasId: string,
): Promise<CampoBaseSocialAutomationRegistryItem | null> {
  return getSocialAutomationRegistryItem(tenantId, saasId);
}

export async function listCampoBaseSocialAutomationRegistryItems(): Promise<CampoBaseSocialAutomationRegistryItem[]> {
  return listSocialAutomationRegistryItems();
}

export async function listEnabledCampoBaseSocialAutomationRegistryItems(): Promise<CampoBaseSocialAutomationRegistryItem[]> {
  return listEnabledSocialAutomationRegistryItems();
}

export async function setCampoBaseSocialAutomationEnabled(
  tenantId: string,
  saasId: string,
  enabled: boolean,
): Promise<CampoBaseSocialAutomationRegistryItem | null> {
  return setSocialAutomationRegistryEnabled(tenantId, saasId, enabled);
}

export async function removeCampoBaseSocialAutomationRegistryItem(
  tenantId: string,
  saasId: string,
): Promise<boolean> {
  return removeSocialAutomationRegistryItem(tenantId, saasId);
}
