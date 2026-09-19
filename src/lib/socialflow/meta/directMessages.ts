/**
 * Instagram real direct messages — used by the CRM Social "Aprobar" flow on DM
 * threads (see threads/[id]/route.ts). Deliberately NOT the same call as
 * privateReplies.ts: that one sends recipient.comment_id (one-shot private reply
 * tied to a comment, max once per comment, 7-day window); this one sends
 * recipient.id (the sender's IGSID) for a genuine, repeatable DM reply within an
 * existing conversation thread. Same `/{ig-id}/messages` endpoint, different
 * recipient shape.
 */

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

async function parseJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const payload = await response.json();
    return toRecord(payload);
  } catch {
    return null;
  }
}

function apiError(payload: Record<string, unknown> | null, fallback: string): string {
  const err = toRecord(payload?.error);
  return (typeof err?.message === "string" ? err.message : null) ?? fallback;
}

export type SendDmResult = { ok: true; messageId: string } | { ok: false; error: string };

// apiBase viene de requireInstagramCredentials() (publishing.ts) — graph.instagram.com
// para cuentas instagram_business_login, graph.facebook.com para el flujo clásico de
// Facebook Pages — mismo criterio que replyToInstagramComment, nunca hardcodeado (a
// diferencia de privateReplies.ts, que solo sirve cuentas instagram_business_login).
export async function sendInstagramDirectMessage(
  igUserId: string,
  recipientIgsid: string,
  message: string,
  accessToken: string,
  apiBase: string,
): Promise<SendDmResult> {
  const normalizedId = igUserId.trim();
  const normalizedRecipient = recipientIgsid.trim();
  const normalizedMessage = message.trim();
  const normalizedToken = accessToken.trim();
  if (!normalizedId || !normalizedRecipient || !normalizedMessage || !normalizedToken) {
    return { ok: false, error: "igUserId, recipientIgsid, message, and accessToken are required" };
  }

  const url = new URL(`${apiBase}/${normalizedId}/messages`);
  url.searchParams.set("access_token", normalizedToken);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: normalizedRecipient },
        message: { text: normalizedMessage },
      }),
    });
  } catch (err) {
    return { ok: false, error: `Network error: ${err instanceof Error ? err.message : String(err)}` };
  }

  const payload = await parseJson(response);
  if (!response.ok) {
    return { ok: false, error: apiError(payload, "Instagram DM send failed") };
  }

  const messageId =
    typeof payload?.message_id === "string" ? payload.message_id
    : typeof payload?.id === "string" ? payload.id
    : "unknown";
  return { ok: true, messageId };
}
