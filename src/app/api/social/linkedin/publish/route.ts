import { publishLinkedInMemberPost, LinkedInIntegrationError } from "@/lib/social/linkedin";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || !body.content) {
    return new Response(
      JSON.stringify({
        ok: false,
        code: "LINKEDIN_PUBLISH_CONTENT_REQUIRED",
        message: "content is required",
      }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  try {
    const result = await publishLinkedInMemberPost({
      content: body.content,
      accessToken: body.accessToken,
      authorUrn: body.authorUrn,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        linkedinStatus: result.linkedinStatus,
        externalPostId: result.externalPostId,
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch (error) {
    if (error instanceof LinkedInIntegrationError) {
      const statusMap: Record<string, number> = {
        LINKEDIN_PUBLISH_FORBIDDEN: 403,
        LINKEDIN_PUBLISH_UNAUTHORIZED: 401,
        LINKEDIN_PUBLISH_RATE_LIMITED: 429,
      };

      const status = statusMap[error.code] || 500;

      return new Response(
        JSON.stringify({
          ok: false,
          code: error.code,
          message: error.message,
          details: error.details || {},
        }),
        { status, headers: { "content-type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        ok: false,
        code: "LINKEDIN_PUBLISH_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}
