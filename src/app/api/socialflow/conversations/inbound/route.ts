import { env } from "@/lib/cf";
import { generateConversationalReply } from "@/lib/socialflow/conversational/engine";
import {
  getConversationSettings,
  ingestConversationThread,
  resolveSocialContext,
  updateConversationThread,
} from "@/lib/socialflow/conversational/repository";
import { isWithinActiveHours } from "@/lib/socialflow/conversational/active-hours";
import { getChannelKnowledge } from "@/lib/socialflow/profile/repository";
import { getKnowledgeContext } from "@/lib/socialflow/knowledge/repository";
import type { ConversationThreadType } from "@/lib/socialflow/conversational/types";
import { detectLeadSignals } from "@/lib/socialflow/leads/detector";
import { createLead } from "@/lib/socialflow/leads/repository";
import { listSaasSocialAccounts } from "@/lib/socialflow/repository";
import { requireInstagramCredentials } from "@/lib/socialflow/meta/publishing";
import { sendInstagramDirectMessage } from "@/lib/socialflow/meta/directMessages";

export const dynamic = "force-dynamic";

// Formato real de un evento de Instagram Messaging (Meta), anidado en
// entry[].messaging[] — distinto del InboundBody plano que el resto de este archivo
// espera. Antes de este cambio ningún evento real de Meta pasaba de aquí: JSON.parse
// (rawBody) daba un objeto sin incoming_message/provider y caía en el 400
// MISSING_REQUIRED_FIELDS sin crear ningún hilo (ver transformMetaWebhookBody abajo).
type MetaMessagingEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: { mid?: string; text?: string };
};

type MetaWebhookEntry = {
  id?: string;
  messaging?: MetaMessagingEvent[];
};

type MetaWebhookBody = {
  object?: string;
  entry?: MetaWebhookEntry[];
};

function isMetaRealFormat(value: unknown): value is MetaWebhookBody {
  if (!value || typeof value !== "object") return false;
  const entry = (value as MetaWebhookBody).entry;
  return Array.isArray(entry) && entry.length > 0 && Array.isArray(entry[0]?.messaging) && entry[0].messaging!.length > 0;
}

type ResolvedInstagramAccount = { tenant_id: string; saas_id: string };

// Mismo patrón que meta/data-deletion/route.ts (única fuente de verdad hoy para
// resolver tenant a partir de un igUserId de Meta): json_extract sobre auth_meta —
// saas_social_accounts no tiene una columna ig_user_id propia, el id vive dentro del
// JSON guardado al conectar la cuenta (ver instagram/oauth.ts).
async function resolveInstagramAccountByIgUserId(db: D1Database, igUserId: string): Promise<ResolvedInstagramAccount | null> {
  const row = await db
    .prepare(
      `SELECT tenant_id, saas_id FROM saas_social_accounts
       WHERE provider = 'INSTAGRAM' AND json_extract(auth_meta, '$.igUserId') = ?
       LIMIT 1`,
    )
    .bind(igUserId)
    .first<ResolvedInstagramAccount>();
  return row ?? null;
}

type NormalizedInboundEvent = {
  tenantId: string | null;
  saasId: string | null;
  provider: string;
  threadType: "DM";
  incomingMessage: string;
  platformThreadId: string;
};

// Transforma el payload real de Meta (entry[].messaging[]) al formato interno que ya
// espera el resto del handler. Si el body no tiene esa forma, devuelve null — el
// caller sigue con el parseo plano de siempre (llamadas internas/de prueba).
async function transformMetaWebhookBody(body: MetaWebhookBody, db: D1Database | undefined): Promise<NormalizedInboundEvent | null> {
  const entry = body.entry![0];
  const messagingEvent = entry.messaging![0];

  const incomingMessage = messagingEvent.message?.text?.trim() ?? "";
  const platformThreadId = messagingEvent.sender?.id?.trim() ?? "";
  const igUserId = entry.id?.trim() ?? "";

  let resolved: ResolvedInstagramAccount | null = null;
  if (db && igUserId) {
    resolved = await resolveInstagramAccountByIgUserId(db, igUserId);
  }

  return {
    tenantId: resolved?.tenant_id ?? null,
    saasId: resolved?.saas_id ?? null,
    provider: "INSTAGRAM",
    threadType: "DM",
    incomingMessage,
    platformThreadId,
  };
}

