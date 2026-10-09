export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { env } from "@/lib/cf";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
};

export async function POST(req: NextRequest) {
  let session: Awaited<ReturnType<typeof requireCurrentSocialFlowSession>>;
  try {
    session = await requireCurrentSocialFlowSession(req);
  } catch {
    return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 401 });
  }

  const cfEnv = env();
  const bucket = cfEnv?.SOCIAL_MEDIA_BUCKET;
  const baseUrl = cfEnv?.SOCIAL_MEDIA_R2_PUBLIC_URL?.trim();
  if (!bucket || !baseUrl) {
    return NextResponse.json(
      { ok: false, error: "STORAGE_NOT_CONFIGURED", message: "Media storage is not configured." },
      { status: 503 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_FORM", message: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "FILE_REQUIRED", message: "file field is required" }, { status: 400 });
  }
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json({ ok: false, error: "INVALID_TYPE", message: "Only JPEG and PNG are supported" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "FILE_TOO_LARGE", message: "File exceeds 5 MB limit" }, { status: 400 });
  }

  try {
    const key = `socialcors/${session.tenantId}/face-reference.${ext}`;
    const buffer = await file.arrayBuffer();
    await bucket.put(key, buffer, { httpMetadata: { contentType: file.type } });

    const url = `${baseUrl.replace(/\/$/, "")}/${key}`;
    return NextResponse.json({ ok: true, url, key });
  } catch (err) {
    console.error("SOCIALFLOW_PHYSICAL_FACE_UPLOAD_FAILED", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: "UPLOAD_FAILED" }, { status: 500 });
  }
}
