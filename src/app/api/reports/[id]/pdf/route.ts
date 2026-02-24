export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { ensureDatabase, queryOne } from "@/lib/db";
import { respondDatabaseError } from "@/lib/http/errors";



type FileRow = { mime_type: string; content: string; report_id: string };
type ReportRow = { id: string; type: string };

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    ensureDatabase();
    const { id } = await params;
    const file = await queryOne<FileRow>("SELECT report_id, mime_type, content FROM report_files WHERE report_id = ?", id);
    if (!file) return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
    const report = await queryOne<ReportRow>("SELECT id, type FROM reports WHERE id = ?", id);
    const buffer = Uint8Array.from(atob(file.content), (c) => c.charCodeAt(0));
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "content-type": file.mime_type,
        "content-disposition": `attachment; filename="${report?.type ?? "reporte"}.pdf"`,
      },
    });
  } catch (error) {
    const dbError = respondDatabaseError(error);
    if (dbError) return dbError;
    const correlationId = globalThis.crypto?.randomUUID?.() ?? `report_pdf_err_${Date.now()}`;
    console.error("REPORT_PDF_ERROR", correlationId, error);
    return NextResponse.json({ error: "No se pudo descargar el PDF", correlation_id: correlationId }, { status: 500 });
  }
}
