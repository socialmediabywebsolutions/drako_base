const FB_GRAPH_BASE = "https://graph.facebook.com/v19.0";

export type InstagramComment = {
  id: string;
  text: string;
  username: string;
  timestamp: string;
};

export type FetchCommentsResult =
  | { ok: true; comments: InstagramComment[]; cursor: string | null }
  | { ok: false; error: string; code?: string };

export type ReplyResult = { ok: true; replyId: string } | { ok: false; error: string };

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

// Reads up to 50 top-level comments for a published media object.
// Requires: instagram_basic + instagram_manage_comments permissions on the Page token.
export async function fetchInstagramComments(
  mediaId: string,
  accessToken: string,
): Promise<FetchCommentsResult> {
  if (!mediaId.trim() || !accessToken.trim()) {
    return { ok: false, error: "mediaId and accessToken are required" };
  }

  const url = new URL(`${FB_GRAPH_BASE}/${mediaId}/comments`);
  url.searchParams.set("fields", "id,text,username,timestamp");
  url.searchParams.set("limit", "50");
  url.searchParams.set("access_token", accessToken);

  let response: Response;
  try {
    response = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  } catch (err) {
    return { ok: false, error: `Network error: ${err instanceof Error ? err.message : String(err)}` };
  }

  const payload = await parseJson(response);
  if (!response.ok) {
    return { ok: false, error: apiError(payload, "Instagram comments fetch failed"), code: "IG_COMMENTS_FETCH_FAILED" };
  }

  const data = Array.isArray(payload?.data) ? payload.data : [];
  const comments: InstagramComment[] = data.flatMap((entry) => {
    const rec = toRecord(entry);
    if (!rec || typeof rec.id !== "string" || typeof rec.text !== "string") return [];
    return [{
      id: rec.id,
      text: rec.text,
      username: typeof rec.username === "string" ? rec.username : "unknown",
      timestamp: typeof rec.timestamp === "string" ? rec.timestamp : new Date().toISOString(),
    }];
  });

  const paging = toRecord(payload?.paging);
  const cursor = typeof paging?.next === "string" ? paging.next : null;

  return { ok: true, comments, cursor };
}

// Posts a reply to an existing Instagram comment.
// Requires: instagram_manage_comments permission.
export async function replyToInstagramComment(
  commentId: string,
  message: string,
  accessToken: string,
): Promise<ReplyResult> {
  if (!commentId.trim() || !message.trim() || !accessToken.trim()) {
    return { ok: false, error: "commentId, message, and accessToken are required" };
  }

  const url = new URL(`${FB_GRAPH_BASE}/${commentId}/replies`);
  const body = new URLSearchParams({ message: message.trim(), access_token: accessToken });

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      cache: "no-store",
    });
  } catch (err) {
    return { ok: false, error: `Network error: ${err instanceof Error ? err.message : String(err)}` };
  }

  const payload = await parseJson(response);
  if (!response.ok) {
    return { ok: false, error: apiError(payload, "Instagram reply failed") };
  }

  const replyId = typeof payload?.id === "string" ? payload.id : "unknown";
  return { ok: true, replyId };
}
