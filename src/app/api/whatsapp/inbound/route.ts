import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { handleWhatsappApiError } from "@/lib/whatsapp/api-helpers";
import { runWhatsappAutomation } from "@/lib/whatsapp/automation";
export const runtime = "edge";


export async function POST(request: Request) {
  try {
    const { tenantId: sessionTenantId } = await requireTenantAccess(request);
    const body = (await request.json().catch(() => null)) as
      | { tenantId?: string; saasId?: string; phoneNumber?: string; body?: string; metadata?: Record<string, unknown> }
      | null;
    const tenantId = body?.tenantId ?? sessionTenantId;
    if (tenantId !== sessionTenantId) {
      return NextResponse.json({ code: "INVALID_TENANT", message: "Tenant mismatch" }, { status: 403 });
    }
    const saasId = body?.saasId?.trim();
    const phoneNumber = body?.phoneNumber?.trim();
    const content = body?.body?.trim();
    if (!saasId || !phoneNumber || !content) {
      return NextResponse.json({ code: "INVALID_INPUT", message: "saasId, phoneNumber y body son obligatorios" }, { status: 400 });
    }
    const result = await runWhatsappAutomation({
      tenantId,
      saasId,
      phoneNumber,
      body: content,
      metadata: body?.metadata ?? null,
    });
    return NextResponse.json({
      messages: result.messagesToSend.map((msg) => msg.body),
      conversationId: result.linkedConversationId ?? null,
      intents: result.intents,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    return handleWhatsappApiError(error);
  }
}