// Bug 2 fix: verify real Meta webhook POST events via HMAC-SHA256 (X-Hub-Signature-256).
// crypto.subtle.verify is constant-time, preventing timing attacks.
async function verifyMetaSignature(rawBody: string, request: Request): Promise<boolean> {
  const appSecret = env()?.META_APP_SECRET;
  if (!appSecret) return false;
  const signature = request.headers.get("x-hub-signature-256");
  if (!signature?.startsWith("sha256=")) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const sigHex = signature.slice(7);
  const sigBytes = new Uint8Array(sigHex.match(/.{2}/g)?.map((b) => parseInt(b, 16)) ?? []);
  if (sigBytes.length === 0) return false;
  return crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(rawBody));
}

// Meta webhook verification challenge (GET)
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const challenge = url.searchParams.get("hub.challenge");
  const verifyToken = url.searchParams.get("hub.verify_token");
  const expected = env()?.SOCIALFLOW_WEBHOOK_VERIFY_TOKEN;

  // Bug 3 fix: guard against empty/unset expected token before comparing.
  if (expected && mode === "subscribe" && verifyToken === expected && challenge) {
    return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
  }
  return new Response(JSON.stringify({ error: "FORBIDDEN" }), {
    status: 403,
    headers: { "content-type": "application/json" },
  });
}

