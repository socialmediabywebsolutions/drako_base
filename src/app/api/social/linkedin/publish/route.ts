export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import {
  LinkedInIntegrationError,
  publishLinkedInMemberPost,
} from "@/lib/social/linkedin";

type PublishBody = {
  content?: unknown;
  accessToken?: unknown;
  authorUrn?: unknown;
};

function normalizeInput(body: PublishBody | null) {
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  const accessToken = typeof body?.accessToken === "string" ? body.accessToken.trim() : "";
  const authorUrn = typeof body?.authorUrn === "string" ? body.authorUrn.trim() : "";

  if (!content) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          ok: false,
          code: "LINKEDIN_PUBLISH_CONTENT_REQUIRED",
          message: "content is required.",
        },
        { status: 400 },
      ),
    };
  }

  if (!accessToken) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          ok: false,
          code: "LINKEDIN_ACCESS_TOKEN_MISSING",
          message: "accessToken is required.",
        },
        { status: 400 },
      ),
    };
  }

  if (!authorUrn) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          ok: false,
          code: "LINKEDIN_AUTHOR_URN_MISSING",
          message: "authorUrn is required.",
        },
        { status: 400 },
      ),
    };
  }

  return {
    ok: true as const,
    input: {
      content,
      accessToken,
      authorUrn,
    },
  };
}

function normalizePublishError(error: unknown) {
  if (error instanceof LinkedInIntegrationError) {
    const status =
      error.code === "LINKEDIN_PUBLISH_TOKEN_INVALID"
        ? 401
        : error.code === "LINKEDIN_PUBLISH_FORBIDDEN"
          ? 403
          : error.code === "LINKEDIN_PUBLISH_INVALID_REQUEST"
            ? 400
            : 502;

    return {
      status,
      body: {
        ok: false,
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };
  }

  return {
    status: 500,
    body: {
      ok: false,
      code: "LINKEDIN_PUBLISH_UNEXPECTED_ERROR",
      message: error instanceof Error ? error.message : "Unexpected LinkedIn publish error.",
      details: null,
    },
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as PublishBody | null;
  const normalizedInput = normalizeInput(body);
  if (!normalizedInput.ok) {
    return normalizedInput.response;
  }

  try {
    const result = await publishLinkedInMemberPost(normalizedInput.input);
    return NextResponse.json({
      ok: true,
      linkedinStatus: result.linkedinStatus,
      externalPostId: result.externalPostId,
      body: result.body,
    });
  } catch (error) {
    const normalizedError = normalizePublishError(error);
    return NextResponse.json(normalizedError.body, { status: normalizedError.status });
  }
}
