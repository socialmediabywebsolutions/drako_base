export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { ensureDatabase, queryAll, queryOne, run } from "@/lib/db";
import { respondDatabaseError } from "@/lib/http/errors";


type SessionRow = {
  id: string;
  status: string;
  step: string;
  data_json: string;
  recommended_pack: string | null;
};

type MessageRow = { id: string; sender: string; content: string; created_at: string };

const QUESTION_FLOW: { key: string; prompt: string; why: string }[] = [
  { key: "businessName", prompt: "¿Cómo se llama tu negocio o razón social?", why: "Necesitamos identificarte en los documentos y la facturación." },
  { key: "idNumber", prompt: "¿Cuál es tu NIF/CIF?", why: "Lo usaremos para tus facturas y tu ficha fiscal." },
  { key: "contact", prompt: "Dame tu email y teléfono de contacto.", why: "Para enviarte reportes y coordinar contigo." },
  { key: "address", prompt: "¿Cuál es la dirección completa de tu local?", why: "Así analizamos la zona y la competencia cerca (radio 5km por defecto)." },
  { key: "cityCountry", prompt: "Ciudad y país donde operas.", why: "Ayuda a elegir normativas y lenguaje adecuado." },
  { key: "industry", prompt: "¿A qué te dedicas? nicho/oficio/sector.", why: "Elegimos agentes y packs que conocen tu nicho." },
  { key: "services", prompt: "Servicios o productos principales y precios aproximados.", why: "Definimos ofertas y ticket promedio." },
  { key: "schedule", prompt: "Horarios de atención.", why: "Para reservas y comunicación." },
  { key: "goals", prompt: "Objetivo principal (más clientes, reservas, reputación, etc.).", why: "Priorizamos departamentos y campañas." },
  { key: "web", prompt: "¿Tienes web? comparte el link si existe.", why: "Analizamos si aprovecharla o crear algo rápido." },
  { key: "social", prompt: "Redes sociales (@ o enlaces).", why: "Para auditar presencia y tono de marca." },
  { key: "gbp", prompt: "¿Tienes ficha de Google Business Profile?", why: "Clave para SEO local y reseñas." },
  { key: "budget", prompt: "Presupuesto mensual aproximado para marketing/ops.", why: "Elegimos pack que puedas sostener." },
  { key: "team", prompt: "¿Trabajas solo o con equipo? ¿cuántas personas?", why: "Define procesos y asignación de agentes." },
  { key: "tools", prompt: "Herramientas actuales (CRM, WhatsApp Business, etc.).", why: "Para integrar y no duplicar esfuerzos." },
];

function recommendPack(budget?: number | null, teamSize?: number | null) {
  if (budget && budget >= 800) return "FULL";
  if (budget && budget >= 400) return "STANDARD";
  if (teamSize && teamSize > 3) return "STANDARD";
  return "BASIC";
}

export async function POST(req: Request) {
  try {
    ensureDatabase();
    const body = (await req.json().catch(() => null)) as { sessionId?: string; message?: string; data?: Record<string, unknown> } | null;
    if (!body?.sessionId) return NextResponse.json({ error: "sessionId requerido" }, { status: 400 });
    const session = await queryOne<SessionRow>(
      "SELECT id, status, step, data_json, recommended_pack FROM onboarding_sessions WHERE id = ?",
      body.sessionId
    );
    if (!session) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });

    const data = JSON.parse(session.data_json || "{}") as Record<string, unknown>;
    if (body.data && typeof body.data === "object") {
      Object.assign(data, body.data);
      await run(
        "UPDATE onboarding_sessions SET data_json = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
        JSON.stringify(data),
        session.id
      );
    }

    if (body.message) {
      await run(
        "INSERT INTO onboarding_messages (id, session_id, sender, content) VALUES (?, ?, 'client', ?)",
        globalThis.crypto?.randomUUID?.() ?? `msg_${Date.now()}`,
        session.id,
        body.message
      );
    }

    const nextField = QUESTION_FLOW.find((q) => !(q.key in data));
    let reply = "Gracias, seguimos.";
    let why = "";

    if (nextField) {
      reply = nextField.prompt;
      why = nextField.why;
    } else {
      const budgetNumber = typeof data.budget === "number" ? data.budget : Number.parseInt(String(data.budget ?? "0"), 10) || null;
      const teamSize = typeof data.team === "number" ? data.team : Number.parseInt(String(data.team ?? "0"), 10) || null;
      const pack = recommendPack(budgetNumber, teamSize);
      await run(
      "UPDATE onboarding_sessions SET step = 'summary', recommended_pack = ?, data_json = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
      pack,
      JSON.stringify(data),
      session.id
    );
      reply = `Listo. Con lo que me contaste te recomiendo el pack ${pack}. Podemos generar los reportes y preparar tu SaaS.`;
      why = "Elegimos el pack que cuida tu bolsillo y cubre tus objetivos.";
    }

    await run(
      "INSERT INTO onboarding_messages (id, session_id, sender, content) VALUES (?, ?, 'orchestrator', ?)",
      globalThis.crypto?.randomUUID?.() ?? `msg_${Date.now()}o`,
      session.id,
      `${reply} (${why})`
    );

    const messages = await queryAll<MessageRow>(
      "SELECT id, sender, content, created_at FROM onboarding_messages WHERE session_id = ? ORDER BY created_at ASC",
      session.id
    );

    return NextResponse.json({
      sessionId: session.id,
      recommendedPack: session.recommended_pack,
      nextPrompt: reply,
      why,
      messages,
      data,
    });
  } catch (error) {
    const dbError = respondDatabaseError(error);
    if (dbError) return dbError;
    const correlationId = globalThis.crypto?.randomUUID?.() ?? `onb_chat_err_${Date.now()}`;
    console.error("ONBOARDING_CHAT_ERROR", correlationId, error);
    return NextResponse.json({ error: "No se pudo procesar el chat", correlation_id: correlationId }, { status: 500 });
  }
}
