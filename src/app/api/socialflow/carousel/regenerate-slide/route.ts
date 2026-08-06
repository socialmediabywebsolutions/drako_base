export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { SocialFlowOrchestrator } from "@/lib/socialflow/ai/SocialFlowOrchestrator";
import { defaultLocalModel } from "@/lib/socialflow/ai/models/localModel";
import { resolveObjectiveCta } from "@/lib/socialflow/ai/utils/ctaUtils";
import {
  CAROUSEL_SLIDE_TEXT_LIMITS,
  clampSlideText,
  type CarouselSlideRole,
} from "@/lib/socialflow/ai/agents/CarouselComposerAgent";

// Regenera el texto de UN slide de texto puro IA (source "ai" en publish-carrusel.tsx —
// nunca un slide con foto real, esos se reemplazan con una foto, no se "regeneran") sin
// recomponer el carrusel completo. Mismas reglas de voz/valor que CarouselComposerAgent
// (VOZ irrompible, mensaje de valor en vez de descripción literal), pero para un solo
// slide — no se llama al agente completo porque este flujo no tiene keywordEngine/trends
// ni necesita recalcular hashtags, sería trabajo desperdiciado por un texto.

const VALID_ROLES: CarouselSlideRole[] = ["intro", "desarrollo", "cierre_cta"];

function unauthorizedResponse() {
  return NextResponse.json({ code: "UNAUTHORIZED", message: "SESSION_REQUIRED" }, { status: 401 });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      saasId?: string;
      slideIndex?: number;
      role?: CarouselSlideRole;
      theme?: string;
      currentText?: string;
      precedingPhotoContext?: string | null;
    } | null;

    if (!body?.saasId || typeof body.slideIndex !== "number" || !body.role || !VALID_ROLES.includes(body.role)) {
      return NextResponse.json(
        { code: "INVALID_BODY", message: "saasId, slideIndex and role are required" },
        { status: 400 },
      );
    }

    const session = await requireCurrentSocialFlowSession(request);

    // Mismo buildProfile que generate-from-image — nunca se confía en un perfil mandado
    // por el cliente (identidad de marca, voz, CTA), siempre se resuelve server-side.
    const orchestrator = new SocialFlowOrchestrator();
    const profile = await orchestrator.buildProfile({
      tenantId: session.tenantId,
      saasId: body.saasId,
      niche: "",
      tone: "",
      frequencyPerWeek: 1,
      accountType: session.accountType,
    });

    if (profile.accountType === "empresa") {
      profile.voiceInstruction = `Escribe en tercera persona hablando de "${profile.brandIdentity}" como marca/entidad. NUNCA uses "yo", "mi", "me" ni "mis". Ejemplos correctos: "${profile.brandIdentity} presenta...", "En ${profile.brandIdentity} encontrarás...", "Nuestro equipo...". Ejemplo incorrecto: "Te comparto...".`;
    } else if (!profile.voiceInstruction) {
      profile.voiceInstruction = `Escribe en primera persona singular (yo). Habla directamente como si fueras ${profile.brandIdentity} dirigiéndote a tu audiencia. NUNCA uses "${profile.brandIdentity}" en tercera persona ni como si fuera una empresa. Ejemplo correcto: "Te comparto..." — Ejemplo incorrecto: "En ${profile.brandIdentity} compartimos..."`;
    }

    const role = body.role;
    const limit = CAROUSEL_SLIDE_TEXT_LIMITS[role];
    const isEmpresa = profile.accountType === "empresa";

    // cierre_cta con objectiveCta configurado es un valor FIJO en CarouselComposerAgent
    // (nunca lo reescribe el modelo) — regenerar debe respetar el mismo invariante en vez
    // de darle a Mistral la oportunidad de inventar un CTA distinto al configurado.
    const objectiveCta = role === "cierre_cta" ? resolveObjectiveCta(profile.clientObjective, profile.channelHandle) : null;
    if (objectiveCta) {
      return NextResponse.json({ text: clampSlideText(objectiveCta, role) });
    }

    const theme = body.theme?.trim();
    const hasExplicitTheme = !!theme && theme.toLowerCase() !== "auto";
    const resolvedTopic = hasExplicitTheme ? theme! : profile.contentPillars[0] || profile.niche;

    const contentInstruction = body.precedingPhotoContext
      ? `La foto anterior de este carrusel muestra: "${body.precedingPhotoContext}". Desarrolla un mensaje de VALOR que amplíe o complemente lo que transmite esa foto — no la describas literalmente.`
      : `Desarrolla el tema "${resolvedTopic}" con un punto educativo concreto.`;

    const roleInstruction =
      role === "intro"
        ? `Este es el slide de INTRO — gancho corto que abra el tema. MÁXIMO ${limit} caracteres.`
        : role === "cierre_cta"
          ? `Este es el slide de CIERRE/CTA — cierre + llamada a la acción (${profile.primaryCTA || "invita a comentar o guardar el post"}). MÁXIMO ${limit} caracteres.`
          : `Este es un slide de DESARROLLO — un punto educativo concreto. MÁXIMO ${limit} caracteres.`;

    const prompt = `Reescribe el texto de UN slide de un carrusel educativo de Instagram sobre "${profile.niche}" para la marca "${profile.brandIdentity}", EN ESPAÑOL.

${isEmpresa
  ? `⚠️ VOZ — REGLA IRROMPIBLE: Escribe SIEMPRE en tercera persona hablando de "${profile.brandIdentity}" como marca/entidad. NUNCA uses "yo", "mi", "me" ni "mis".`
  : `⚠️ VOZ — REGLA IRROMPIBLE: Escribe SIEMPRE en primera persona singular (yo, mi, me, mis). Nunca hables de "${profile.brandIdentity}" en tercera persona.`}
${profile.voiceInstruction ? `${profile.voiceInstruction}\n` : ""}
${roleInstruction}

${contentInstruction} Nunca describas una foto literalmente ("en esta foto veo..."), siempre aporta un mensaje de valor.
${body.currentText ? `\nTexto actual del slide (a reemplazar — genera algo DISTINTO, no lo repitas): "${body.currentText}"` : ""}

Responde SOLO con el JSON solicitado.`;

    const { data } = await defaultLocalModel.generateStructured<{ text: string }>(
      { prompt, tenantId: session.tenantId, saasId: body.saasId },
      () => ({ text: body.currentText ?? "" }),
    );

    const rawText = typeof data.text === "string" ? data.text.trim() : "";
    if (!rawText) {
      return NextResponse.json({ code: "REGENERATE_FAILED", message: "No se pudo generar un texto nuevo." }, { status: 502 });
    }

    return NextResponse.json({ text: clampSlideText(rawText, role) });
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return unauthorizedResponse();
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.error("SOCIALFLOW_CAROUSEL_REGENERATE_SLIDE_ERROR", { message: msg });
    return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal Error" }, { status: 500 });
  }
}
