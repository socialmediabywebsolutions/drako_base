export const dynamic = "force-dynamic";

import { jsonError } from "@/lib/auths/http";
import { enforceAuthBoundary } from "@/lib/auths/ssot";

export async function POST(request: Request) {
  const boundary = enforceAuthBoundary({ request, expectedContext: "bases", endpoint: "/api/bases/auths/registrations" });
  if (!boundary.ok) return boundary.response;

  return jsonError(
    "BASES_FINAL_USER_AUTH_DISABLED",
    "Campamento Base does not support final-user registration.",
    403,
  );
}
