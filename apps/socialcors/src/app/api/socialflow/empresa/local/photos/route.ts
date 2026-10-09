export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { getLocalPhotos, addLocalPhoto } from "@/lib/socialflow/local/repository";
import type { LocalPhotoType } from "@/lib/socialflow/local/types";
import { env } from "@/lib/cf";

const DEFAULT_SAAS_ID = "socialflow";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const PHOTO_TYPES = new Set<LocalPhotoType>(["exterior", "interior", "ambiente"]);

function resolveSaasId(request: Request): string {
  return new URL(request.url).searchParams.get("saasId")?.trim() || DEFAULT_SAAS_ID;
}

function ext(mimeType: string): string {
  const sub = mimeType.split("/")[1] ?? "jpg";
  return sub === "jpeg" ? "jpg" : sub;
}

export async function GET(req: Request) {
  let session: Awaited<ReturnType<typeof requireCurrentSocialFlowSession>>;
  try {
    session = await requireCurrentSocialFlowSession(req);
  } catch {
    return NextResponse.json({ error: "SESSION_REQUIRED" }, { status: 401 });
  }

  try {
    const photos = await getLocalPhotos(session.tenantId, resolveSaasId(req));
    return NextResponse.json({ ok: true, photos });
  } catch (err) {
    console.error("[Local/photos] list failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "LIST_FAILED" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let session: Awaited<ReturnType<typeof requireCurrentSocialFlowSession>>;
  try {
    session = await requireCurrentSocialFlowSession(req);
  } catch {
    return NextResponse.json({ error: "SESSION_REQUIRED" }, { status: 401 });
  }

  const cfEnv = env();
  const bucket = cfEnv?.SOCIAL_MEDIA_BUCKET;
  const baseUrl = cfEnv?.SOCIAL_MEDIA_R2_PUBLIC_URL?.trim();
  if (!bucket || !baseUrl) {
    return NextResponse.json(
      { error: "STORAGE_NOT_CONFIGURED", message: "Media storage is not configured." },
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
  const photoTypeRaw = formData.get("photoType");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "FILE_REQUIRED", message: "file field is required" }, { status: 400 });
  }
  if (typeof photoTypeRaw !== "string" || !PHOTO_TYPES.has(photoTypeRaw as LocalPhotoType)) {
    return NextResponse.json(
      { error: "INVALID_PHOTO_TYPE", message: "photoType must be exterior, interior or ambiente" },
      { status: 400 },
    );
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "INVALID_TYPE", message: "Only JPEG, PNG and WebP are supported" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "FILE_TOO_LARGE", message: "File exceeds 10 MB limit" }, { status: 400 });
  }

  try {
    const key = `locals/${session.tenantId}/${crypto.randomUUID()}.${ext(file.type)}`;
    const buffer = await file.arrayBuffer();
    await bucket.put(key, buffer, { httpMetadata: { contentType: file.type } });
    const url = `${baseUrl.replace(/\/$/, "")}/${key}`;

    const photo = await addLocalPhoto(session.tenantId, resolveSaasId(req), url, photoTypeRaw as LocalPhotoType);
    return NextResponse.json({ ok: true, photo });
  } catch (err) {
    console.error("[Local/photos] upload failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "UPLOAD_FAILED" }, { status: 500 });
  }
}
