export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { runMentoriaLlm } from "@/lib/agents/mentoria/llm-client";

export async function GET() {
  const timestamp = new Date().toISOString();

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
      provider: result.provider,
      model: result.model,
      totalTokens: result.totalTokens,
      preview: result.text,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "MENTORIA_AI_HEALTHCHECK_FAILED";
    const status = message === "MENTORIA_AI_NOT_AVAILABLE" ? 503 : 500;

    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp,
        error: message,
        hint:
          message === "MENTORIA_AI_NOT_AVAILABLE"
            ? "Workers AI no configurado en local. Configure AI binding o exporte AI_HARD_OFF=false para habilitar."
            : undefined,
      },
      { status },
    );
  }
}
