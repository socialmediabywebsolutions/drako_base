import { WHATSAPP_INTEGRATION_KEY } from "@/lib/integration-core/providers/whatsapp";
import type { SaasPlatformBootstrap, SaasPlatformDefinition } from "@/lib/saas-contract";
import { defineSaasPlatform, defineSaasPlatformBootstrap } from "@/lib/saas-contract";
import { CLINIC_DAILY_APPOINTMENT_HEALTH_KEY, registerClinicPlatform as bootstrapClinicPlatform } from "@/lib/clinic/service";

export const CLINIC_PLATFORM_SAAS_ID = "clinic";

function isClinicSaas(saasId: string): boolean {
  const normalized = saasId.trim().toLowerCase();
  return normalized === CLINIC_PLATFORM_SAAS_ID || normalized.includes(CLINIC_PLATFORM_SAAS_ID);
}

export const clinicPlatformDefinition: SaasPlatformDefinition = defineSaasPlatform({
  saasId: CLINIC_PLATFORM_SAAS_ID,
  displayName: "Clinic",
  category: "operations",
  supportsOperatorSurface: true,
  matchesSaasId: isClinicSaas,
  automations: [
    {
      automationKey: CLINIC_DAILY_APPOINTMENT_HEALTH_KEY,
      displayName: "Clinic daily appointment health",
      enabledByDefault: true,
      description: "Audits upcoming appointments, unconfirmed bookings and overdue followups.",
    },
  ],
  integrations: [
    {
      integrationKey: WHATSAPP_INTEGRATION_KEY,
      required: false,
      description: "Reusable WhatsApp connection used by clinic workflows and operator actions.",
    },
  ],
});

export const clinicPlatformBootstrap: SaasPlatformBootstrap = defineSaasPlatformBootstrap({
  saasId: CLINIC_PLATFORM_SAAS_ID,
  async connect({ tenantId, saasId }) {
    await bootstrapClinicPlatform(tenantId, saasId);
  },
});
