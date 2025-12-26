import { NextResponse } from "next/server";
import { DatabaseUnavailableError } from "@/lib/db";

export function respondDatabaseError(error: unknown) {
  if (error instanceof DatabaseUnavailableError) {
    const errorId = globalThis.crypto?.randomUUID?.() ?? `db_unavailable_${Date.now()}`;
    const detail =
      error.reason === "binding-missing" ? "DRACO_DB binding missing" : "D1 migrations missing";
    return NextResponse.json(
      { ok: false, error: "database_unavailable", reason: error.reason, detail, errorId },
      { status: 503 }
    );
  }
  return null;
}
