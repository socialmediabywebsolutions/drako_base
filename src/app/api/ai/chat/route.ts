import { NextResponse } from "next/server";
import { runAi } from "@/lib/ai/client";
import { requireTenantAccess } from "@/lib/auth/session";

export const runtime = "edge";

type Body = {
  messages?: { role: "system" | "user" | "assistant"; content: string }[];
  agentId?: string;
  department?: string;
  tenantId?: string;
  saasId?: string;
  plan?: string;
  mode?: "fast" | "smart";
  cache?: boolean;
};

export async function POST(req: Request) {
  try {
    const { tenantId: sessionTenant } = await requireTenantAccess(req);
    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body?.messages || body.messages.length === 0) {
      return NextResponse.json({ ok: false, error: "messages required" }, { status: 400 });
    }
    const mode = body.mode === "smart" ? "smart" : "fast";
    const tenantId = body.tenantId ?? sessionTenant;
    const resp = await runAi({
      messages: body.messages,
      tenantId,
      saasId: body.saasId ?? null,
      agentId: body.agentId ?? null,
      department: body.department ?? null,
      plan: body.plan ?? null,
      mode,
      cache: body.cache,
    });
    const { ok: _ok, ...rest } = resp;
    void _ok;
    return NextResponse.json({ ok: true, ...rest });
  } catch (error) {
    console.error("AI_CHAT_ERROR", error);
    return NextResponse.json({ ok: false, error: "AI unavailable" }, { status: 503 });
  }
}
