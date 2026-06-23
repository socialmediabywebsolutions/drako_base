export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { env } from "@/lib/cf";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { guardAiAccess } from "@/lib/socialflow/billing/enforce";
import { resolveSocialContext, upsertSaasSocialCampaign } from "@/lib/socialflow/repository";
import { getKnowledgeContext } from "@/lib/socialflow/knowledge/repository";
import { getChannelProfile } from "@/lib/socialflow/profile/repository";

// ---------------------------------------------------------------------------
// Intent extraction — uses Workers AI Llama when available, regex fallback
// ---------------------------------------------------------------------------

type ParsedIntent = {
  action: "generate" | "modify" | "chat";
  topic: string;
  tone: string;
  frequencyPerWeek: number;
  reply: string;
};

const GENERATE_KEYWORDS_ES = ["genera", "crea", "quiero", "necesito", "haz", "hazme", "prepara", "campaña", "posts", "publicaciones", "contenido"];
const MODIFY_KEYWORDS_ES = ["cambia", "modifica", "actualiza", "mejora", "regenera", "hazlos", "más formal", "más casual", "más corto", "más largo", "cambia el tono"];

function extractFrequency(message: string): number {
  const m = message.match(/(\d+)\s*(?:post|publicaci|contenid|por\s*semana|a\s*la\s*semana)/i);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 28) return n;
  }
  return 7;
}

function extractTopic(message: string): string {
  return message
    .replace(/\b(genera|crea|quiero|necesito|haz|hazme|prepara|una|un|los|las|mi|mis)\b/gi, "")
    .replace(/\b(\d+)\s*(posts?|publicaciones?)\b/gi, "")
    .replace(/\b(esta semana|este mes|para hoy)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

async function parseIntentWithAI(
  message: string,
  knowledgeContext: string,
  defaultTone: string,
  defaultNiche: string,
): Promise<ParsedIntent | null> {
  const e = env();
  if (!e?.AI) return null;

  const systemPrompt = `You are a marketing AI assistant parsing requests in Spanish. Extract campaign parameters from the user message and return ONLY valid JSON (no markdown, no explanation).

Brand Knowledge Base:
${knowledgeContext || `Niche: ${defaultNiche}. Tone: ${defaultTone}.`}

Return this JSON structure:
{
  "action": "generate" | "modify" | "chat",
  "topic": "<short campaign topic in Spanish, max 80 chars>",
  "tone": "<communication tone, use brand default if not specified>",
  "frequencyPerWeek": <integer 1-28, default 7>,
  "reply": "<your response to user in Spanish, 1-2 sentences, warm and professional>"
}

action="generate": user wants to create posts/campaign
action="modify": user wants to change existing posts
action="chat": general question or greeting`;

  try {
    const result = await e.AI.run("@cf/meta/llama-3.1-70b-instruct", {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
    }) as { response?: string };

    const raw = result?.response?.trim() ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as Partial<ParsedIntent>;
    return {
      action: parsed.action ?? "generate",
      topic: (parsed.topic ?? extractTopic(message)) || defaultNiche,
      tone: parsed.tone ?? defaultTone,
      frequencyPerWeek: typeof parsed.frequencyPerWeek === "number" ? parsed.frequencyPerWeek : extractFrequency(message),
      reply: parsed.reply ?? "Entendido, procesando tu solicitud...",
    };
  } catch {
    return null;
  }
}

function parseIntentFallback(
  message: string,
  defaultTone: string,
  defaultNiche: string,
): ParsedIntent {
  const lower = message.toLowerCase();
  const isGenerate = GENERATE_KEYWORDS_ES.some((k) => lower.includes(k));
  const isModify = MODIFY_KEYWORDS_ES.some((k) => lower.includes(k));

  const action = isModify ? "modify" : isGenerate ? "generate" : "chat";
  const freq = extractFrequency(message);
  const topic = extractTopic(message) || defaultNiche;

  const replyMap: Record<string, string> = {
    generate: `Perfecto, voy a generar ${freq} posts${topic ? ` sobre "${topic}"` : ""}. Un momento...`,
    modify: "Entendido. Voy a regenerar los posts con los cambios solicitados.",
    chat: "Puedo ayudarte a generar campañas y posts. Dime qué contenido necesitas y cuántos posts quieres.",
  };

  return { action, topic, tone: defaultTone, frequencyPerWeek: freq, reply: replyMap[action] };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);

    const aiGuard = await guardAiAccess(session.tenantId, session.role);
    if (!aiGuard.ok) {
      return NextResponse.json(
        { ok: false, error: aiGuard.code, message: aiGuard.message },
        { status: 403 },
      );
    }

    const body = (await request.json().catch(() => null)) as {
      message?: string;
      saasId?: string;
    } | null;

    if (!body?.message?.trim()) {
      return NextResponse.json({ ok: false, error: "message is required" }, { status: 400 });
    }

    const saasId = body.saasId ?? "socialflow";
    const userMessage = body.message.trim();

    // Load brand profile + KB context in parallel
    const [profile, knowledgeContext] = await Promise.all([
      getChannelProfile(session.tenantId, saasId).catch(() => null),
      getKnowledgeContext(session.tenantId, saasId).catch(() => ""),
    ]);

    const defaultNiche = profile?.niche || profile?.brandName || saasId;
    const defaultTone = profile?.toneOfVoice || "profesional, cercano, concreto";

    // Parse intent (AI-assisted, regex fallback)
    const intent =
      (await parseIntentWithAI(userMessage, knowledgeContext, defaultTone, defaultNiche)) ??
      parseIntentFallback(userMessage, defaultTone, defaultNiche);

    // Pure conversational — no generation needed
    if (intent.action === "chat") {
      return NextResponse.json({ ok: true, action: "chat", reply: intent.reply });
    }

    // Generation or modify — enqueue campaign
    const queue = env()?.SOCIALFLOW_AI_QUEUE;
    if (!queue) {
      return NextResponse.json({ ok: false, error: "SOCIALFLOW_AI_QUEUE_UNAVAILABLE" }, { status: 503 });
    }

    const campaignId = `ai_campaign_${Date.now()}`;
    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId });
    await upsertSaasSocialCampaign(ctx, {
      id: campaignId,
      saasId,
      name: `IA: ${intent.topic.slice(0, 60)}`,
      objective: "AWARENESS",
      status: "GENERATING",
      targetSegment: "DEFAULT",
      startDate: null,
      endDate: null,
      budgetEstimate: null,
      notes: null,
    });

    await queue.send({
      tenantId: session.tenantId,
      saasId,
      niche: intent.topic,
      tone: intent.tone,
      frequencyPerWeek: intent.frequencyPerWeek,
      campaignId,
    });

    return NextResponse.json({
      ok: true,
      action: "generating",
      campaignId,
      reply: intent.reply,
      params: { topic: intent.topic, tone: intent.tone, frequencyPerWeek: intent.frequencyPerWeek },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_AI_CHAT_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal Error" }, { status: 500 });
  }
}
