export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getMentoriaAiRuntimeInfo, runMentoriaLlm } from "@/lib/agents/mentoria/llm-client";

export async function GET() {
  const timestamp = new Date().toISOString();
  const runtime = getMentoriaAiRuntimeInfo("fast");

  try {
    const result = await runMentoriaLlm([
      {
        role: "system",
        content:
          "Eres el runtime de validacion de Mentoria. Responde con una frase breve confirmando que Workers AI esta operativo.",
      },
      {
        role: "user",
        content: "Confirma disponibilidad de Workers AI para Mentoria.",
      },
    ]);

    return NextResponse.json({
      status: "healthy",
      timestamp,
      binding: {
        name: runtime.bindingName,
        exists: runtime.hasBinding,
        hardOff: runtime.hardOff,
      },
      runtime: runtime.runtime,
      provider: result.provider,
      model: result.model,
      totalTokens: result.totalTokens,
      preview: result.text,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "MENTORIA_AI_HEALTHCHECK_FAILED";
    const status =
      message === "AI_BINDING_MISSING" || message === "AI_PROVIDER_UNAVAILABLE" || message === "MENTORIA_AI_NOT_AVAILABLE"
        ? 503
        : 500;

    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp,
        binding: {
          name: runtime.bindingName,
          exists: runtime.hasBinding,
          hardOff: runtime.hardOff,
        },
        runtime: runtime.runtime,
        provider: runtime.provider,
        model: runtime.model,
        canCall: false,
        error: message,
        hint:
          message === "AI_BINDING_MISSING"
            ? "Workers AI no configurado en el runtime activo. Añade ai.binding = 'AI' al Wrangler que usa OpenNext."
            : message === "AI_PROVIDER_UNAVAILABLE"
              ? "Workers AI está configurado pero Cloudflare no puede servir inferencia ahora mismo. Revisa cuota, billing o modelo."
            : message === "MENTORIA_AI_NOT_AVAILABLE"
              ? "Workers AI no configurado en local. Configure AI binding o exporte AI_HARD_OFF=false para habilitar."
            : undefined,
      },
      { status },
    );
  }
}
