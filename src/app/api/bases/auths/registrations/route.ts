export const dynamic = "force-dynamic";

import { jsonError } from "@/lib/auths/http";
import { resolveAuthsContextFromRequest } from "@/lib/auths/contexts";

export async function POST(request: Request) {
  if (resolveAuthsContextFromRequest(request) !== "bases") {
    return jsonError("HOST_CONTEXT_MISMATCH", "Invalid host for bases auth boundary.", 403);
  }

  return jsonError(
    "BASES_FINAL_USER_AUTH_DISABLED",
    "Campamento Base does not support final-user registration.",
    403,
  );
}
