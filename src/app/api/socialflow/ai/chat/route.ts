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

type DateRange = {
  startDate: string;
  endDate: string;
  dateLabel: string;
};

type ProviderKey = "INSTAGRAM" | "LINKEDIN" | "FACEBOOK_PAGE" | "TIKTOK";

const GENERATE_KEYWORDS_ES = ["genera", "crea", "quiero", "necesito", "haz", "hazme", "prepara", "campaña", "posts", "publicaciones", "contenido"];
const MODIFY_KEYWORDS_ES = ["cambia", "modifica", "actualiza", "mejora", "regenera", "hazlos", "más formal", "más casual", "más corto", "más largo", "cambia el tono"];

const MONTHS_ES: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfISOWeek(d: Date): Date {
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
}

function extractDateRange(message: string): DateRange {
  const lower = message.toLowerCase();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const DAY_MS = 86_400_000;

  // "los próximos N días"
  const proximosDias = lower.match(/(?:los?\s+)?pr[oó]ximos?\s+(\d+)\s+d[ií]as?/);
  if (proximosDias) {
    const days = parseInt(proximosDias[1]);
    const end = new Date(today.getTime() + (days - 1) * DAY_MS);
    return { startDate: toDateStr(today), endDate: toDateStr(end), dateLabel: `próximos ${days} días` };
  }

  // "la próxima semana" before "esta semana" (longer match wins)
  if (/(?:la\s+)?pr[oó]xima\s+semana/.test(lower)) {
    const nextMon = startOfISOWeek(new Date(today.getTime() + 7 * DAY_MS));
    const nextSun = new Date(nextMon.getTime() + 6 * DAY_MS);
    return { startDate: toDateStr(nextMon), endDate: toDateStr(nextSun), dateLabel: "próxima semana" };
  }

  // "esta semana"
  if (/\besta\s+semana\b/.test(lower)) {
    const mon = startOfISOWeek(today);
    const sun = new Date(mon.getTime() + 6 * DAY_MS);
    return { startDate: toDateStr(mon), endDate: toDateStr(sun), dateLabel: "esta semana" };
  }

  // "del D al D de MES" or "del D de MES al D de MES"
  const rangeMatch = lower.match(/del?\s+(\d+)\s+(?:de\s+(\w+)\s+)?al?\s+(\d+)\s+de\s+(\w+)/);
  if (rangeMatch) {
    const [, d1, m1Raw, d2, m2Raw] = rangeMatch;
    const month2 = MONTHS_ES[m2Raw];
    if (month2 !== undefined) {
      const month1 = m1Raw ? (MONTHS_ES[m1Raw] ?? month2) : month2;
      const year = now.getFullYear() + (month2 < now.getMonth() ? 1 : 0);
      const start = new Date(year, month1, parseInt(d1));
      const end = new Date(year, month2, parseInt(d2));
      return { startDate: toDateStr(start), endDate: toDateStr(end), dateLabel: `${d1} al ${d2} de ${m2Raw}` };
    }
  }

  // "este mes"
  if (/\beste\s+mes\b/.test(lower)) {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { startDate: toDateStr(start), endDate: toDateStr(end), dateLabel: "este mes" };
  }

  // Solo nombre de mes: "julio", "agosto", etc.
  for (const [name, month] of Object.entries(MONTHS_ES)) {
    if (lower.includes(name)) {
      const year = now.getFullYear() + (month < now.getMonth() ? 1 : 0);
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      return { startDate: toDateStr(start), endDate: toDateStr(end), dateLabel: name };
    }
  }

  // Default: current week (Mon → Sun)
  const mon = startOfISOWeek(today);
  const sun = new Date(mon.getTime() + 6 * DAY_MS);
  return { startDate: toDateStr(mon), endDate: toDateStr(sun), dateLabel: "esta semana" };
}

