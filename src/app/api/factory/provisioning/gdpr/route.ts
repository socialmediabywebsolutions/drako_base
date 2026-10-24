export const dynamic = "force-dynamic";

import { blockedProvisioningRoute } from "@/app/api/factory/provisioning/_blocked";

export async function POST(): Promise<Response> {
  return blockedProvisioningRoute();
}
