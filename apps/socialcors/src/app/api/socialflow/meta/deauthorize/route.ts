export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { env } from "@/lib/cf";
import { verifyMetaSignedRequest } from "@/lib/socialflow/meta/signedRequest";

type MatchedAccount = { id: string; tenant_id: string; saas_id: string };

// Meta Deauthorize Callback. Sin sesión, misma autenticación por firma que
// data-deletion/route.ts. A diferencia de esa ruta: aquí el usuario solo revocó el
// acceso, no pidió borrar sus datos — se desconecta la cuenta e invalida el token,
// pero se conservan hilos de conversación y leads (el tenant puede reconectar más
// tarde sin perder ese historial).
export async function POST(request: Request) {
  try {
    const appSecret = env()?.META_APP_SECRET;
    if (!appSecret) {
      return NextResponse.json({ error: "META_APP_SECRET_MISSING" }, { status: 503 });
    }

    const form = await request.formData().catch(() => null);
    const signedRequest = form?.get("signed_request");
    if (typeof signedRequest !== "string" || !signedRequest.trim()) {
      return NextResponse.json({ error: "MISSING_SIGNED_REQUEST" }, { status: 400 });
    }

    const verified = await verifyMetaSignedRequest(signedRequest, appSecret);
    if (!verified.ok) {
      return NextResponse.json({ error: "INVALID_SIGNED_REQUEST", message: verified.error }, { status: 403 });
    }

    const igUserId = verified.payload.user_id;
    const db = env()?.SOCIAL_DB;
    if (!db) {
      return NextResponse.json({ error: "SOCIAL_DB_UNAVAILABLE" }, { status: 503 });
    }

    const matches = await db
      .prepare(
        `SELECT id, tenant_id, saas_id FROM saas_social_accounts
         WHERE provider = 'INSTAGRAM' AND json_extract(auth_meta, '$.igUserId') = ?`,
      )
      .bind(igUserId)
      .all<MatchedAccount>();
    const accounts = matches.results ?? [];

    const now = new Date().toISOString();
    for (const account of accounts) {
      // auth_meta a NULL, no solo el accessToken — fuerza una reconexión limpia (nuevo
      // OAuth) en vez de dejar un igUserId/authType huérfano que podría confundir a
      // requireInstagramCredentials si alguien reactivara la fila sin volver a conectar.
      await db
        .prepare(`UPDATE saas_social_accounts SET status = 'DISCONNECTED', auth_meta = NULL, updated_at = ? WHERE id = ?`)
        .bind(now, account.id)
        .run();

      // Log explícito — a diferencia del botón manual en accounts/disconnect, este
      // trigger viene de Meta (el usuario revocó el acceso desde Facebook/Instagram,
      // no desde Socialcors), así que queda registrado por separado para poder
      // distinguir ambas causas si un tenant reporta una desconexión que no pidió.
      console.log("SOCIALFLOW_ACCOUNT_DISCONNECTED", {
        provider: "INSTAGRAM",
        accountId: account.id,
        tenantId: account.tenant_id,
        igUserId,
        source: "meta_deauthorize_webhook",
      });
    }

    return NextResponse.json({ success: true, accountsDisconnected: accounts.length });
  } catch (error) {
    console.error("SOCIALFLOW_META_DEAUTHORIZE_ERROR", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "DEAUTHORIZE_FAILED" }, { status: 500 });
  }
}