function extractProvider(message: string): ProviderKey {
  const lower = message.toLowerCase();
  if (/instagram|ig\b/.test(lower)) return "INSTAGRAM";
  if (/linkedin|linked\s*in/.test(lower)) return "LINKEDIN";
  if (/facebook|fb\b/.test(lower)) return "FACEBOOK_PAGE";
  if (/tiktok/.test(lower)) return "TIKTOK";
  return "INSTAGRAM";
}

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
    .replace(/\b(esta semana|este mes|para hoy|la próxima semana|próxima semana)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

async function parseIntentWithAI(
  message: string,
  knowledgeContext: string,
  defaultTone: string,
  defaultNiche: string,
  regexAction: "generate" | "modify" | "chat",
): Promise<ParsedIntent | null> {
  const e = env();
  if (!e?.AI) return null;

  const systemPrompt = `Eres un asistente de marketing que extrae parámetros de campaña de mensajes en español. Devuelve SOLO JSON válido, sin markdown ni explicación.

Contexto de marca:
${knowledgeContext || `Nicho: ${defaultNiche}. Tono: ${defaultTone}.`}

Estructura JSON requerida:
{
  "action": "generate" | "modify" | "chat",
  "topic": "<tema de campaña en español, máx 80 chars>",
  "tone": "<tono de comunicación, usa el default de marca si no se especifica>",
  "frequencyPerWeek": <entero 1-28>,
  "reply": "<respuesta al usuario en español, 1-2 frases, confirma la acción sin hacer preguntas>"
}

REGLAS CRÍTICAS:
- Si el usuario menciona posts, publicaciones, campaña, contenido, crear, generar → action DEBE ser "generate". NUNCA devuelvas "chat" en ese caso.
- Si el usuario pide cambiar/modificar posts existentes → action="modify".
- action="chat" SOLO para saludos o preguntas que no pidan contenido.
- reply NO debe hacer preguntas. Debe confirmar la acción con los datos disponibles y decir que ya está generando.
- frequencyPerWeek: extrae el número del mensaje. Si dice "3 posts" → 3. Si no se menciona → 7.
- NUNCA pidas más información. Genera con lo que el usuario ya dio.`;

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

    // Regex intent is authoritative for action: prevent AI from downgrading a
    // detected generate/modify to chat (the common failure mode with LLMs).
    const action = regexAction !== "chat" ? regexAction : (parsed.action ?? "chat");

    const freq = typeof parsed.frequencyPerWeek === "number" && parsed.frequencyPerWeek >= 1
      ? parsed.frequencyPerWeek
      : extractFrequency(message);

    return {
      action,
      topic: (parsed.topic ?? extractTopic(message)) || defaultNiche,
      tone: parsed.tone ?? defaultTone,
      frequencyPerWeek: freq,
      reply: parsed.reply ?? "Entendido, generando tu campaña...",
    };
  } catch {
    return null;
  }
}

const PROVIDER_LABEL: Record<ProviderKey, string> = {
  INSTAGRAM: "Instagram",
  LINKEDIN: "LinkedIn",
  FACEBOOK_PAGE: "Facebook",
  TIKTOK: "TikTok",
};

function parseIntentFallback(
  message: string,
  defaultTone: string,
  defaultNiche: string,
  provider: ProviderKey,
  dateLabel: string,
): ParsedIntent {
  const lower = message.toLowerCase();
  const isGenerate = GENERATE_KEYWORDS_ES.some((k) => lower.includes(k));
  const isModify = MODIFY_KEYWORDS_ES.some((k) => lower.includes(k));

  const action = isModify ? "modify" : isGenerate ? "generate" : "chat";
  const freq = extractFrequency(message);
  const topic = extractTopic(message) || defaultNiche;

  const replyMap: Record<string, string> = {
    generate: `Perfecto, voy a generar ${freq} posts sobre "${topic}" para ${PROVIDER_LABEL[provider]} — ${dateLabel}. Dame un momento...`,
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

    // Extract date range and provider from message (rule-based, always reliable)
    const dateRange = extractDateRange(userMessage);
    const provider = extractProvider(userMessage);

    // Regex fallback runs first so its action can guard the AI result.
    const fallbackIntent = parseIntentFallback(userMessage, defaultTone, defaultNiche, provider, dateRange.dateLabel);
    const intent =
      (await parseIntentWithAI(userMessage, knowledgeContext, defaultTone, defaultNiche, fallbackIntent.action)) ??
      fallbackIntent;

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
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
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
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      provider,
    });

    // Build a reply that includes date context if AI didn't (AI reply ignores dates)
    const reply = fallbackIntent.reply;

    return NextResponse.json({
      ok: true,
      action: "generating",
      campaignId,
      reply,
      params: {
        topic: intent.topic,
        tone: intent.tone,
        frequencyPerWeek: intent.frequencyPerWeek,
        provider,
        dateLabel: dateRange.dateLabel,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 401 });
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.error("SOCIALFLOW_AI_CHAT_ERROR", { message: msg, error });
    return NextResponse.json({ ok: false, error: "Internal Error" }, { status: 500 });
  }
}
