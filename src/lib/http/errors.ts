import { NextResponse } from "next/server";
import { DatabaseUnavailableError } from "@/lib/db";

export function respondDatabaseError(error: unknown) {
  if (error instanceof DatabaseUnavailableError) {
    console.error("DATABASE_UNAVAILABLE", error);
    const errorId = globalThis.crypto?.randomUUID?.() ?? `db_unavailable_${Date.now()}`;
    const hint =
      error.reason === "binding-missing"
        ? "Bind DRACO_DB to the Pages project (Settings > Functions > D1 binding named DRACO_DB)."
        : error.reason === "table-missing"
          ? "Run D1 migrations for DRACO_DB (wrangler d1 migrations apply drako_db --remote)."
          : error.message || "Run D1 migrations for DRACO_DB (wrangler d1 migrations apply drako_db --remote).";
    return NextResponse.json(
      { ok: false, errorId, reason: error.reason, hint },
      { status: 503 }
    );
  }
  return null;
}
