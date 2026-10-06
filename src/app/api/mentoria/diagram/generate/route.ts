export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { generateMentoriaDiagram } from "@/lib/agents/mentoria/diagram-generator";

export async function POST(request: Request) {
  try {
    // Auth: solo estudiantes autenticados pueden generar diagramas
    const session = await requireCurrentMentoriaSession(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const { subject, topic, concept, sessionId } = body as Record<string, unknown>;

    if (typeof subject !== "string" || !subject.trim()) {
      return NextResponse.json({ ok: false, error: "SUBJECT_REQUIRED" }, { status: 400 });
    }
    if (typeof topic !== "string" || !topic.trim()) {
      return NextResponse.json({ ok: false, error: "TOPIC_REQUIRED" }, { status: 400 });
    }
    if (typeof concept !== "string" || !concept.trim()) {
      return NextResponse.json({ ok: false, error: "CONCEPT_REQUIRED" }, { status: 400 });
    }

    const result = await generateMentoriaDiagram({
      subject: subject.trim(),
      topic: topic.trim(),
      concept: concept.trim(),
      sessionId: typeof sessionId === "string" ? sessionId : undefined,
    });

    if (result.skipped || !result.url) {
      return NextResponse.json(
        { ok: false, error: "DIAGRAM_UNAVAILABLE", reason: result.reason ?? "SKIPPED" },
        { status: 503 },
      );
    }

    return NextResponse.json({ ok: true, diagramUrl: result.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "DIAGRAM_GENERATE_FAILED";
    console.error("MENTORIA_DIAGRAM_ROUTE_ERROR", { error: message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
