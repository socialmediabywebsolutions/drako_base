export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import {
  acceptTenantInvite,
  createWorkspaceSession,
  createWorkspaceUser,
  getTenantInviteByToken,
  getWorkspaceUserWithPasswordByEmail,
} from "@/lib/auth/campamento-core";
import { verifyPassword } from "@/lib/auth/crypto";
import { getSession, requireSession, UnauthorizedError } from "@/lib/auth/session";

function setWorkspaceSessionCookie(response: NextResponse, request: Request, sessionToken: string, expires: string) {
  const protocol = new URL(request.url).protocol;
  const secure = protocol === "https:";
  const cookieName = secure ? "__Secure-next-auth.session-token" : "next-auth.session-token";
  response.cookies.set(cookieName, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    expires: new Date(expires),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { token?: string; password?: string; name?: string } | null;
    const token = body?.token?.trim();
    if (!token) {
      return NextResponse.json({ ok: false, code: "INVALID_INPUT", message: "token is required" }, { status: 400 });
    }

    const invite = await getTenantInviteByToken(token);
    if (!invite) {
      return NextResponse.json({ ok: false, code: "INVITE_NOT_FOUND" }, { status: 404 });
    }

    let session = await getSession(request);
    let sessionTokenToSet: { token: string; expires: string } | null = null;

    if (!session) {
      if (!body?.password) {
        return NextResponse.json({ ok: false, code: "AUTH_REQUIRED" }, { status: 401 });
      }
      const existing = await getWorkspaceUserWithPasswordByEmail(invite.email);
      if (existing) {
        const valid = await verifyPassword(body.password, existing.hash, existing.salt, existing.iterations);
        if (!valid) {
          return NextResponse.json({ ok: false, code: "INVALID_CREDENTIALS" }, { status: 401 });
        }
        const createdSession = await createWorkspaceSession(existing.id);
        session = {
          userId: existing.id,
          email: existing.email,
          tenantId: existing.activeTenantId ?? invite.tenantId,
          role: "MEMBER",
          issuedAt: Date.now(),
          authMode: "nextauth_database",
        };
        sessionTokenToSet = { token: createdSession.sessionToken, expires: createdSession.expires };
      } else {
        const createdUser = await createWorkspaceUser({
          email: invite.email,
          password: body.password,
          name: body.name ?? invite.email.split("@")[0],
        });
        const createdSession = await createWorkspaceSession(createdUser.id);
        session = {
          userId: createdUser.id,
          email: createdUser.email,
          tenantId: invite.tenantId,
          role: "MEMBER",
          issuedAt: Date.now(),
          authMode: "nextauth_database",
        };
        sessionTokenToSet = { token: createdSession.sessionToken, expires: createdSession.expires };
      }
    }

    if (!session?.userId) {
      return NextResponse.json({ ok: false, code: "WORKSPACE_SESSION_REQUIRED" }, { status: 403 });
    }

    const membership = await acceptTenantInvite({
      token,
      userId: session.userId,
      email: session.email,
    });
    const response = NextResponse.json({ ok: true, membership });
    if (sessionTokenToSet) {
      setWorkspaceSessionCookie(response, request, sessionTokenToSet.token, sessionTokenToSet.expires);
    }
    return response;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, code: error.message }, { status: error.status });
    }
    const code = error instanceof Error ? error.message : "INTERNAL_ERROR";
    const status = code === "INVITE_EMAIL_MISMATCH" ? 403 : code === "INVITE_EXPIRED" ? 410 : 500;
    console.error("INVITE_ACCEPT_ERROR", error);
    return NextResponse.json({ ok: false, code }, { status });
  }
}
