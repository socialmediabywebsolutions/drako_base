import { requireTenantAccess } from "@/lib/auth/session";
import { resolveSocialContext, upsertSaasSocialPost, getSaasSocialPostById, SocialContextError } from "@/lib/social/repository";
import { publishSocialPostLive } from "@/lib/social/live-publishing";

interface PostRequest {
  saasId: string;
  content: string;
  scheduledAt?: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const saasId = searchParams.get("saasId");
  const status = searchParams.get("status");

  if (!saasId) {
    return new Response(
      JSON.stringify({ error: "saasId is required" }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ items: [], count: 0 }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as PostRequest | null;

  if (!body || !body.saasId || !body.content) {
    return new Response(
      JSON.stringify({
        code: "INVALID_BODY",
        message: "saasId, provider, contentType, title, body and status are required",
        details: {
          requiredFields: ["saasId", "provider", "contentType", "title", "body", "status"],
          simplifiedContract: ["saasId", "content", "scheduledAt?"],
        },
      }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  try {
    await requireTenantAccess(request);
    const context = await resolveSocialContext(body.saasId);

    const postData = {
      saasId: body.saasId,
      provider: "LINKEDIN",
      contentType: "TEXT",
      title: "",
      body: body.content,
      status: body.scheduledAt ? "SCHEDULED" : "DRAFT",
      scheduledAt: body.scheduledAt,
      campaignId: null,
      imageHint: null,
      postedAt: null,
      externalPostId: null,
      metadata: {},
    };

    const post = await upsertSaasSocialPost(context, postData as any);

    if (body.scheduledAt) {
      return new Response(
        JSON.stringify({
          id: post.id,
          saasId: post.saasId,
          status: post.status,
          scheduledAt: body.scheduledAt,
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    const livePublish = await publishSocialPostLive(context, post.id);

    return new Response(
      JSON.stringify({
        id: post.id,
        saasId: post.saasId,
        status: post.status,
        livePublish,
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch (error) {
    if (error instanceof SocialContextError) {
      return new Response(
        JSON.stringify({
          code: "SOCIAL_DB_UNAVAILABLE",
          message: "SOCIAL_DB is not configured in the current local runtime.",
          details: {
            binding: "SOCIAL_DB",
            error: error.message,
          },
        }),
        { status: 503, headers: { "content-type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}
