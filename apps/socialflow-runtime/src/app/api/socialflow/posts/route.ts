export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "../../../../lib/auth/session";
import { addRuntimeHeaders, getRuntimeCorrelationId, logRuntimeEvent } from "../../../../lib/runtime-observability";
import {
  approveRuntimePost,
  getRuntimePostById,
  listRuntimePosts,
  markRuntimePostAsPosted,
  publishRuntimePostLive,
  rejectRuntimePost,
  saveRuntimePost,
  scheduleRuntimePost,
  SocialContextError,
} from "../../../../lib/socialflow/posts-service";
import { listRuntimeSocialAccountsFromDb } from "../../../../lib/socialflow/posts-repository";
import { validateRuntimeLinkedInAccount } from "../../../../lib/socialflow/linkedin/publishing";
import { LinkedInIntegrationError } from "../../../../lib/socialflow/linkedin/core";
import { isEncryptedToken } from "../../../../lib/socialflow/token-encryption";
import { isRuntimeTenantAllowedInPrivatePilot } from "../../../../lib/socialflow/private-pilot";

const ALLOWED_PROVIDERS = ["LINKEDIN"] as const;
const ALLOWED_CREATION_STATUSES = ["DRAFT", "SCHEDULED"] as const;

function unauthorizedResponse(request?: Request, correlationId?: string) {
  return addRuntimeHeaders(NextResponse.json({ code: "UNAUTHORIZED", message: "SESSION_REQUIRED" }, { status: 401 }), {
    request,
    correlationId,
  });
}

function isLinkedInTokenStatePublishSafe(authMeta: Record<string, unknown> | null | undefined) {
  const accessToken = typeof authMeta?.accessToken === "string" ? authMeta.accessToken : null;
  const idToken = typeof authMeta?.idToken === "string" ? authMeta.idToken : null;
  if (!isEncryptedToken(accessToken)) return false;
  if (idToken && !isEncryptedToken(idToken)) return false;
  return true;
}

