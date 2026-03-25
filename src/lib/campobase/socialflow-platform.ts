import { LINKEDIN_INTEGRATION_KEY, ensureLinkedInIntegrationAvailable } from "@/lib/integration-core/providers/linkedin";
import type { SaasPlatformBootstrap, SaasPlatformDefinition } from "@/lib/saas-contract";
import { defineSaasPlatform, defineSaasPlatformBootstrap } from "@/lib/saas-contract";

export const SOCIALFLOW_PLATFORM_SAAS_ID = "socialflow";

function isSocialFlowSaas(saasId: string): boolean {
  const normalized = saasId.trim().toLowerCase();
  return normalized === SOCIALFLOW_PLATFORM_SAAS_ID || normalized.includes(SOCIALFLOW_PLATFORM_SAAS_ID);
}

export const socialFlowPlatformDefinition: SaasPlatformDefinition = defineSaasPlatform({
  saasId: SOCIALFLOW_PLATFORM_SAAS_ID,
  displayName: "SocialFlow",
  category: "social",
  supportsOperatorSurface: true,
  matchesSaasId: isSocialFlowSaas,
  automations: [
    {
      automationKey: "socialflow.content_generation",
      displayName: "SocialFlow content generation",
      enabledByDefault: true,
      description: "Generates and schedules SocialFlow campaigns for an owned SaaS workspace.",
    },
    {
      automationKey: "socialflow.health_check",
      displayName: "SocialFlow health check",
      enabledByDefault: true,
      description: "Checks whether the SocialFlow automation setup is minimally healthy and executable.",
    },
  ],
  integrations: [
    {
      integrationKey: LINKEDIN_INTEGRATION_KEY,
      required: false,
      description: "Optional live publishing and validation through LinkedIn.",
    },
  ],
});

export const socialFlowPlatformBootstrap: SaasPlatformBootstrap = defineSaasPlatformBootstrap({
  saasId: SOCIALFLOW_PLATFORM_SAAS_ID,
  async connect() {
    await import("@/lib/campobase/socialflow-service");
    await ensureLinkedInIntegrationAvailable();
  },
});
