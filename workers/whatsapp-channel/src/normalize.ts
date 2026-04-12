/**
 * whatsapp-channel/src/normalize.ts
 *
 * CHANNEL LAYER — fully reusable, zero domain coupling.
 *
 * Converts the Meta Cloud API webhook payload format into a flat,
 * channel-agnostic NormalizedInbound array.
 *
 * Only text messages are extracted in v1.
 * Future: add image/document handling, reaction support, etc.
 */
import type { MetaWebhookPayload, NormalizedInbound } from "./types";

/**
 * Extracts all text messages from a Meta webhook payload.
 * Non-text messages (image, audio, etc.) are silently skipped.
 * Malformed entries are skipped without throwing.
 *
 * @returns An array of normalized inbound turns, one per text message found
 */
export function extractInboundMessages(payload: MetaWebhookPayload): NormalizedInbound[] {
  const results: NormalizedInbound[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;

      const value = change.value;

      for (const msg of value.messages ?? []) {
        if (msg.type !== "text") continue;

        const body = msg.text?.body?.trim();
        if (!body) continue;

        const contact = value.contacts?.find((c) => c.wa_id === msg.from);

        results.push({
          phoneNumber: msg.from,
          messageId: msg.id,
          body,
          timestamp: msg.timestamp,
          senderName: contact?.profile?.name,
        });
      }
    }
  }

  return results;
}
