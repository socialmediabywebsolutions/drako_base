export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { ensureDatabase, queryOne } from "@/lib/db";
import { respondDatabaseError } from "@/lib/http/errors";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";



type FileRow = { mime_type: string; content: string; report_id: string; type: string };

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    ensureDatabase();
    const { tenantId } = await requireTenantAccess(_);
    const { id } = await params;
    const file = await queryOne<FileRow>(
      `SELECT rf.report_id, rf.mime_type, rf.content, r.type
       FROM report_files rf
       INNER JOIN reports r ON r.id = rf.report_id
       WHERE rf.report_id = ? AND r.tenant_id = ?
       LIMIT 1`,
      id,
      tenantId,
    );
    if (!file) return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
    const buffer = Uint8Array.from(atob(file.content), (c) => c.charCodeAt(0));
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "content-type": file.mime_type,
        "content-disposition": `attachment; filename="${file.type ?? "reporte"}.pdf"`,
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const dbError = respondDatabaseError(error);
    if (dbError) return dbError;
    const correlationId = globalThis.crypto?.randomUUID?.() ?? `report_pdf_err_${Date.now()}`;
    console.error("REPORT_PDF_ERROR", correlationId, error);
    return NextResponse.json({ error: "No se pudo descargar el PDF", correlation_id: correlationId }, { status: 500 });
  }
}
