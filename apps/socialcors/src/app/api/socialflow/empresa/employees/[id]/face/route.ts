export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { updateEmployee } from "@/lib/socialflow/employees/repository";
import { env } from "@/lib/cf";

const DEFAULT_SAAS_ID = "socialflow";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — foto de rostro de referencia
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
};

function resolveSaasId(request: Request): string {
  return new URL(request.url).searchParams.get("saasId")?.trim() || DEFAULT_SAAS_ID;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  let session: Awaited<ReturnType<typeof requireCurrentSocialFlowSession>>;
  try {
    session = await requireCurrentSocialFlowSession(req);
  } catch {
    return NextResponse.json({ error: "SESSION_REQUIRED" }, { status: 401 });
  }

  const { id } = params;
  if (!id) {
    return NextResponse.json({ error: "ID_REQUIRED" }, { status: 400 });
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
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "FILE_REQUIRED", message: "file field is required" }, { status: 400 });
  }
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json({ error: "INVALID_TYPE", message: "Only JPEG and PNG are supported" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "FILE_TOO_LARGE", message: "File exceeds 5 MB limit" }, { status: 400 });
  }

  const saasId = resolveSaasId(req);

  try {
    const key = `employees/${session.tenantId}/${id}/face.${ext}`;
    const buffer = await file.arrayBuffer();
    await bucket.put(key, buffer, { httpMetadata: { contentType: file.type } });

    const employee = await updateEmployee(id, session.tenantId, saasId, { faceR2Key: key });
    if (!employee) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const url = `${baseUrl.replace(/\/$/, "")}/${key}`;
    return NextResponse.json({ ok: true, url, key, employee });
  } catch (err) {
    console.error("[Employees/face] upload failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "UPLOAD_FAILED" }, { status: 500 });
  }
}
