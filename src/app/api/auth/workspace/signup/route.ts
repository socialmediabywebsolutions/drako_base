export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createWorkspaceUserWithTenant } from "@/lib/auth/campamento-core";

type Body = {
  email?: string;
  password?: string;
  name?: string;
  workspaceName?: string;
};

function resolveWorkspaceName(input: { workspaceName?: string; name?: string; email?: string }): string {
  const explicit = input.workspaceName?.trim();
  if (explicit) return explicit;
  const fallback = input.name?.trim() || input.email?.split("@")[0] || "New Workspace";
  return `${fallback} Workspace`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Body | null;
    const email = body?.email?.trim().toLowerCase();
    const password = body?.password ?? "";
    const name = body?.name?.trim();

    if (!email || !password || password.length < 8) {
      return NextResponse.json({ ok: false, code: "INVALID_INPUT" }, { status: 400 });
    }

    const created = await createWorkspaceUserWithTenant({
      email,
      password,
      name,
      tenantName: resolveWorkspaceName({
        workspaceName: body?.workspaceName,
        name,
        email,
      }),
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: created.user.id,
        email: created.user.email,
        name: created.user.name,
      },
      membership: {
        tenantId: created.membership.tenantId,
        role: created.membership.role,
      },
    }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "INTERNAL_ERROR";
    const status = code === "EMAIL_EXISTS" ? 409 : 500;
    console.error("WORKSPACE_SIGNUP_ERROR", error);
    return NextResponse.json({ ok: false, code }, { status });
  }
}