// Inbound webhook event (POST)
// Requires a valid X-Hub-Signature-256 HMAC header on every request — no unsigned
// fallback. There is no known caller of the old ?verifyToken= relay mode in this repo.
// Bug 1 fix: tenantId is read from the URL query param (operator-controlled at webhook
// registration time), never from the request body, so a caller cannot escalate to another
// tenant by supplying a different tenantId in the POST body.
export async function POST(request: Request) {
  try {
    // Read raw body first so HMAC can verify the exact bytes Meta signed.
    const rawBody = await request.text().catch(() => "");

    const authenticated = await verifyMetaSignature(rawBody, request);

    if (!authenticated) {
      return new Response(JSON.stringify({ error: "FORBIDDEN" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }

    // Bug 1 fix: para el formato plano (llamadas internas) tenantId viene del URL, no
    // del body. Para el formato real de Meta no hay tenantId en la URL en absoluto —
    // Meta llama a la URL genérica registrada en el panel de la app, no a una URL por
    // tenant — así que en ese caso se resuelve más abajo por igUserId.
    const url = new URL(request.url);
    const tenantIdFromUrl = url.searchParams.get("tenantId")?.trim();

    type InboundBody = {
      provider?: string;
      thread_type?: string;
      incoming_message?: string;
      sender_name?: string;
      sender_handle?: string;
      platform_thread_id?: string;
      context_post_id?: string;
      saasId?: string;
    };

    let rawParsed: unknown = null;
    try {
      rawParsed = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      // leave null
    }

    let tenantId: string | undefined;
    let saasId: string;
    let provider: string | undefined;
    let incomingMessage: string | undefined;
    let threadType: ConversationThreadType;
    let platformThreadId: string | null;
    let senderName: string | null;
    let senderHandle: string | null;
    let contextPostId: string | null;

    if (isMetaRealFormat(rawParsed)) {
      // Formato real de Instagram Messaging (entry[].messaging[]) — se transforma al
      // formato interno que el resto de este handler ya espera, en vez del InboundBody
      // plano inventado por este proyecto. Hasta este cambio, JSON.parse(rawBody) daba
      // un objeto sin incoming_message/provider y todo evento real caía en el 400
      // MISSING_REQUIRED_FIELDS de abajo sin crear ningún hilo.
      const normalized = await transformMetaWebhookBody(rawParsed, env()?.SOCIAL_DB);
      tenantId = normalized?.tenantId ?? undefined;
      saasId = normalized?.saasId ?? "socialflow";
      provider = normalized?.provider;
      incomingMessage = normalized?.incomingMessage;
      threadType = normalized?.threadType ?? "DM";
      platformThreadId = normalized?.platformThreadId?.trim() || null;
      senderName = null;
      senderHandle = null;
      contextPostId = null;
    } else {
      // Formato plano (llamadas internas/de prueba) — se deja pasar sin transformar.
      const body = rawParsed as InboundBody | null;
      tenantId = tenantIdFromUrl;
      saasId = body?.saasId?.trim() || "socialflow";
      provider = body?.provider?.trim();
      incomingMessage = body?.incoming_message?.trim();
      threadType = (body?.thread_type?.trim() || "DM") as ConversationThreadType;
      platformThreadId = body?.platform_thread_id ?? null;
      senderName = body?.sender_name ?? null;
      senderHandle = body?.sender_handle ?? null;
      contextPostId = body?.context_post_id ?? null;
    }

    if (!tenantId || !provider || !incomingMessage) {
      return new Response(JSON.stringify({ error: "MISSING_REQUIRED_FIELDS" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const ctx = await resolveSocialContext({ tenantId, saasId });
    const [knowledge, knowledgeContext, settings] = await Promise.all([
      getChannelKnowledge(tenantId, saasId),
      getKnowledgeContext(tenantId, saasId).catch(() => ""),
      getConversationSettings(ctx),
    ]);
    // Mismo patrón que el cron de comentarios (cron/social/comments/route.ts) — antes
    // este handler solo pasaba knowledge.profile, así que el DM nunca veía catálogo,
    // horarios ni precios aunque el tenant los tuviera cargados en su Knowledge Base.
    const { suggestedReply, aiMetadata } = await generateConversationalReply({
      incomingMessage,
      threadType,
      provider,
      senderName,
      profile: knowledge.profile,
      knowledge,
      knowledgeContext,
      tenantId,
      saasId,
    });

    const autoSendConfigured = settings.autoSendEnabled && settings.autoSendProviders.includes(provider);

    // Auto-envío real del DM — mismo criterio de horario que ya aplica el cron de
    // comentarios (active-hours.ts). Antes de este cambio, un DM entrante SIEMPRE
    // quedaba en AUTO_APPROVED/PENDING esperando clic humano en "Aprobar", aunque el
    // tenant tuviera auto-envío activado para Instagram. Solo aplica a DM de
    // Instagram (sendInstagramDirectMessage es específico de esa API) — cualquier otro
    // provider/threadType cae al comportamiento anterior sin cambios.
    let dmSent = false;
    if (autoSendConfigured && isWithinActiveHours(settings.activeHoursJson) && provider === "INSTAGRAM" && threadType === "DM" && platformThreadId) {
      try {
        const accounts = await listSaasSocialAccounts(ctx);
        const instagramAccount = accounts.find((a) => a.provider === "INSTAGRAM" && a.status === "CONNECTED_REAL");
        if (instagramAccount) {
          const creds = await requireInstagramCredentials(instagramAccount);
          const dmResult = await sendInstagramDirectMessage(creds.igUserId, platformThreadId, suggestedReply, creds.accessToken, creds.apiBase);
          dmSent = dmResult.ok;
          if (!dmResult.ok) {
            console.error("SOCIALFLOW_INBOUND_DM_AUTOSEND_FAILED", dmResult.error);
          }
        }
      } catch (error) {
        console.error("SOCIALFLOW_INBOUND_DM_AUTOSEND_ERROR", error instanceof Error ? error.message : "unknown");
      }
    }

    // dmSent false por horario/config/fallo de entrega → mismo comportamiento que
    // antes (AUTO_APPROVED esperando clic humano, o PENDING si no hay auto-envío
    // configurado). Un fallo de entrega aquí no es distinto de nunca haberlo
    // intentado: el operador lo aprueba manualmente desde el inbox, donde el PATCH de
    // threads/[id] ya reintenta el envío real y marca DELIVERY_FAILED si vuelve a fallar.
    const status = dmSent ? "SENT" : autoSendConfigured ? "AUTO_APPROVED" : "PENDING";

    const thread = await ingestConversationThread(ctx, {
      provider,
      threadType,
      platformThreadId,
      senderName,
      senderHandle,
      incomingMessage,
      contextPostId,
      suggestedReply,
      status,
      aiMetadata,
    });

    if (dmSent) {
      await updateConversationThread(ctx, thread.id, { status: "SENT", finalReply: suggestedReply });
    }

    // Lead detection: score the message and persist a lead record if signals found.
    const leadSignals = detectLeadSignals(incomingMessage);
    let leadId: string | null = null;
    if (leadSignals.isLead && leadSignals.temperature) {
      try {
        const lead = await createLead(ctx, {
          threadId: thread.id,
          provider,
          senderName,
          senderHandle,
          incomingMessage,
          intentScore: leadSignals.intentScore,
          temperature: leadSignals.temperature,
        });
        leadId = lead.id;
      } catch (err) {
        console.warn("SOCIALFLOW_LEAD_CREATE_WARN", err instanceof Error ? err.message : "unknown");
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        threadId: thread.id,
        status: thread.status,
        lead: leadId ? { id: leadId, temperature: leadSignals.temperature, score: leadSignals.intentScore } : null,
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  } catch (error) {
    console.error("SOCIALFLOW_INBOUND_ERROR", error instanceof Error ? error.message : "unknown");
    return new Response(JSON.stringify({ error: "INBOUND_FAILED" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
