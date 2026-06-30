export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { env } from "@/lib/cf";

const FLOW_SYSTEM_PROMPT = `Eres Flow, el asistente virtual de SocialFlow — el sistema operativo de marketing con IA para creadores de contenido y empresas hispanohablantes.

Tu misión: ayudar a los visitantes a entender SocialFlow y guiarlos hacia el registro.

Reglas que debes seguir siempre:
1. Responde SIEMPRE en español.
2. Sé breve y conversacional: máximo 2-3 oraciones por respuesta.
3. Si el usuario es influencer o creador de contenido → explica brevemente el plan Influencer (desde 49€/mes, 7 días gratis) y dile que puede hacer su registro como influencer para empezar gratis.
4. Si el usuario es empresa, negocio o agencia → explica brevemente el plan Empresa (desde 79€/mes, 7 días gratis) y dile que puede hacer su registro como empresa para empezar gratis.
5. Destaca siempre los 7 días de prueba gratis sin tarjeta de crédito.
6. Cuando guíes al registro, incluye la palabra "registro" en tu respuesta.
7. No inventes funcionalidades. Ante dudas técnicas, indica que el equipo de soporte puede ayudar.
8. Si no tienes contexto suficiente, pregunta si es creador de contenido o tiene un negocio.`;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      message?: string;
      history?: ChatMessage[];
    } | null;

    if (!body?.message?.trim()) {
      return NextResponse.json({ ok: false, error: "message is required" }, { status: 400 });
    }

    const userMessage = body.message.trim().slice(0, 500);
    const history = (body.history ?? []).slice(-6);

    const aiBinding = env()?.AI;
    if (!aiBinding?.run) {
      return NextResponse.json({ ok: true, reply: "En este momento no puedo responder. Por favor, escríbenos a soporte y te ayudaremos enseguida." });
    }

    const messages = [
      { role: "system" as const, content: FLOW_SYSTEM_PROMPT },
      ...history.map((m) => ({ role: m.role, content: m.content.slice(0, 300) })),
      { role: "user" as const, content: userMessage },
    ];

    const result = (await aiBinding.run("@cf/meta/llama-3.1-70b-instruct", { messages })) as { response?: string };
    const reply = result?.response?.trim() || "No pude procesar tu mensaje. Intenta de nuevo.";

    return NextResponse.json({ ok: true, reply });
  } catch {
    return NextResponse.json({ ok: true, reply: "Hubo un error al procesar tu consulta. Inténtalo de nuevo." });
  }
}
