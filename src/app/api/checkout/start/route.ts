import { NextResponse } from "next/server";
import { ensureDatabase, run } from "@/lib/db";
import { respondDatabaseError } from "@/lib/http/errors";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";
export const runtime = "edge";


export async function POST(req: Request) {
  try {
    ensureDatabase();
    const body = (await req.json().catch(() => null)) as { sessionId?: string; amountCents?: number; currency?: string; provider?: string } | null;
    if (!body?.sessionId) return NextResponse.json({ error: "sessionId requerido" }, { status: 400 });
    const id = globalThis.crypto?.randomUUID?.() ?? `chk_${Date.now()}`;
    const provider = body.provider ?? "demo";
    const amount = body.amountCents ?? 14900;
    const currency = body.currency ?? "EUR";
    await run(
      "INSERT INTO checkouts (id, session_id, tenant_id, status, provider, amount_cents, currency, data_json) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)",
      id,
      body.sessionId,
      DEMO_TENANT_ID,
      provider,
      amount,
      currency,
      JSON.stringify({})
    );
    const demoUrl = `/site/onboarding/chat?checkout=${id}`;
    return NextResponse.json({ id, status: "pending", provider, payUrl: demoUrl });
  } catch (error) {
    const dbError = respondDatabaseError(error);
    if (dbError) return dbError;
    const correlationId = globalThis.crypto?.randomUUID?.() ?? `checkout_start_err_${Date.now()}`;
    console.error("CHECKOUT_START_ERROR", correlationId, error);
    return NextResponse.json({ error: "No se pudo iniciar el checkout", correlation_id: correlationId }, { status: 500 });
  }
}
