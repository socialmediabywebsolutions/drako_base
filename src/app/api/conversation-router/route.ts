export const dynamic = "force-dynamic";

/**
 * /api/conversation-router
 *
 * Internal service endpoint for the transversal conversation router.
 *
 * Authentication: Bearer token via DRAKO_ROUTER_SECRET env var.
 * - No cookies accepted
 * - No session required
 * - Designed for machine-to-machine calls (e.g. WhatsApp channel worker)
 *
 * This endpoint is NOT a panel/UI endpoint. It must never be called by
 * browser clients directly. The DRAKO_ROUTER_SECRET must be rotated as
 * a standard secret (wrangler secret put DRAKO_ROUTER_SECRET).
 */
import { NextRequest, NextResponse } from "next/server";
import { routeConversation } from "@/lib/conversation-router";
import { registerCampamentoBaseWhatsappHandler } from "@/lib/conversation-router/handlers";
import { registerMentoriaWhatsappHandler } from "@/lib/conversation-router/handlers";
import { findWhatsappIdentityByPhoneAndLineGlobal } from "@/lib/whatsapp/repository";
import { PlatformTypeResolutionError, resolvePlatformTypeFromSaasId } from "@/lib/saas/resolve-platform-type";
import type { Channel } from "@/lib/conversation-router/types";

const VALID_CHANNELS = new Set<Channel>(["whatsapp", "instagram_dm", "messenger", "email", "phone_call", "in_person", "sms", "slack", "api", "other"]);

let handlersBootstrapped = false;

function bootstrapHandlers(): void {
  if (handlersBootstrapped) return;
  
  // Active domain handlers for WhatsApp.
  registerCampamentoBaseWhatsappHandler();
  registerMentoriaWhatsappHandler();
  
  handlersBootstrapped = true;
}

function readLineHints(metadata: Record<string, unknown>): { phoneNumberId: string | null; displayPhoneNumber: string | null } {
  const phoneNumberId = typeof metadata.phoneNumberId === "string" ? metadata.phoneNumberId.trim() : "";
  const displayPhoneNumber = typeof metadata.displayPhoneNumber === "string" ? metadata.displayPhoneNumber.trim() : "";
  return {
    phoneNumberId: phoneNumberId || null,
    displayPhoneNumber: displayPhoneNumber || null,
  };
}

function validateBearer(request: NextRequest): boolean {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return false;
  const token = auth.slice(7).trim();
  const expected = process.env.DRAKO_ROUTER_SECRET ?? "";
  return expected.length > 0 && token === expected;
}

function platformTypeResolutionStatus(code: PlatformTypeResolutionError["code"]): number {
  switch (code) {
    case "PLATFORM_TYPE_SAAS_NOT_FOUND":
      return 404;
    case "PLATFORM_TYPE_INVALID":
      return 422;
    case "PLATFORM_TYPE_DB_UNAVAILABLE":
      return 503;
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  if (!validateBearer(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const channel = typeof b.channel === "string" ? b.channel : null;
  const senderId = typeof b.senderId === "string" ? b.senderId.trim() : null;
  const message = typeof b.message === "string" ? b.message.trim() : null;

  if (!channel || !senderId || !message) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", required: ["channel", "senderId", "message"] },
      { status: 422 },
    );
  }

  if (!VALID_CHANNELS.has(channel as Channel)) {
    return NextResponse.json({ error: "INVALID_CHANNEL", valid: Array.from(VALID_CHANNELS) }, { status: 422 });
  }

  const incomingMetadata =
    b.metadata && typeof b.metadata === "object" && !Array.isArray(b.metadata)
      ? (b.metadata as Record<string, unknown>)
      : {};

  // Resolve tenantId + saasTarget based on channel
  let tenantId = typeof b.tenantId === "string" ? b.tenantId.trim() : null;
  let saasTarget = typeof b.saasTarget === "string" ? b.saasTarget.trim() : null;
  let resolvedMetadata: Record<string, unknown> = { ...incomingMetadata };

  if (channel === "whatsapp" && !tenantId) {
    // For inbound WhatsApp from the channel worker, tenantId is resolved here
    // from the saas_whatsapp_identities table using the sender phone number.
    const lineHints = readLineHints(resolvedMetadata);
    const identity = await findWhatsappIdentityByPhoneAndLineGlobal({
      phoneNumber: senderId,
      phoneNumberId: lineHints.phoneNumberId,
      displayPhoneNumber: lineHints.displayPhoneNumber,
    }).catch(() => null);
    if (!identity) {
      return NextResponse.json({ error: "UNKNOWN_SENDER", senderId }, { status: 404 });
    }
    tenantId = identity.tenantId;
    // Resolve the platform handler key from the SaaS instance record.
    // saas_instances.platform_type is the authoritative source for routing.
    // No silent fallback is allowed: unresolved or invalid platform types must
    // fail closed so the message is observable and never routed to the wrong domain.
    try {
      saasTarget = await resolvePlatformTypeFromSaasId(identity.saasId);
    } catch (error) {
      const detail = error instanceof PlatformTypeResolutionError ? error.code : "PLATFORM_TYPE_DB_UNAVAILABLE";
      return NextResponse.json(
        { error: "PLATFORM_TYPE_RESOLUTION_FAILED", detail, saasId: identity.saasId },
        {
          status:
            detail === "PLATFORM_TYPE_SAAS_NOT_FOUND"
              ? platformTypeResolutionStatus("PLATFORM_TYPE_SAAS_NOT_FOUND")
              : detail === "PLATFORM_TYPE_INVALID"
                ? platformTypeResolutionStatus("PLATFORM_TYPE_INVALID")
                : platformTypeResolutionStatus("PLATFORM_TYPE_DB_UNAVAILABLE"),
        },
      );
    }
    resolvedMetadata = {
      ...resolvedMetadata,
      saasId: identity.saasId,
      actorType: identity.actorType,
      actorId: identity.actorId,
    };
  }

  if (!tenantId || !saasTarget) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", detail: "tenantId and saasTarget are required for non-whatsapp channels" },
      { status: 422 },
    );
  }

  bootstrapHandlers();

  try {
    const result = await routeConversation({
      channel: channel as Channel,
      senderId,
      tenantId,
      saasTarget,
      message,
      metadata: resolvedMetadata,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/conversation-router] unhandled error", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
