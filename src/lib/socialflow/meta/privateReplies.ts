/**
 * Instagram private replies to comments — the Keyword Trigger + Auto DM mechanism.
 *
 * Deliberately NOT the generic DM endpoint: POST /{ig-id}/messages with
 * recipient.comment_id sends a private reply to whoever left that comment, without
 * requiring they've DMed the account before (unlike the standard 24h messaging
 * window). Meta allows at most one private reply per comment, ever, and only within
 * 7 days of the comment — see socialflow_keyword_dm_log's UNIQUE(tenant_id,
 * platform_comment_id) for how the caller enforces the "once" part, and the every-5-
 * minute comments cron for why 7 days is never a real constraint here.
 *
 * Host is hardcoded to graph.instagram.com — same host as meta/core.ts's IG_GRAPH_BASE
 * (private there, duplicated here on purpose), by design: private replies in this
 * project are only ever sent through instagram_business_login accounts.
 */

const IG_MESSAGES_BASE = "https://graph.instagram.com/v22.0";

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

export type SendInstagramPrivateReplyResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

// Sends a private reply to an Instagram comment. Never throws — API-level failures
// (including "this comment already received a private reply", which Meta rejects
// as a normal 4xx, not a special case) come back as { success: false, error }, same
// as any other failure, so the caller can log it as FAILED and rely on
// socialflow_keyword_dm_log's uniqueness to never retry.
export async function sendInstagramPrivateReply(
  igUserId: string,
  accessToken: string,
  commentId: string,
  messageText: string,
): Promise<SendInstagramPrivateReplyResult> {
  const normalizedId = igUserId.trim();
  const normalizedToken = accessToken.trim();
  const normalizedCommentId = commentId.trim();
  const normalizedMessage = messageText.trim();
  if (!normalizedId || !normalizedToken || !normalizedCommentId || !normalizedMessage) {
    return { success: false, error: "igUserId, accessToken, commentId, and messageText are required" };
  }

  const url = new URL(`${IG_MESSAGES_BASE}/${normalizedId}/messages`);
  url.searchParams.set("access_token", normalizedToken);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { comment_id: normalizedCommentId },
        message: { text: normalizedMessage },
      }),
      cache: "no-store",
    });
  } catch (err) {
    return { success: false, error: `Network error: ${err instanceof Error ? err.message : String(err)}` };
  }

  const payload = await parseJson(response);
  if (!response.ok) {
    return { success: false, error: apiError(payload, "Instagram private reply failed") };
  }

  const messageId =
    typeof payload?.message_id === "string" ? payload.message_id
    : typeof payload?.id === "string" ? payload.id
    : "unknown";
  return { success: true, messageId };
}
