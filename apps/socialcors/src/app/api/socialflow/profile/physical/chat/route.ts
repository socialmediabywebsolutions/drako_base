export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { guardAiAccess } from "@/lib/socialflow/billing/enforce";
import { SocialContextError } from "@/lib/socialflow/repository";
import { PhysicalProfileChatAgent, PHYSICAL_CHAT_QUESTIONS, type PhysicalChatQuestionKey } from "@/lib/socialflow/ai/agents/PhysicalProfileChatAgent";

const DEFAULT_SAAS_ID = "socialflow";
const QUESTION_KEYS = PHYSICAL_CHAT_QUESTIONS.map((q) => q.key);

type ChatRequestBody = {
  saasId?: string | null;
  questionKey?: string | null;
  userMessage?: string | null;
};

export async function POST(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);

    const aiGuard = await guardAiAccess(session.tenantId, session.role);
    if (!aiGuard.ok) {
      return NextResponse.json({ ok: false, error: aiGuard.code, message: aiGuard.message }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as ChatRequestBody | null;
    const saasId = body?.saasId?.trim() || DEFAULT_SAAS_ID;
    const questionKey = body?.questionKey as PhysicalChatQuestionKey | undefined;
    const userMessage = typeof body?.userMessage === "string" ? body.userMessage.trim() : "";

    if (!questionKey || !QUESTION_KEYS.includes(questionKey)) {
      return NextResponse.json({ ok: false, error: "INVALID_QUESTION_KEY" }, { status: 400 });
    }
    if (!userMessage) {
      return NextResponse.json({ ok: false, error: "USER_MESSAGE_REQUIRED" }, { status: 400 });
    }

    const output = await new PhysicalProfileChatAgent().run({
      tenantId: session.tenantId,
      saasId,
      questionKey,
      userMessage,
    });

    return NextResponse.json({ ok: true, ...output });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ ok: false, error: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_PHYSICAL_PROFILE_CHAT_ERROR", error);
    return NextResponse.json({ ok: false, error: "Failed to process physical profile chat turn" }, { status: 500 });
  }
}
