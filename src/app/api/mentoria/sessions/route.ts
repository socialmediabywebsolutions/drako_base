export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

const LEGACY_ROUTE_PAYLOAD = {
  ok: false,
  code: "MENTORIA_LEGACY_SESSIONS_ROUTE_GONE",
  message: "Legacy Mentoria sessions runtime is removed. Use /api/mentoria/session and /api/mentoria/exercises.",
};

export async function GET(_request?: Request) {
  return NextResponse.json(LEGACY_ROUTE_PAYLOAD, { status: 410 });
}

export async function POST(_request?: Request) {
  return NextResponse.json(LEGACY_ROUTE_PAYLOAD, { status: 410 });
}