export async function GET(request: Request) {
  const correlationId = getRuntimeCorrelationId(request);
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    const campaignId = url.searchParams.get("campaignId");
    const status = url.searchParams.get("status");
    const provider = url.searchParams.get("provider");

    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }

    const session = await requireCurrentSocialFlowSession(request);
    const items = await listRuntimePosts({
      tenantId: session.tenantId,
      saasId,
      filters: {
        campaignId: campaignId ?? null,
        status: status && status !== "ALL" ? status : null,
        provider: provider && provider !== "ALL" ? (provider as (typeof ALLOWED_PROVIDERS)[number]) : null,
      },
    });

    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return unauthorizedResponse(request, correlationId);
    }
    logRuntimeEvent("error", "posts_list_failed", {
      correlationId,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ code: "SOCIALFLOW_ERROR", message: "Unable to load posts" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const correlationId = getRuntimeCorrelationId(request);
  try {
    const body = (await request.json().catch(() => null)) as {
      id?: string;
      saasId?: string | null;
      content?: string | null;
      campaignId?: string | null;
      channelId?: string | null;
      provider?: string;
      contentType?: string;
      title?: string;
      body?: string;
      imageHint?: string | null;
      status?: string;
      scheduledAt?: string | null;
      postedAt?: string | null;
      externalPostId?: string | null;
      metadata?: Record<string, unknown> | null;
      confirmPublish?: boolean | null;
    } | null;

    if (!body) {
      return NextResponse.json({ code: "INVALID_BODY", message: "Body is required" }, { status: 400 });
    }

    const saasId = body.saasId ?? null;
    const simplifiedContent = body.content?.trim() ?? "";
    const usingSimplifiedContract = Boolean(simplifiedContent);
    const provider = (body.provider ?? (usingSimplifiedContract ? "LINKEDIN" : null)) as string | null;
    const contentType = (body.contentType ?? (usingSimplifiedContract ? "FEED" : null)) as string | null;
    const title = body.title?.trim() || (usingSimplifiedContract ? simplifiedContent.slice(0, 72) : "");
    const postBody = body.body?.trim() || simplifiedContent;
    const scheduledAt = typeof body.scheduledAt === "undefined" ? null : body.scheduledAt;
    const creationStatus = body.status ?? (usingSimplifiedContract ? (scheduledAt ? "SCHEDULED" : "DRAFT") : null);

    if (!saasId || !provider || !contentType || !title || !postBody || !creationStatus) {
      return NextResponse.json({ code: "INVALID_BODY", message: "saasId, provider, contentType, title, body and status are required" }, { status: 400 });
    }

    if (!ALLOWED_PROVIDERS.includes(provider as (typeof ALLOWED_PROVIDERS)[number])) {
      return NextResponse.json({ code: "INVALID_PROVIDER", message: "provider is invalid" }, { status: 400 });
    }
    if (!ALLOWED_CREATION_STATUSES.includes(creationStatus as (typeof ALLOWED_CREATION_STATUSES)[number])) {
      return NextResponse.json({ code: "INVALID_STATUS", message: "status must be draft or scheduled" }, { status: 400 });
    }

    const session = await requireCurrentSocialFlowSession(request);
    const post = await saveRuntimePost({
      tenantId: session.tenantId,
      saasId,
      post: {
        id: body.id,
        campaignId: body.campaignId ?? null,
        channelId: body.channelId ?? null,
        provider: provider as (typeof ALLOWED_PROVIDERS)[number],
        contentType: "FEED",
        title,
        body: postBody,
        imageHint: body.imageHint ?? null,
        status: creationStatus,
        scheduledAt,
        postedAt: body.postedAt ?? null,
        externalPostId: body.externalPostId ?? null,
        metadata: body.metadata ?? null,
      },
    });

    if (post.tenantId !== session.tenantId || post.saasId !== saasId) {
      logRuntimeEvent("warn", "post_scope_mismatch_after_upsert", {
        correlationId,
        sessionTenantId: session.tenantId,
        requestSaasId: saasId,
      });
      return NextResponse.json({
        post,
        livePublish: {
          ok: false,
          code: "POST_SCOPE_MISMATCH",
          message: "Post scope mismatch detected. Publish was blocked.",
        },
      }, { status: 409 });
    }

    if (usingSimplifiedContract && !scheduledAt) {
      if (body.confirmPublish !== true) {
        return NextResponse.json({
          post,
          livePublish: {
            ok: false,
            code: "PUBLISH_CONFIRMATION_REQUIRED",
            message: "Post stored without live publish. Send confirmPublish=true to publish.",
            dryRun: true,
          },
        });
      }

      if (session.role !== "admin") {
        return NextResponse.json({
          post,
          livePublish: {
            ok: false,
            code: "PUBLISH_ROLE_NOT_AUTHORIZED",
            message: "Only admin role can execute confirmPublish=true.",
          },
        }, { status: 403 });
      }

      if (!isRuntimeTenantAllowedInPrivatePilot(session.tenantId)) {
        return NextResponse.json({
          post,
          livePublish: {
            ok: false,
            code: "PRIVATE_PILOT_TENANT_NOT_ALLOWED",
            message: "Tenant is not allowlisted for SocialFlow private pilot publishing.",
          },
        }, { status: 403 });
      }

      const socialAccounts = await listRuntimeSocialAccountsFromDb({
        tenantId: session.tenantId,
        saasId,
      });
      const primaryLinkedInAccount = socialAccounts
        .find((account) => account.provider === "LINKEDIN" && account.isPrimary)
        ?? socialAccounts.find((account) => account.provider === "LINKEDIN")
        ?? null;

      if (!primaryLinkedInAccount || primaryLinkedInAccount.status !== "CONNECTED_REAL") {
        return NextResponse.json({
          post,
          livePublish: {
            ok: false,
            code: "LINKEDIN_ACCOUNT_NOT_CONNECTED_REAL",
            message: "Primary LinkedIn account must be CONNECTED_REAL before live publish.",
          },
        }, { status: 409 });
      }

      if (primaryLinkedInAccount.tenantId !== session.tenantId || primaryLinkedInAccount.saasId !== saasId) {
        return NextResponse.json({
          post,
          livePublish: {
            ok: false,
            code: "LINKEDIN_ACCOUNT_SCOPE_MISMATCH",
            message: "LinkedIn account scope mismatch detected. Publish was blocked.",
          },
        }, { status: 409 });
      }

      const linkedInAuthMeta = (primaryLinkedInAccount.authMeta ?? {}) as Record<string, unknown>;
      const lastErrorCode = typeof linkedInAuthMeta.lastErrorCode === "string" ? linkedInAuthMeta.lastErrorCode.trim() : "";
      if (lastErrorCode) {
        return NextResponse.json({
          post,
          livePublish: {
            ok: false,
            code: "LINKEDIN_LAST_VALIDATION_ERROR",
            message: "LinkedIn account has unresolved validation error. Run validate-connection before publishing.",
          },
        }, { status: 409 });
      }

      if (!isLinkedInTokenStatePublishSafe(linkedInAuthMeta)) {
        return NextResponse.json({
          post,
          livePublish: {
            ok: false,
            code: "LINKEDIN_TOKENS_NOT_ENCRYPTED",
            message: "LinkedIn tokens are not in encrypted format required for publishing.",
          },
        }, { status: 409 });
      }

      try {
        await validateRuntimeLinkedInAccount(primaryLinkedInAccount);
      } catch (error) {
        if (error instanceof LinkedInIntegrationError) {
          return NextResponse.json({
            post,
            livePublish: {
              ok: false,
              code: error.code,
              message: "LinkedIn validation failed before live publish.",
            },
          }, { status: 409 });
        }
        throw error;
      }

      const liveResult = await publishRuntimePostLive({
        tenantId: session.tenantId,
        saasId,
        postId: post.id,
      });
      if (!liveResult.ok) {
        logRuntimeEvent("error", "live_publish_failed", {
          correlationId,
          code: liveResult.code ?? "LIVE_PUBLISH_FAILED",
          message: liveResult.message ?? "Live publish failed.",
          postId: post.id,
          saasId,
          tenantId: session.tenantId,
        });
        return NextResponse.json({
          post: liveResult.post ?? (await getRuntimePostById({ tenantId: session.tenantId, saasId, postId: post.id })) ?? post,
          livePublish: {
            ok: false,
            code: liveResult.code ?? "LIVE_PUBLISH_FAILED",
            message: liveResult.message ?? "Live publish failed.",
          },
        }, { status: 409 });
      }

      return NextResponse.json({
        post: liveResult.post ?? post,
        livePublish: {
          ok: true,
          code: liveResult.code ?? "PUBLISHED_LIVE_LINKEDIN",
          message: liveResult.message ?? "Post published live.",
          externalPostId: liveResult.externalPostId ?? null,
        },
      });
    }

    return NextResponse.json({ post });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return unauthorizedResponse(request, correlationId);
    }
    logRuntimeEvent("error", "posts_upsert_failed", {
      correlationId,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ code: "SOCIALFLOW_ERROR", message: "Unable to save post" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const correlationId = getRuntimeCorrelationId(request);
  try {
    const body = (await request.json().catch(() => null)) as {
      id?: string;
      saasId?: string | null;
      title?: string | null;
      body?: string | null;
      status?: string | null;
      scheduledAt?: string | null;
      postedAt?: string | null;
      externalPostId?: string | null;
      metadata?: Record<string, unknown> | null;
      action?: "approve" | "reject" | "schedule" | "mark_posted";
    } | null;

    if (!body?.id || !body.saasId) {
      return NextResponse.json({ code: "INVALID_BODY", message: "id and saasId are required" }, { status: 400 });
    }

    const session = await requireCurrentSocialFlowSession(request);

    if (body.action === "approve") {
      const post = await approveRuntimePost({ tenantId: session.tenantId, saasId: body.saasId, postId: body.id });
      return NextResponse.json({ post });
    }
    if (body.action === "reject") {
      const post = await rejectRuntimePost({ tenantId: session.tenantId, saasId: body.saasId, postId: body.id });
      return NextResponse.json({ post });
    }
    if (body.action === "schedule") {
      const post = await scheduleRuntimePost({
        tenantId: session.tenantId,
        saasId: body.saasId,
        postId: body.id,
        scheduledAt: body.scheduledAt ?? null,
      });
      return NextResponse.json({ post });
    }
    if (body.action === "mark_posted") {
      const post = await markRuntimePostAsPosted({
        tenantId: session.tenantId,
        saasId: body.saasId,
        postId: body.id,
        externalPostId: body.externalPostId ?? null,
        postedAt: body.postedAt ?? null,
      });
      return NextResponse.json({ post });
    }

    const current = (await listRuntimePosts({
      tenantId: session.tenantId,
      saasId: body.saasId,
      filters: { campaignId: null, status: null, provider: null },
    })).find((post) => post.id === body.id);

    if (!current) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Post not found" }, { status: 404 });
    }

    const post = await saveRuntimePost({
      tenantId: session.tenantId,
      saasId: body.saasId,
      post: {
        id: current.id,
        campaignId: current.campaignId,
        channelId: current.channelId ?? null,
        provider: current.provider as (typeof ALLOWED_PROVIDERS)[number],
        contentType: current.contentType,
        title: typeof body.title === "string" ? body.title : current.title,
        body: typeof body.body === "string" ? body.body : current.body,
        imageHint: current.imageHint,
        status: body.status ?? current.status,
        scheduledAt: typeof body.scheduledAt === "undefined" ? current.scheduledAt : body.scheduledAt,
        postedAt: typeof body.postedAt === "undefined" ? current.postedAt : body.postedAt,
        externalPostId: typeof body.externalPostId === "undefined" ? current.externalPostId : body.externalPostId,
        metadata: typeof body.metadata === "undefined" ? current.metadata : body.metadata,
      },
    });

    return NextResponse.json({ post });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return unauthorizedResponse(request, correlationId);
    }
    logRuntimeEvent("error", "posts_patch_failed", {
      correlationId,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ code: "SOCIALFLOW_ERROR", message: "Unable to update post" }, { status: 500 });
  }
}
