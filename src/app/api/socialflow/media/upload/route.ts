export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { env } from "@/lib/cf";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);

function ext(mimeType: string): string {
  const sub = mimeType.split("/")[1] ?? "jpg";
  return sub === "jpeg" ? "jpg" : sub;
}

export async function POST(req: NextRequest) {
  try {
    await requireCurrentSocialFlowSession(req);
  } catch {
    return NextResponse.json({ error: "SESSION_REQUIRED" }, { status: 401 });
  }

  const cfEnv = env();
  const bucket = cfEnv?.SOCIAL_MEDIA_BUCKET;
  const baseUrl = cfEnv?.SOCIAL_MEDIA_R2_PUBLIC_URL?.trim();

  if (!bucket || !baseUrl) {
    return NextResponse.json(
      { error: "STORAGE_NOT_CONFIGURED", message: "Media storage is not configured. Use a direct image URL instead." },
      { status: 503 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "INVALID_FORM", message: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "FILE_REQUIRED", message: "file field is required" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "INVALID_TYPE", message: "Only JPEG, PNG, WebP and GIF are supported" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "FILE_TOO_LARGE", message: "File exceeds 10 MB limit" }, { status: 400 });
  }

  try {
    const key = `socialflow/${Date.now()}-${crypto.randomUUID()}.${ext(file.type)}`;
    const buffer = await file.arrayBuffer();
    await bucket.put(key, buffer, { httpMetadata: { contentType: file.type } });

    const url = `${baseUrl.replace(/\/$/, "")}/${key}`;
    return NextResponse.json({ url, key, size: file.size, type: file.type });
  } catch (error) {
    console.error("[MediaUpload] R2 put failed", error);
    return NextResponse.json({ error: "UPLOAD_FAILED", message: "Failed to store image" }, { status: 500 });
  }
}
