import { NextResponse } from "next/server";

const BLOCKED_PROVISIONING_RESPONSE = {
  ok: false,
  error: "FACTORY_PROVISIONING_ROUTE_BLOCKED",
  message: "This legacy provisioning route is disabled until it is reintroduced with canonical server-side authorization.",
};

export function blockedProvisioningRoute(): NextResponse {
  return NextResponse.json(BLOCKED_PROVISIONING_RESPONSE, { status: 410 });
}
