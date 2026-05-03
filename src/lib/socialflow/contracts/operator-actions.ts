import { recordObservabilityActivity } from "@/lib/observability-core";
import {
  listSaasSocialPosts,
  resolveSocialContext,
  schedulePost,
} from "@/lib/socialflow/repository";
import type { SaasSocialPost } from "@/lib/social-core/types";

export type SocialFlowOperatorAction =
  | "recover_stale_publishing"
  | "retry_failed_posts";

export type SocialFlowOperatorActionPostResult = {
  id: string;
  title: string;
  previousStatus: SaasSocialPost["status"];
  nextStatus: SaasSocialPost["status"] | null;
  ok: boolean;
  reason: string | null;
};

export type SocialFlowOperatorActionResult = {
  action: SocialFlowOperatorAction;
  tenantId: string;
  saasId: string;
  scanned: number;
  affected: number;
  skipped: number;
  items: SocialFlowOperatorActionPostResult[];
  message: string;
};

const STALE_PUBLISHING_MINUTES = 15;
const MAX_OPERATOR_ACTION_POSTS = 20;

function isStalePublishing(post: SaasSocialPost, now: number): boolean {
  if (post.status !== "PUBLISHING") return false;
  const updatedAt = Date.parse(post.updatedAt);
  if (Number.isNaN(updatedAt)) return false;
  return updatedAt < now - STALE_PUBLISHING_MINUTES * 60 * 1000;
}

function canRetryFailedPost(post: SaasSocialPost): boolean {
  return post.status === "FAILED" && !post.externalPostId;
}

async function recordOperatorAction(result: SocialFlowOperatorActionResult) {
  await recordObservabilityActivity({
    tenantId: result.tenantId,
    saasId: result.saasId,
    sourceType: "automation",
    sourceKey: `socialflow:${result.action}`,
    activityType: result.action,
    status: result.affected > 0 ? "success" : "info",
    summary: result.message,
    metadata: {
      scanned: result.scanned,
      affected: result.affected,
      skipped: result.skipped,
      items: result.items.map((item) => ({
        id: item.id,
        ok: item.ok,
        previousStatus: item.previousStatus,
        nextStatus: item.nextStatus,
        reason: item.reason,
      })),
    },
  }).catch(() => null);
}

function buildMessage(action: SocialFlowOperatorAction, affected: number, skipped: number): string {
  if (action === "recover_stale_publishing") {
    return affected > 0
      ? `Recovered ${affected} stale PUBLISHING post(s).`
      : `No stale PUBLISHING posts needed recovery.${skipped > 0 ? ` Skipped ${skipped}.` : ""}`;
  }

  return affected > 0
    ? `Queued ${affected} failed post(s) for retry.`
    : `No failed posts were eligible for retry.${skipped > 0 ? ` Skipped ${skipped}.` : ""}`;
}

export async function runSocialFlowOperatorAction(input: {
  action: SocialFlowOperatorAction;
  tenantId: string;
  saasId: string;
}): Promise<SocialFlowOperatorActionResult> {
  const tenantId = input.tenantId.trim();
  const saasId = input.saasId.trim();
  if (!tenantId) throw new Error("SOCIALFLOW_OPERATOR_ACTION_TENANT_REQUIRED");
  if (!saasId) throw new Error("SOCIALFLOW_OPERATOR_ACTION_SAAS_REQUIRED");

  const ctx = await resolveSocialContext({ tenantId, saasId });
  const now = Date.now();
  const status = input.action === "recover_stale_publishing" ? "PUBLISHING" : "FAILED";
  const posts = await listSaasSocialPosts(ctx, { status });
  const candidates = posts.slice(0, MAX_OPERATOR_ACTION_POSTS);
  const results: SocialFlowOperatorActionPostResult[] = [];

  for (const post of candidates) {
    const eligible = input.action === "recover_stale_publishing"
      ? isStalePublishing(post, now) && !post.externalPostId
      : canRetryFailedPost(post);

    if (!eligible) {
      results.push({
        id: post.id,
        title: post.title,
        previousStatus: post.status,
        nextStatus: null,
        ok: false,
        reason: post.externalPostId ? "EXTERNAL_POST_ID_PRESENT" : "NOT_ELIGIBLE",
      });
      continue;
    }

    const updated = await schedulePost(ctx, {
      id: post.id,
      scheduledAt: post.scheduledAt ?? new Date(now).toISOString(),
    });

    results.push({
      id: post.id,
      title: post.title,
      previousStatus: post.status,
      nextStatus: updated?.status ?? null,
      ok: updated?.status === "SCHEDULED",
      reason: updated?.status === "SCHEDULED" ? null : "UPDATE_FAILED",
    });
  }

  const affected = results.filter((item) => item.ok).length;
  const skipped = results.length - affected;
  const result: SocialFlowOperatorActionResult = {
    action: input.action,
    tenantId,
    saasId,
    scanned: posts.length,
    affected,
    skipped,
    items: results,
    message: buildMessage(input.action, affected, skipped),
  };

  await recordOperatorAction(result);
  return result;
}
