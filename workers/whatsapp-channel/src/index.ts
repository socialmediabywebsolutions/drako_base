/**
 * whatsapp-channel/src/index.ts
 *
 * Cloudflare Worker — WhatsApp channel adapter.
 *
 * This worker is CHANNEL LAYER ONLY. It does not resolve tenants, domains,
 * or business logic. All of that happens in the Next.js backend.
 *
 *   CHANNEL LAYER (this file + security.ts + normalize.ts):
 *     - Meta webhook verification (GET /webhook)
 *     - HMAC-SHA256 signature validation
 *     - Payload normalization to NormalizedInbound
 *     - Allowlist enforcement
 *     - Sending reply via Meta Graph API
 *     → Reusable by any future SaaS that needs a WhatsApp adapter
 *
 *   ROUTING LAYER (/api/conversation-router — Next.js):
 *     - Resolves tenantId + saasId + actorType from saas_whatsapp_identities
 *       using getWhatsappIdentityByPhoneGlobal
 *     - Routes to the correct domain handler
 *     - Returns RouteResult (reply text, intent)
 *
 *   DOMAIN LAYER (Next.js — runWhatsappAutomation):
 *     - Full WhatsApp automation logic, intent classification, conversation mgmt
 *
 * Rules enforced:
 *   - No tenant resolution in this file
 *   - No cookies forwarded anywhere
 *   - No calls to /api/operator/* or any panel endpoint
 *   - No env-var-based phone mappings
 */
import { verifyHmacSha256, isPhoneAllowed } from "./security";
import { extractInboundMessages } from "./normalize";
import type {
  MetaWebhookPayload,
  NormalizedInbound,
  RouterRequest,
  RouterResponse,
  WhatsAppChannelEnv,
} from "./types";

const META_API_VERSION = "v20.0";

// ── CHANNEL LAYER: send reply ─────────────────────────────────────────────────

async function sendWhatsAppText(
  phoneNumber: string,
  body: string,
  env: WhatsAppChannelEnv,
): Promise<void> {
  const url = `https://graph.facebook.com/${META_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phoneNumber,
      type: "text",
      text: { body },
    }),
  });
  if (!res.ok) {
    console.error("[whatsapp-channel] send failed", res.status, await res.text().catch(() => ""));
  }
}

// ── ROUTING LAYER: call conversation router ───────────────────────────────────
// The worker sends only: channel, senderId (phone), message, and channel metadata.
// Tenant resolution (tenantId, saasId, actorType) is done by the router endpoint
// via findWhatsappIdentityByPhoneGlobal against the real saas_whatsapp_identities table.

async function callRouter(
  msg: NormalizedInbound,
  env: WhatsAppChannelEnv,
): Promise<RouterResponse> {
  const payload: RouterRequest = {
    channel: "whatsapp",
    senderId: msg.phoneNumber,
    message: msg.body,
    metadata: {
      messageId: msg.messageId,
      timestamp: msg.timestamp,
      senderName: msg.senderName ?? null,
      messageType: msg.messageType,
      phoneNumberId: msg.linePhoneNumberId ?? null,
      displayPhoneNumber: msg.lineDisplayPhoneNumber ?? null,
      media: msg.media ?? null,
    },
  };

  const res = await fetch(`${env.DRAKO_ROUTER_URL}/api/conversation-router`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.DRAKO_ROUTER_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    return { handled: false, handler: "none", reply: null, error: `ROUTER_HTTP_${res.status}` };
  }

  try {
    return (await res.json()) as RouterResponse;
  } catch {
    return { handled: false, handler: "none", reply: null, error: "ROUTER_PARSE_ERROR" };
  }
}

// ── Worker entry point ────────────────────────────────────────────────────────

export default {
  async fetch(
    request: Request,
    env: WhatsAppChannelEnv,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    // ── GET /webhook — Meta subscription verification ─────────────────────
    if (request.method === "GET" && url.pathname === "/webhook") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (mode === "subscribe" && token === env.WHATSAPP_VERIFY_TOKEN && challenge) {
        return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
      }
      return new Response("Forbidden", { status: 403 });
    }

    // ── POST /webhook — Inbound message ───────────────────────────────────
    if (request.method === "POST" && url.pathname === "/webhook") {
      // 1. Read raw body before any parsing (required for HMAC)
      const rawBody = await request.text();

      // 2. HMAC-SHA256 signature validation (CHANNEL LAYER)
      const signature = request.headers.get("x-hub-signature-256") ?? "";
      const valid = await verifyHmacSha256(env.WHATSAPP_APP_SECRET, rawBody, signature);
      if (!valid) {
        console.warn("[whatsapp-channel] invalid HMAC signature");
        return new Response("Unauthorized", { status: 401 });
      }

      // 3. Parse payload
      let payload: MetaWebhookPayload;
      try {
        payload = JSON.parse(rawBody) as MetaWebhookPayload;
      } catch {
        return new Response("Bad Request", { status: 400 });
      }

      // 4. Extract supported inbound messages (CHANNEL LAYER)
      const messages = extractInboundMessages(payload);

      // 5. Process every message in the background. Meta's webhook delivery has its own
      // timeout (~20s) and expects the 200 ack promptly — callRouter()/sendWhatsAppText()
      // can take longer than that (AI reply generation on the other end), so that work is
      // deferred via ctx.waitUntil() instead of making Meta wait for it inline.
      ctx.waitUntil(
        Promise.resolve().then(async () => {
          for (const msg of messages) {
            // 5a. Allowlist check (CHANNEL LAYER)
            if (!isPhoneAllowed(msg.phoneNumber, env.ALLOWED_PHONES)) {
              console.warn("[whatsapp-channel] phone not in allowlist", msg.phoneNumber);
              continue;
            }

            // 5b. Route to conversation router (ROUTING + DOMAIN handled by Next.js)
            // The router resolves tenantId/saasId/actorType from saas_whatsapp_identities.
            const result = await callRouter(msg, env);

            if (result.error) {
              console.error("[whatsapp-channel] router error", result.error, msg.messageId);
              continue;
            }

            // 5d. Send reply (CHANNEL LAYER — read-only: only text replies, no mutations)
            if (result.reply) {
              await sendWhatsAppText(msg.phoneNumber, result.reply, env);
            }
          }
        }),
      );

      // Meta requires a 200 response to acknowledge receipt — returned immediately,
      // without waiting for the background processing above to finish.
      return new Response("OK", { status: 200 });
    }

    return new Response("Not Found", { status: 404 });
  },
};
