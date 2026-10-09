export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { env } from "@/lib/cf";
import { verifyMetaSignedRequest } from "@/lib/socialflow/meta/signedRequest";
import { createDataDeletionRequest } from "@/lib/socialflow/meta/dataDeletionRepository";

const CONFIRMATION_BASE_URL = "https://socialcors.com/privacidad/datos-eliminados";

type MatchedAccount = { id: string; tenant_id: string; saas_id: string };

// Meta Data Deletion Request Callback. Sin sesión — llamada server-to-server de Meta,
// autenticada solo por la firma del signed_request (ver signedRequest.ts). Alcance del
// borrado (confirmado explícitamente, 2026-08-25): cuenta de Instagram conectada +
// hilos de conversación + leads derivados de esos hilos, para el/los tenant(s) cuyo
// igUserId coincide con el user_id del payload. Posts/campañas propias del tenant NO
// se tocan — son contenido generado por el cliente, no datos obtenidos vía los
// permisos de Meta.
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

    // Búsqueda cruzando todos los tenants — Meta no nos dice a cuál pertenece, solo el
    // igUserId. json_extract es soporte nativo de SQLite/D1, sin migración necesaria.
    const matches = await db
      .prepare(
        `SELECT id, tenant_id, saas_id FROM saas_social_accounts
         WHERE provider = 'INSTAGRAM' AND json_extract(auth_meta, '$.igUserId') = ?`,
      )
      .bind(igUserId)
      .all<MatchedAccount>();
    const accounts = matches.results ?? [];

    let threadsDeleted = 0;
    let leadsDeleted = 0;
    let firstTenantId: string | null = null;

    for (const account of accounts) {
      firstTenantId ??= account.tenant_id;

      const leadsResult = await db
        .prepare(`DELETE FROM socialflow_leads WHERE tenant_id = ? AND saas_id = ? AND provider = 'INSTAGRAM'`)
        .bind(account.tenant_id, account.saas_id)
        .run();
      leadsDeleted += (leadsResult.meta as { changes?: number } | undefined)?.changes ?? 0;

      const threadsResult = await db
        .prepare(`DELETE FROM socialflow_conversation_threads WHERE tenant_id = ? AND saas_id = ? AND provider = 'INSTAGRAM'`)
        .bind(account.tenant_id, account.saas_id)
        .run();
      threadsDeleted += (threadsResult.meta as { changes?: number } | undefined)?.changes ?? 0;

      await db.prepare(`DELETE FROM saas_social_accounts WHERE id = ?`).bind(account.id).run();
    }

    const record = await createDataDeletionRequest(db, {
      igUserId,
      tenantId: firstTenantId,
      accountsDeleted: accounts.length,
      threadsDeleted,
      leadsDeleted,
    });

    return NextResponse.json({
      url: `${CONFIRMATION_BASE_URL}?id=${record.confirmationCode}`,
      confirmation_code: record.confirmationCode,
    });
  } catch (error) {
    console.error("SOCIALFLOW_META_DATA_DELETION_ERROR", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "DATA_DELETION_FAILED" }, { status: 500 });
  }
}
