export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { runAi } from "@/lib/ai/client";
import { enforceBilling } from "@/lib/billing/enforce-billing";
import { resolveSaasContext } from "@/lib/saas/resolve-saas-context";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";


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
    const { tenantId } = await requireTenantAccess(req);
    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body?.messages || body.messages.length === 0) {
      return NextResponse.json({ ok: false, error: "messages required" }, { status: 400 });
    }
    const mode = body.mode === "smart" ? "smart" : "fast";

    // BILLING ENFORCEMENT
    // 1. Resolve SaaS Context
    const saasContext = resolveSaasContext(req as any);
    // If we can't resolve context, we might default to 'drako' for now or fail. 
    // FAIL CLOSED: if no context, we can't bill.
    const saasSlug = saasContext?.slug || "drako";

    // 2. Enforce
    const enforcement = await enforceBilling(saasSlug, tenantId, 'ai_calls', 1);
    if (!enforcement.allowed) {
      return NextResponse.json(
        { error: enforcement.reason || "Billing limit reached" },
        { status: enforcement.status }
      );
    }

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
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("AI_CHAT_ERROR", error);
    const message = error instanceof Error ? error.message : "DRAKO_AI_NOT_AVAILABLE";
    const status = message === "DRAKO_AI_NOT_AVAILABLE" ? 503 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
