export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { MentoriaAcademicService } from "@/lib/mentoria/academic-service";

type UploadFileLike = {
  name?: string;
  type?: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

function resolveRouteStatus(message: string) {
  if (message === "SESSION_REQUIRED") return 401;
  if (message === "ONBOARDING_REQUIRED") return 409;
  if (message === "STUDENT_ACCESS_DENIED") return 403;
  return 500;
}

function isUploadFileLike(value: unknown): value is UploadFileLike {
  return Boolean(value)
    && typeof value === "object"
    && typeof (value as { arrayBuffer?: unknown }).arrayBuffer === "function";
}

export async function POST(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const form = await request.formData();
    const file = form.get("file");
    const studentId = typeof form.get("studentId") === "string" ? String(form.get("studentId")).trim() : undefined;
    const subjectSlug = typeof form.get("subjectSlug") === "string" ? String(form.get("subjectSlug")).trim() : undefined;
    const classification = typeof form.get("recordType") === "string" ? String(form.get("recordType")).trim() : "custom";
    const notes = typeof form.get("notes") === "string" ? String(form.get("notes")).trim() : undefined;

    if (!isUploadFileLike(file)) {
      return NextResponse.json({ ok: false, error: "MENTORIA_ACADEMIC_FILE_REQUIRED" }, { status: 400 });
    }
    const mimeType = typeof file.type === "string" ? file.type : "";
    const fileName = typeof file.name === "string" && file.name.trim() ? file.name.trim() : "academic-upload";
    const isImage = mimeType.startsWith("image/");
    const isPdf = mimeType === "application/pdf";
    if (!isImage && !isPdf) {
      return NextResponse.json({ ok: false, error: "MENTORIA_ACADEMIC_FILE_TYPE_NOT_SUPPORTED" }, { status: 415 });
    }
    const buffer = await file.arrayBuffer();
    const sha = await crypto.subtle.digest("SHA-256", buffer);
    const sha256 = Array.from(new Uint8Array(sha)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const service = new MentoriaAcademicService();
    const result = await service.createDocument(actor, {
      studentId,
      studentProfileId: studentId ?? undefined,
      subjectSlug,
      documentKind: isPdf ? "pdf" : "image",
      classification: classification as "exam" | "homework" | "project" | "notebook" | "behavior" | "presentation" | "custom" | "unknown",
      sourceChannel: "web_upload",
      storageKey: `${fileName}:${sha256}`,
      mimeType,
      fileName,
      sha256,
      notesText: notes,
      analysisStatus: "pending",
    });
    return NextResponse.json({ ok: true, student: result.student, document: result.document, replayed: result.replayed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "MENTORIA_ACADEMIC_UPLOAD_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: resolveRouteStatus(message) });
  }
}
