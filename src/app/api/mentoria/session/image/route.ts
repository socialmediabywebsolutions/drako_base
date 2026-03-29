export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { buildImageAssetId, summarizeImagePurpose } from "@/lib/mentoria/product-experience";

type FileLike = {
  name: string;
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
};

function isFileLike(value: unknown): value is FileLike {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<FileLike>;
  return (
    typeof candidate.name === "string"
    && typeof candidate.type === "string"
    && typeof candidate.size === "number"
    && typeof candidate.arrayBuffer === "function"
  );
}

async function sha256Hex(input: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("image");
    const notes = form.get("notes");

    if (!isFileLike(file)) {
      return NextResponse.json({ ok: false, error: "IMAGE_FILE_REQUIRED" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ ok: false, error: "IMAGE_TYPE_NOT_SUPPORTED" }, { status: 415 });
    }
    if (file.size <= 0 || file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "IMAGE_SIZE_INVALID" }, { status: 413 });
    }

    const buffer = await file.arrayBuffer();
    const sha256 = await sha256Hex(buffer);
    const preparedAt = new Date().toISOString();

    return NextResponse.json({
      ok: true,
      image: {
        assetId: buildImageAssetId(file.name, sha256),
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        sha256,
        summary: summarizeImagePurpose(typeof notes === "string" ? notes : null),
        status: "received_for_future_interpretation",
        preparedAt,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "IMAGE_PREPARE_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
