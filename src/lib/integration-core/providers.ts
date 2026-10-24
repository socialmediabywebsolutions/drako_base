import type { IntegrationProvider } from "@/lib/integration-core/types";

const integrationProviders = new Map<string, IntegrationProvider>();

export function registerIntegrationProvider(integrationKey: string, provider: IntegrationProvider): void {
  integrationProviders.set(integrationKey, provider);
}

export function getIntegrationProvider(integrationKey: string): IntegrationProvider | null {
  return integrationProviders.get(integrationKey) ?? null;
}
