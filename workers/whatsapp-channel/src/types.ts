/**
 * whatsapp-channel/src/types.ts
 *
 * Types for the WhatsApp channel worker.
 * Split in two layers (intentional — mirrors the architectural boundaries):
 *
 * CHANNEL LAYER (reusable):
 *   WhatsAppChannelEnv, MetaWebhookPayload, MetaEntry, MetaChange,
 *   MetaChangeValue, MetaInboundMessage, NormalizedInbound
 *   → These belong to the channel adapter. Any other SaaS can reuse them.
 *
 * ROUTING LAYER (reusable):
 *   RouterRequest, RouterResponse
 *   → These match the /api/conversation-router contract. Shared across channels.
 *   → For whatsapp channel: tenantId/saasTarget are omitted by the worker and
 *     resolved by the Next.js router via saas_whatsapp_identities table.
 *
 * NOTE: There is NO domain layer in this worker. Tenant resolution, automation
 * logic, and intent classification all live in the Next.js backend.
 */

// ── Channel layer ─────────────────────────────────────────────────────────────

export type WhatsAppChannelEnv = {
  /** Token used to verify the Meta webhook subscription (GET challenge) */
  WHATSAPP_VERIFY_TOKEN: string;
  /** App secret used to validate HMAC-SHA256 signatures on inbound payloads */
  WHATSAPP_APP_SECRET: string;
  /** Bearer token for the WhatsApp Graph API (sending messages) */
  WHATSAPP_API_TOKEN: string;
  /** Meta Phone Number ID for the sending account */
  WHATSAPP_PHONE_NUMBER_ID: string;
  /** Base URL of the Drako Next.js app (e.g. https://app.drako.io) */
  DRAKO_ROUTER_URL: string;
  /** Shared secret for machine-to-machine calls to /api/conversation-router */
  DRAKO_ROUTER_SECRET: string;
  /**
   * Optional comma-separated phone number allowlist.
   * If empty/absent: all verified phones are allowed (open mode).
   * In production, always set an explicit allowlist.
   */
  ALLOWED_PHONES?: string;
};

/** Root envelope sent by Meta for all webhook events */
export type MetaWebhookPayload = {
  object: string;
  entry: MetaEntry[];
};

export type MetaEntry = {
  id: string;
  changes: MetaChange[];
};

export type MetaChange = {
  value: MetaChangeValue;
  field: string;
};

export type MetaChangeValue = {
  messaging_product: string;
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: Array<{
    profile: { name: string };
    wa_id: string;
  }>;
  messages?: MetaInboundMessage[];
};

export type MetaInboundMessage = {
  from: string;
  id: string;
  timestamp: string;
  type: "text" | "image" | "document" | "audio" | "video" | string;
  text?: { body: string };
  image?: {
    id: string;
    mime_type?: string;
    caption?: string;
    sha256?: string;
  };
  document?: {
    id: string;
    mime_type?: string;
    filename?: string;
    caption?: string;
    sha256?: string;
  };
};

/** Normalized inbound turn — channel-agnostic representation */
export type NormalizedInbound = {
  phoneNumber: string;
  messageId: string;
  body: string;
  timestamp: string;
  senderName?: string;
  messageType: "text" | "image" | "document";
  media?: {
    kind: "image" | "document";
    mediaId: string;
    mimeType?: string;
    fileName?: string;
    caption?: string;
    sha256?: string;
  };
};

// ── Routing layer ─────────────────────────────────────────────────────────────

/**
 * Payload sent to /api/conversation-router.
 *
 * For whatsapp channel: tenantId and saasTarget are optional.
 * The router resolves them via findWhatsappIdentityByPhoneGlobal using senderId.
 * For all other channels, tenantId and saasTarget must be provided by the caller.
 */
export type RouterRequest = {
  channel: "whatsapp" | string;
  senderId: string;
  /** Resolved by the router for whatsapp channel. Required for all others. */
  tenantId?: string;
  /** Resolved by the router for whatsapp channel. Required for all others. */
  saasTarget?: string;
  message: string;
  metadata?: Record<string, unknown>;
};

/** Response from /api/conversation-router */
export type RouterResponse = {
  handled: boolean;
  handler: string;
  reply: string | null;
  intent?: string;
  error?: string;
};

// No domain layer types in this worker.
// Tenant resolution is handled by the Next.js conversation router endpoint.
