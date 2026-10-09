export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { saveKnowledgeDoc } from "@/lib/socialflow/knowledge/repository";
import { extractTextFromPdf } from "@/lib/socialflow/knowledge/pdf-extract";
import { extractTextFromCsv } from "@/lib/socialflow/knowledge/csv-extract";
import { extractTextFromXlsx } from "@/lib/socialflow/knowledge/xlsx-extract";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const DEFAULT_SAAS_ID = "socialflow";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function resolveSaasId(request: Request): string {
  return new URL(request.url).searchParams.get("saasId")?.trim() || DEFAULT_SAAS_ID;
}

export async function POST(req: Request) {
  let session: Awaited<ReturnType<typeof requireCurrentSocialFlowSession>>;
  try {
    session = await requireCurrentSocialFlowSession(req);
  } catch {
    return NextResponse.json({ error: "SESSION_REQUIRED" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "INVALID_FORM" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "FILE_REQUIRED" }, { status: 400 });
  }

  const mimeType = file.type || "application/octet-stream";
  const lowerName = file.name.toLowerCase();
  const isPdf = mimeType === "application/pdf" || lowerName.endsWith(".pdf");
  const isTxt = mimeType === "text/plain" || lowerName.endsWith(".txt");
  const isCsv = mimeType === "text/csv" || lowerName.endsWith(".csv");
  const isXlsx = mimeType === XLSX_MIME || lowerName.endsWith(".xlsx");

  if (!isPdf && !isTxt && !isCsv && !isXlsx) {
    return NextResponse.json(
      { error: "INVALID_TYPE", message: "Only PDF, plain text, CSV, and Excel (.xlsx) files are supported." },
      { status: 400 },
    );
  }

  if ((isCsv || isXlsx) && session.accountType !== "empresa") {
    return NextResponse.json(
      {
        error: "CATALOG_REQUIRES_EMPRESA_ACCOUNT",
        message: "Catalog uploads (CSV/Excel) are only available for business accounts.",
      },
      { status: 403 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "FILE_TOO_LARGE", message: "File exceeds 10 MB limit." },
      { status: 400 },
    );
  }

  let contentText: string;
  let docType: "pdf" | "text" | "catalog";
  try {
    const buffer = await file.arrayBuffer();
    if (isPdf) {
      docType = "pdf";
      contentText = extractTextFromPdf(buffer);
      if (!contentText.trim()) {
        return NextResponse.json(
          { error: "PDF_NO_TEXT", message: "No readable text found in this PDF. Scanned PDFs are not supported." },
          { status: 422 },
        );
      }
    } else if (isCsv) {
      docType = "catalog";
      contentText = extractTextFromCsv(new TextDecoder("utf-8", { fatal: false }).decode(buffer));
      if (!contentText.trim()) {
        return NextResponse.json(
          { error: "CATALOG_NO_CONTENT", message: "No readable rows found in this CSV file." },
          { status: 422 },
        );
      }
    } else if (isXlsx) {
      docType = "catalog";
      contentText = await extractTextFromXlsx(buffer);
      if (!contentText.trim()) {
        return NextResponse.json(
          { error: "CATALOG_NO_CONTENT", message: "No readable rows found in this Excel file." },
          { status: 422 },
        );
      }
    } else {
      docType = "text";
      contentText = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    }
  } catch (err) {
    console.error("[Knowledge/upload] extraction failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "EXTRACTION_FAILED" }, { status: 500 });
  }

  try {
    const name = formData.get("name")?.toString().trim() || file.name.replace(/\.[^.]+$/, "");
    const doc = await saveKnowledgeDoc({
      tenantId: session.tenantId,
      saasId: resolveSaasId(req),
      name,
      type: docType,
      contentText,
    });
    return NextResponse.json({ ok: true, doc: { id: doc.id, name: doc.name, type: doc.type, created_at: doc.created_at } });
  } catch (err) {
    console.error("[Knowledge/upload] save failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "SAVE_FAILED" }, { status: 500 });
  }
}
