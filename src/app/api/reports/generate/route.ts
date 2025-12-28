import { NextResponse } from "next/server";
import { ensureDatabase, run } from "@/lib/db";
import { respondDatabaseError } from "@/lib/http/errors";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";

export const runtime = "edge";

const REPORT_TYPES = [
  { type: "business_diagnostic", title: "Diagnóstico del negocio" },
  { type: "competition", title: "Competencia (radio X)" },
  { type: "market", title: "Mercado y nicho" },
  { type: "proposal", title: "Propuesta y presupuesto" },
];

function buildPdfContent(title: string, body: string) {
  const text = `${title}\n\n${body}\n\nGenerado por DRĀKO Systems (demo).`;
  // Minimal PDF structure (very small) to avoid heavy deps
  const escaped = text.replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const pdf = `%PDF-1.1
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length ${escaped.length + 73}>>stream
BT /F1 12 Tf 50 750 Td (${escaped}) Tj ET
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Root 1 0 R/Size 6>>
%%EOF`;
  return btoa(pdf);
}

export async function POST(req: Request) {
  try {
    ensureDatabase();
    const body = (await req.json().catch(() => null)) as { sessionId?: string; radioKm?: number; pack?: string } | null;
    if (!body?.sessionId) return NextResponse.json({ error: "sessionId requerido" }, { status: 400 });
    const radio = body.radioKm ?? 2;
    const pack = body.pack ?? "BASIC";
    const createdIds: string[] = [];

    for (const entry of REPORT_TYPES) {
      const id = globalThis.crypto?.randomUUID?.() ?? `rep_${entry.type}_${Date.now()}`;
      const content = `${entry.title}. Pack sugerido: ${pack}. Radio análisis: ${radio}km. Informe demo si faltan conectores.`;
      await run(
        "INSERT INTO reports (id, session_id, tenant_id, type, status, content) VALUES (?, ?, ?, ?, 'completed', ?)",
        id,
        body.sessionId,
        DEMO_TENANT_ID,
        entry.type,
        content
      );
      const pdfBase64 = buildPdfContent(entry.title, content);
      const fileId = globalThis.crypto?.randomUUID?.() ?? `file_${id}`;
      await run(
        "INSERT INTO report_files (id, report_id, mime_type, content) VALUES (?, ?, 'application/pdf', ?)",
        fileId,
        id,
        pdfBase64
      );
      createdIds.push(id);
    }

    return NextResponse.json({ ok: true, reportIds: createdIds });
  } catch (error) {
    const dbError = respondDatabaseError(error);
    if (dbError) return dbError;
    const correlationId = globalThis.crypto?.randomUUID?.() ?? `reports_gen_err_${Date.now()}`;
    console.error("REPORTS_GENERATE_ERROR", correlationId, error);
    return NextResponse.json({ error: "No se pudieron generar los reportes", correlation_id: correlationId }, { status: 500 });
  }
}
