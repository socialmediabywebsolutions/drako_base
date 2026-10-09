export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { SocialFlowOrchestrator } from "@/lib/socialflow/ai/SocialFlowOrchestrator";
import { intelligenceModel } from "@/lib/socialflow/ai/models/anthropicModel";

// Called only from socialflow-whatsapp-handler.ts (server-to-server, same deployment) —
// never directly by the WhatsApp channel worker or a browser. Reuses DRAKO_ROUTER_SECRET
// (already required to protect /api/conversation-router) instead of provisioning a new secret.
function validateBearer(request: Request): boolean {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return false;
  const token = auth.slice(7).trim();
  const expected = process.env.DRAKO_ROUTER_SECRET ?? "";
  return expected.length > 0 && token === expected;
}

type WhatsappReplyPayload = { reply: string };

export async function POST(request: Request) {
  if (!validateBearer(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    tenantId?: string;
    saasId?: string;
    phoneNumber?: string;
    message?: string;
  } | null;

  const tenantId = body?.tenantId?.trim();
  const saasId = body?.saasId?.trim();
  const message = body?.message?.trim();

  if (!tenantId || !saasId || !message) {
    return NextResponse.json(
      { error: "INVALID_BODY", message: "tenantId, saasId and message are required" },
      { status: 400 },
    );
  }

  try {
    // buildProfile is fast (profile + KB read) — deliberately NOT generateFullCampaign
    // or any cascading agent: a WhatsApp reply must return within the request's own
    // lifecycle, not a queue's.
    const profile = await new SocialFlowOrchestrator().buildProfile({
      tenantId,
      saasId,
      niche: "",
      tone: "",
      frequencyPerWeek: 1,
      accountType: null,
    });

    const fallbackReply = `Gracias por escribir a ${profile.brandIdentity}. En breve te responderemos.`;

    const { data } = await intelligenceModel.generateStructured<WhatsappReplyPayload>(
      {
        tenantId,
        saasId,
        prompt: `Eres el asistente de WhatsApp de "${profile.brandIdentity}" (nicho: ${profile.niche}). Tono: ${profile.toneOfVoice}.
Responde en español, en 1-3 frases, directo y útil, a este mensaje de un cliente/lead por WhatsApp:
"${message}"`,
      },
      () => ({ reply: fallbackReply }),
    );

    return NextResponse.json({ reply: data.reply?.trim() || fallbackReply });
  } catch (error) {
    console.error("SOCIALFLOW_WHATSAPP_MESSAGE_ERROR", error);
    return NextResponse.json({ error: "SOCIALFLOW_ERROR", message: "Unable to generate reply" }, { status: 500 });
  }
}
