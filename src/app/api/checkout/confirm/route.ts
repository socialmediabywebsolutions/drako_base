import { NextResponse } from "next/server";
import { ensureDatabase, run } from "@/lib/db";
import { respondDatabaseError } from "@/lib/http/errors";
// export const runtime = "edge"; // OpenNext Migration


export async function POST(req: Request) {
  try {
    ensureDatabase();
    const body = (await req.json().catch(() => null)) as { checkoutId?: string; sessionId?: string; provider?: string } | null;
    if (!body?.checkoutId || !body.sessionId) return NextResponse.json({ error: "checkoutId y sessionId requeridos" }, { status: 400 });
    await run(
      "UPDATE checkouts SET status = 'paid', data_json = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND session_id = ?",
      JSON.stringify({ provider: body.provider ?? "demo", confirmedAt: new Date().toISOString() }),
      body.checkoutId,
      body.sessionId
    );
    return NextResponse.json({ ok: true, status: "paid" });
  } catch (error) {
    const dbError = respondDatabaseError(error);
    if (dbError) return dbError;
    const correlationId = globalThis.crypto?.randomUUID?.() ?? `checkout_confirm_err_${Date.now()}`;
    console.error("CHECKOUT_CONFIRM_ERROR", correlationId, error);
    return NextResponse.json({ error: "No se pudo confirmar el pago", correlation_id: correlationId }, { status: 500 });
  }
}
