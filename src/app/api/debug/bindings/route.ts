import { NextResponse } from "next/server";
import { env } from "@/lib/cf";

export const runtime = "edge";

export async function GET() {
  const bindings = env();
  const envKeys = bindings ? Object.keys(bindings).sort() : [];
  const isPages =
    typeof (globalThis as typeof globalThis & { caches?: unknown }).caches !== "undefined" &&
    typeof (globalThis as typeof globalThis & { WebSocketPair?: unknown }).WebSocketPair !==
      "undefined";

  return NextResponse.json({
    ok: true,
    hasRequestContext: Boolean(bindings),
    hasDracoDb: Boolean(bindings?.DRACO_DB),
    envKeys,
    isPages,
  });
}
