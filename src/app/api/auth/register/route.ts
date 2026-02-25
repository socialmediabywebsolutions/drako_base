export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { isAuthsIsolationEnabled, isAuthsLegacyCompatEnabled, isAuthsLegacyRegisterEnabled } from "@/lib/auths/flags";
import { resolveLegacyAuthsContext } from "@/lib/auths/contexts";
import { drakosAuths } from "@/lib/auths/drakos-auths";
import { mentoriasAuths } from "@/lib/auths/mentorias-auths";
import { setAuthsSessionCookie } from "@/lib/auths/http";

/**
 * OPERACIÓN OLIMPO: Registro Definitivo (Tabula Rasa)
 * --------------------------------------------------
 * - 0 Proxies externos.
 * - 1 Lectura de req.json().
 * - Logs JSON atómicos con correlationId.
 * - Hashing WebCrypto a 100k iteraciones.
 * - Integridad de tablas D1 verificada.
 */
export async function POST(req: Request) {
  if (!isAuthsIsolationEnabled()) {
    return NextResponse.json(
      { ok: false, code: "LEGACY_REGISTER_DISABLED", message: "Legacy register endpoint is disabled." },
      { status: 410 },
    );
  }

  if (!isAuthsLegacyCompatEnabled() || !isAuthsLegacyRegisterEnabled()) {
    return NextResponse.json(
      { ok: false, code: "AUTHS_LEGACY_REGISTER_DISABLED", message: "Legacy register endpoint is disabled." },
      { status: 410 },
    );
  }

  const body = (await req.json().catch(() => null)) as { email?: string; password?: string; name?: string; tenantId?: string } | null;
  if (!body?.email || !body.password) {
    return NextResponse.json(
      { ok: false, code: "INVALID_INPUT", message: "Email and password are required." },
      { status: 400 },
    );
  }

  const context = resolveLegacyAuthsContext(req);
  if (context === "bases") {
    return NextResponse.json(
      { ok: false, code: "BASES_FINAL_USER_AUTH_DISABLED", message: "Campamento Base does not expose final-user registration." },
      { status: 403 },
    );
  }

  const factory = context === "mentorias" ? mentoriasAuths : drakosAuths;
  const registered = await factory.register({
    context,
    email: body.email,
    password: body.password,
    name: body.name ?? null,
    tenantId: body.tenantId ?? null,
  });

  if (!registered.ok) {
    return NextResponse.json(
      { ok: false, code: registered.code, message: registered.message },
      { status: registered.code === "EMAIL_EXISTS" ? 409 : 400 },
    );
  }

  const login = await factory.login({
    context,
    email: body.email,
    password: body.password,
  });
  if (!login.ok) {
    return NextResponse.json(
      { ok: false, code: login.code, message: login.message },
      { status: 401 },
    );
  }

  const response = NextResponse.json({
    ok: true,
    user: {
      id: registered.userId,
      email: body.email.trim().toLowerCase(),
      role: login.role,
      tenantId: login.tenantId,
    },
    context,
  }, { status: 201 });

  setAuthsSessionCookie({ response, context, token: login.token });
  return response;
}
