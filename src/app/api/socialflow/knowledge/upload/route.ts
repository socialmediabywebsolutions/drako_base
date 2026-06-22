export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { saveKnowledgeDoc } from "@/lib/socialflow/knowledge/repository";
import { extractTextFromPdf } from "@/lib/socialflow/knowledge/pdf-extract";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Set(["application/pdf", "text/plain"]);

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
  if (!ALLOWED_TYPES.has(mimeType) && !file.name.endsWith(".pdf") && !file.name.endsWith(".txt")) {
    return NextResponse.json(
      { error: "INVALID_TYPE", message: "Only PDF and plain text files are supported." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "FILE_TOO_LARGE", message: "File exceeds 10 MB limit." },
      { status: 400 },
    );
  }

  let contentText: string;
  try {
    const buffer = await file.arrayBuffer();
    const isPdf = mimeType === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (isPdf) {
      contentText = extractTextFromPdf(buffer);
      if (!contentText.trim()) {
        return NextResponse.json(
          { error: "PDF_NO_TEXT", message: "No readable text found in this PDF. Scanned PDFs are not supported." },
          { status: 422 },
        );
      }
    } else {
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
      saasId: session.saasId,
      name,
      type: "pdf",
      contentText,
    });
    return NextResponse.json({ ok: true, doc: { id: doc.id, name: doc.name, type: doc.type, created_at: doc.created_at } });
  } catch (err) {
    console.error("[Knowledge/upload] save failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "SAVE_FAILED" }, { status: 500 });
  }
}
