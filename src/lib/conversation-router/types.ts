/**
 * conversation-router/types.ts
 *
 * Canonical contracts for the transversal conversation router.
 * Import these types in any consumer: Campamento Base, Mentoría, SocialFlow,
 * future factory-generated SaaS, or external workers (WhatsApp channel, etc.).
 *
 * Rules:
 * - No runtime imports here (types only)
 * - No coupling to any specific SaaS domain
 * - No dependency on cookies, sessions, or panel endpoints
 */

/**
 * Channel types for the conversation router.
 * Aligned with ConversationChannel from conversations/types.ts but lowercase for router consistency.
 * 
 * NOTE: This uses lowercase variants for consistency with external channel identifiers.
 * The conversations system uses uppercase variants (WHATSAPP, EMAIL, etc.).
 */
export type Channel = "whatsapp" | "instagram_dm" | "messenger" | "email" | "phone_call" | "in_person" | "sms" | "slack" | "api" | "other";

/**
 * A normalized inbound conversation turn.
 * Created by channel adapters (WhatsApp worker, email intake, etc.)
 * before being handed to the router.
 */
export type ConversationRoute = {
  channel: Channel;
  /** Phone number, email address, user ID — whatever identifies the sender on this channel */
  senderId: string;
  /** Platform tenant that owns this conversation */
  tenantId: string;
  /**
   * The SaaS this message is addressed to.
   * Use "campamento-base" for the operator control plane.
   * Use a saas slug for a specific SaaS (e.g. "mentoria-acme", "socialflow-xyz").
   */
  saasTarget: string;
  /** Raw text of the inbound message */
  message: string;
  /** Optional extra context the channel adapter wants to forward (e.g. sender name, message ID) */
  metadata?: Record<string, unknown>;
};

/**
 * What the router returns after handling a turn.
 */
export type RouteResult = {
  /** Whether a handler actually processed the message */
  handled: boolean;
  /** Identifies which handler produced this result */
  handler: string;
  /** The text reply to send back on the channel. null = no reply */
  reply: string | null;
  /** Optional detected intent (e.g. "best_saas", "critical_alerts") */
  intent?: string;
  /** Optional confidence score [0-1] if the handler supports it */
  confidence?: number;
  /** Error code if something went wrong */
  error?: string;
};

/**
 * The contract every domain handler must fulfill.
 * Campamento Base, Mentoría, SocialFlow — each registers one (or more) handlers.
 */
export type ConversationHandler = (route: ConversationRoute) => Promise<RouteResult>;
