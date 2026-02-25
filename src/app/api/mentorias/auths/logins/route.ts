export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { mentoriasAuths } from "@/lib/auths/mentorias-auths";
import { jsonError, setAuthsSessionCookie } from "@/lib/auths/http";
import { isAuthsIsolationEnabled } from "@/lib/auths/flags";
import { resolveAuthsContextFromRequest } from "@/lib/auths/contexts";

type LoginBody = {
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  if (!isAuthsIsolationEnabled()) {
    return jsonError("AUTHS_ISOLATIONS_DISABLED", "Auth isolation is disabled.", 503);
  }

  const requestContext = resolveAuthsContextFromRequest(request);
  if (requestContext !== "mentorias") {
    return jsonError("HOST_CONTEXT_MISMATCH", "Invalid host for mentorias auth boundary.", 403);
  }
  const body = (await request.json().catch(() => null)) as LoginBody | null;
  if (!body?.email || !body.password) {
    return jsonError("INVALID_INPUT", "Email and password are required.");
  }

  const login = await mentoriasAuths.login({
    context: "mentorias",
    email: body.email,
    password: body.password,
  });
  if (!login.ok) {
    return jsonError(login.code, login.message, 401);
  }

  const response = NextResponse.json({
    ok: true,
    role: login.role,
    tenantId: login.tenantId,
  });
  setAuthsSessionCookie({ response, context: "mentorias", token: login.token });
  return response;
}
