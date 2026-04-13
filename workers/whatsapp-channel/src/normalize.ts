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
      const linePhoneNumberId = value.metadata?.phone_number_id?.trim();
      const lineDisplayPhoneNumber = value.metadata?.display_phone_number?.trim();

      for (const msg of value.messages ?? []) {
        const contact = value.contacts?.find((c) => c.wa_id === msg.from);

        if (msg.type === "text") {
          const body = msg.text?.body?.trim();
          if (!body) continue;

          results.push({
            phoneNumber: msg.from,
            messageId: msg.id,
            body,
            timestamp: msg.timestamp,
            linePhoneNumberId: linePhoneNumberId || undefined,
            lineDisplayPhoneNumber: lineDisplayPhoneNumber || undefined,
            senderName: contact?.profile?.name,
            messageType: "text",
          });
          continue;
        }

        if (msg.type === "image" && msg.image?.id) {
          results.push({
            phoneNumber: msg.from,
            messageId: msg.id,
            body: msg.image.caption?.trim() || "[image]",
            timestamp: msg.timestamp,
            linePhoneNumberId: linePhoneNumberId || undefined,
            lineDisplayPhoneNumber: lineDisplayPhoneNumber || undefined,
            senderName: contact?.profile?.name,
            messageType: "image",
            media: {
              kind: "image",
              mediaId: msg.image.id,
              mimeType: msg.image.mime_type,
              caption: msg.image.caption?.trim() || undefined,
              sha256: msg.image.sha256,
            },
          });
          continue;
        }

        if (msg.type === "document" && msg.document?.id) {
          results.push({
            phoneNumber: msg.from,
            messageId: msg.id,
            body: msg.document.caption?.trim() || msg.document.filename?.trim() || "[document]",
            timestamp: msg.timestamp,
            linePhoneNumberId: linePhoneNumberId || undefined,
            lineDisplayPhoneNumber: lineDisplayPhoneNumber || undefined,
            senderName: contact?.profile?.name,
            messageType: "document",
            media: {
              kind: "document",
              mediaId: msg.document.id,
              mimeType: msg.document.mime_type,
              fileName: msg.document.filename?.trim() || undefined,
              caption: msg.document.caption?.trim() || undefined,
              sha256: msg.document.sha256,
            },
          });
        }
      }
    }
  }

  return results;
}
