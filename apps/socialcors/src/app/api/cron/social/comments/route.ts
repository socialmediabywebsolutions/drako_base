export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { CronAuthError, verifyCronAuth } from "@/lib/security/cron-auth";
import { guardCronTurn } from "@/lib/security/cron-lock";
import { env } from "@/lib/cf";
import { resolveSocialContext, listSaasSocialAccounts } from "@/lib/socialflow/repository";
import { requireInstagramCredentials } from "@/lib/socialflow/meta/publishing";
import { fetchInstagramRecentMedia } from "@/lib/socialflow/meta/core";
import { fetchInstagramComments, replyToInstagramComment } from "@/lib/socialflow/meta/comments";
import type { InstagramComment } from "@/lib/socialflow/meta/comments";
import { sendInstagramPrivateReply } from "@/lib/socialflow/meta/privateReplies";
import { analyzeSentiment, reconcileLeadSignals, type SentimentResult } from "@/lib/socialflow/conversational/sentiment";
import { generateConversationalReply } from "@/lib/socialflow/conversational/engine";
import { isWithinActiveHours, getOutsideHoursMessage } from "@/lib/socialflow/conversational/active-hours";
import {
  resolveSocialContext as resolveConvContext,
  ingestConversationThread,
  getConversationSettings,
  updateConversationThread,
  threadExistsByPlatformId,
} from "@/lib/socialflow/conversational/repository";
import { getChannelKnowledge } from "@/lib/socialflow/profile/repository";
import { getKnowledgeContext } from "@/lib/socialflow/knowledge/repository";
import { detectLeadSignals } from "@/lib/socialflow/leads/detector";
import { createLead } from "@/lib/socialflow/leads/repository";
import { notifyTenantOfNewLead } from "@/lib/socialflow/leads/notify";
import { listKeywordDmTriggers, hasKeywordDmLogEntry, recordKeywordDmLog } from "@/lib/socialflow/keyword-dm/repository";
import { pickMatchingTrigger } from "@/lib/socialflow/keyword-dm/matcher";
import type { KeywordDmTrigger } from "@/lib/socialflow/keyword-dm/types";
import type { SocialContext } from "@/lib/socialflow/repository";
import type { SaasSocialAccount } from "@/lib/social-core/types";

type AccountRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  provider: string;
  handle: string | null;
  display_name: string | null;
  status: string;
  auth_meta: string | null;
  is_primary: number;
  created_at: string;
  updated_at: string;
};

type CommentResult = {
  commentId: string;
  status: "SENT" | "AUTO_APPROVED" | "NEEDS_HUMAN" | "SKIPPED" | "ERROR";
  sentiment?: string;
  reason?: string;
};

type TenantResult = {
  tenantId: string;
  saasId: string;
  postsScanned: number;
  commentsProcessed: CommentResult[];
  error?: string;
};

function parseAuthMeta(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function rowToAccount(row: AccountRow): SaasSocialAccount {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    provider: row.provider as SaasSocialAccount["provider"],
    handle: row.handle,
    displayName: row.display_name,
    status: row.status as SaasSocialAccount["status"],
    authMeta: parseAuthMeta(row.auth_meta),
    isPrimary: row.is_primary === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Mismo patrón que inbound/route.ts para DMs — se ejecuta sobre todo comentario
// ingresado, sin importar la rama de sentimiento/envío que haya tomado, para que
// "Oportunidades" reciba leads de comentarios igual que ya recibe de DMs.
async function maybeCreateLead(
  convCtx: SocialContext,
  threadId: string,
  comment: { text: string; username: string },
  sentiment: SentimentResult,
): Promise<void> {
  const leadSignals = reconcileLeadSignals(sentiment, detectLeadSignals(comment.text));
  if (!leadSignals.isLead || !leadSignals.temperature) return;
  try {
    await createLead(convCtx, {
      threadId,
      provider: "INSTAGRAM",
      senderName: comment.username,
      senderHandle: comment.username,
      incomingMessage: comment.text,
      intentScore: leadSignals.intentScore,
      temperature: leadSignals.temperature,
    });
    // Best-effort pero SÍ esperado (no fire-and-forget): un fetch sin await puede
    // cortarse cuando el Worker devuelve la respuesta HTTP antes de que termine. El
    // lead ya está persistido arriba, así que un email fallido nunca lo revierte ni
    // bloquea el resto del loop — notifyTenantOfNewLead nunca lanza.
    await notifyTenantOfNewLead({
      tenantId: convCtx.tenantId,
      saasId: convCtx.saasId ?? "socialflow",
      temperature: leadSignals.temperature,
      incomingMessage: comment.text,
      intentScore: leadSignals.intentScore,
    });
  } catch (err) {
    console.warn("[cron/comments] lead create failed", err instanceof Error ? err.message : String(err));
  }
}

// Independiente del pipeline de sentiment/NEEDS_HUMAN: opera sobre el mismo array
// `comments` que ya trajo el único fetchInstagramComments del post (no hace una segunda
// llamada), con su propio gate de dedup (socialflow_keyword_dm_log, no
// threadExistsByPlatformId) y su propio try/catch por comentario — un fallo aquí nunca
// aborta el post ni bloquea el loop de sentiment que corre después, y un match aquí
// tampoco impide que el mismo comentario siga su flujo normal de moderación/respuesta
// pública (son dos escrituras a tablas distintas, sin dependencia entre sí).
async function processKeywordDmTriggers(
  convCtx: SocialContext,
  postId: string,
  comments: InstagramComment[],
  triggers: KeywordDmTrigger[],
  creds: { accessToken: string; igUserId: string },
): Promise<void> {
  for (const comment of comments) {
    try {
      const alreadyLogged = await hasKeywordDmLogEntry(convCtx, comment.id);
      if (alreadyLogged) continue;

      const trigger = pickMatchingTrigger(triggers, comment.text, postId);
      if (!trigger) continue;

      const sendResult = await sendInstagramPrivateReply(creds.igUserId, creds.accessToken, comment.id, trigger.dmMessage);
      await recordKeywordDmLog(convCtx, {
        triggerId: trigger.id,
        platformCommentId: comment.id,
        commenterUsername: comment.username,
        status: sendResult.success ? "SENT" : "FAILED",
        errorMessage: sendResult.success ? null : (sendResult.error ?? "unknown error"),
      });
    } catch (err) {
      console.error("[cron/comments] keyword-dm failed", comment.id, err instanceof Error ? err.message : String(err));
    }
  }
}

async function processTenantComments(
  tenantId: string,
  saasId: string,
  account: SaasSocialAccount,
): Promise<TenantResult> {
  const result: TenantResult = { tenantId, saasId, postsScanned: 0, commentsProcessed: [] };

  let creds: Awaited<ReturnType<typeof requireInstagramCredentials>>;
  try {
    creds = await requireInstagramCredentials(account);
  } catch (err) {
    result.error = `credentials: ${err instanceof Error ? err.message : String(err)}`;
    return result;
  }

  // Fetch recent posts
  let recentMedia: Awaited<ReturnType<typeof fetchInstagramRecentMedia>>;
  try {
    recentMedia = await fetchInstagramRecentMedia(creds.accessToken, creds.igUserId, creds.apiBase);
  } catch (err) {
    result.error = `media fetch: ${err instanceof Error ? err.message : String(err)}`;
    return result;
  }

  // comments_count del campo de /media no es fiable mientras la app esté en modo
  // desarrollo/Evaluadores de Meta (App Review pendiente) — puede reportar 0 aunque el
  // post tenga comentarios reales y visibles de una cuenta Evaluadora. En vez de
  // pre-filtrar por ese campo, se consultan directamente los 5 posts más recientes vía
  // /comments — un post sin comentarios reales simplemente no itera nada más abajo
  // (fetched.comments vacío), mismo resultado que saltarlo, pero decidido por la
  // respuesta real de Meta. Mismo tope de 5 que antes para no aumentar rate-limit.
  const postsWithComments = recentMedia.slice(0, 5);
  result.postsScanned = recentMedia.length;

  if (!postsWithComments.length) return result;

  // Load tenant context once
  const convCtx = await resolveConvContext({ tenantId, saasId });
  const [knowledge, settings, knowledgeContext, activeKeywordTriggers] = await Promise.all([
    getChannelKnowledge(tenantId, saasId).catch(() => null),
    getConversationSettings(convCtx),
    getKnowledgeContext(tenantId, saasId).catch(() => ""),
    listKeywordDmTriggers(convCtx, { activeOnly: true }).catch(() => []),
  ]);

  for (const post of postsWithComments) {
    const fetched = await fetchInstagramComments(post.id, creds.accessToken, creds.apiBase);
    if (!fetched.ok) continue;

    if (activeKeywordTriggers.length) {
      await processKeywordDmTriggers(convCtx, post.id, fetched.comments, activeKeywordTriggers, creds);
    }

    for (const comment of fetched.comments) {
      // Skip already-processed comments
      const alreadySeen = await threadExistsByPlatformId(convCtx, comment.id);
      if (alreadySeen) {
        result.commentsProcessed.push({ commentId: comment.id, status: "SKIPPED" });
        continue;
      }

      // Sentiment analysis
      const sentiment = await analyzeSentiment(
        comment.text,
        knowledgeContext,
        tenantId,
        saasId,
      ).catch(() => ({
        sentiment: "neutral" as const,
        confidence: 0.5,
        shouldAutoReply: false,
        reason: "Sentiment analysis failed",
      }));

      if (!sentiment.shouldAutoReply) {
        // Save as NEEDS_HUMAN — no reply generated
        const thread = await ingestConversationThread(convCtx, {
          provider: "INSTAGRAM",
          threadType: "COMMENT",
          platformThreadId: comment.id,
          senderName: comment.username,
          senderHandle: comment.username,
          incomingMessage: comment.text,
          contextPostId: post.id,
          suggestedReply: null,
          status: "NEEDS_HUMAN",
          aiMetadata: { sentiment: sentiment.sentiment, confidence: sentiment.confidence, reason: sentiment.reason },
        });
        await maybeCreateLead(convCtx, thread.id, comment, sentiment);
        result.commentsProcessed.push({
          commentId: comment.id,
          status: "NEEDS_HUMAN",
          sentiment: sentiment.sentiment,
          reason: sentiment.reason,
        });
        continue;
      }

      // Generate AI reply
      let suggestedReply = "";
      let aiMetadata: Record<string, unknown> = {};
      if (knowledge) {
        try {
          const reply = await generateConversationalReply({
            incomingMessage: comment.text,
            threadType: "COMMENT",
            provider: "INSTAGRAM",
            senderName: comment.username,
            profile: knowledge.profile,
            knowledge,
            knowledgeContext,
            tenantId,
            saasId,
          });
          suggestedReply = reply.suggestedReply;
          aiMetadata = { ...reply.aiMetadata, sentiment: sentiment.sentiment, confidence: sentiment.confidence };
        } catch {
          suggestedReply = "";
        }
      }

      if (!suggestedReply) {
        // Reply generation failed — escalate to human
        const thread = await ingestConversationThread(convCtx, {
          provider: "INSTAGRAM",
          threadType: "COMMENT",
          platformThreadId: comment.id,
          senderName: comment.username,
          senderHandle: comment.username,
          incomingMessage: comment.text,
          contextPostId: post.id,
          suggestedReply: null,
          status: "NEEDS_HUMAN",
          aiMetadata: { ...aiMetadata, errorReason: "reply_generation_failed" },
        });
        await maybeCreateLead(convCtx, thread.id, comment, sentiment);
        result.commentsProcessed.push({ commentId: comment.id, status: "NEEDS_HUMAN", sentiment: sentiment.sentiment });
        continue;
      }

      // Decide: send now or queue as AUTO_APPROVED — el auto-envío solo aplica dentro
      // del horario configurado (active-hours.ts, paso 3 del Agente de Comunidad).
      // Fuera de horario: si el tenant configuró un mensaje, se envía ESE en vez de la
      // respuesta IA (el aiMetadata queda marcado outsideActiveHours para diferenciarlo
      // en el inbox); si no hay mensaje configurado, cae al mismo camino que auto-envío
      // desactivado — se guarda en cola AUTO_APPROVED, suggestedReply intacto para
      // aprobación manual. settings.activeHoursJson NULL (sin configurar) hace que
      // isWithinActiveHours siempre devuelva true, así que este bloque es un no-op
      // exacto del comportamiento anterior para cualquier tenant que no lo configure.
      const autoSendConfigured = settings.autoSendEnabled && settings.autoSendProviders.includes("INSTAGRAM");
      const withinActiveHours = isWithinActiveHours(settings.activeHoursJson);
      const outsideHoursMessage = withinActiveHours ? null : getOutsideHoursMessage(settings.activeHoursJson);
      const messageToSend = withinActiveHours ? suggestedReply : outsideHoursMessage;
      const shouldSend = autoSendConfigured && messageToSend !== null;
      const aiMetadataWithHours = withinActiveHours ? aiMetadata : { ...aiMetadata, outsideActiveHours: true };

      if (shouldSend) {
        const replyResult = await replyToInstagramComment(comment.id, messageToSend!, creds.accessToken, creds.apiBase);
        const thread = await ingestConversationThread(convCtx, {
          provider: "INSTAGRAM",
          threadType: "COMMENT",
          platformThreadId: comment.id,
          senderName: comment.username,
          senderHandle: comment.username,
          incomingMessage: comment.text,
          contextPostId: post.id,
          suggestedReply,
          status: replyResult.ok ? "SENT" : "AUTO_APPROVED",
          aiMetadata: aiMetadataWithHours,
        });
        if (replyResult.ok) {
          await updateConversationThread(convCtx, thread.id, { status: "SENT", finalReply: messageToSend });
        }
        await maybeCreateLead(convCtx, thread.id, comment, sentiment);
        result.commentsProcessed.push({
          commentId: comment.id,
          status: replyResult.ok ? "SENT" : "AUTO_APPROVED",
          sentiment: sentiment.sentiment,
        });
      } else {
        const thread = await ingestConversationThread(convCtx, {
          provider: "INSTAGRAM",
          threadType: "COMMENT",
          platformThreadId: comment.id,
          senderName: comment.username,
          senderHandle: comment.username,
          incomingMessage: comment.text,
          contextPostId: post.id,
          suggestedReply,
          status: "AUTO_APPROVED",
          aiMetadata: aiMetadataWithHours,
        });
        await maybeCreateLead(convCtx, thread.id, comment, sentiment);
        result.commentsProcessed.push({ commentId: comment.id, status: "AUTO_APPROVED", sentiment: sentiment.sentiment });
      }
    }
  }

  return result;
}

export async function GET(request: NextRequest) {
  try {
    verifyCronAuth(request);
  } catch (error) {
    if (error instanceof CronAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locked = await guardCronTurn(request, "comments", 5);
  if (locked) return locked;

  const bindings = env();
  const socialDb = bindings?.SOCIAL_DB;
  if (!socialDb) {
    return NextResponse.json({ ok: false, code: "SOCIAL_DB_UNAVAILABLE" }, { status: 503 });
  }

  // Query all connected Instagram accounts across all tenants
  let accountRows: AccountRow[];
  try {
    const result = await socialDb
      .prepare(
        `SELECT id, tenant_id, saas_id, provider, handle, display_name, status, auth_meta, is_primary, created_at, updated_at
         FROM saas_social_accounts
         WHERE provider = 'INSTAGRAM' AND status != 'DISCONNECTED'
         ORDER BY updated_at DESC
         LIMIT 50`,
      )
      .all<AccountRow>();
    accountRows = result.results ?? [];
  } catch (err) {
    console.error("[cron/comments] DB query failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, code: "DB_QUERY_FAILED" }, { status: 500 });
  }

  if (!accountRows.length) {
    return NextResponse.json({ ok: true, message: "No Instagram accounts to process", results: [] });
  }

  const results: TenantResult[] = [];

  for (const row of accountRows) {
    const account = rowToAccount(row);
    const ctx = await resolveSocialContext({ tenantId: row.tenant_id, saasId: row.saas_id });
    const accounts = await listSaasSocialAccounts(ctx);
    const instagramAccount = accounts.find((a) => a.id === account.id) ?? account;

    try {
      const tenantResult = await processTenantComments(row.tenant_id, row.saas_id, instagramAccount);
      results.push(tenantResult);
    } catch (err) {
      results.push({
        tenantId: row.tenant_id,
        saasId: row.saas_id,
        postsScanned: 0,
        commentsProcessed: [],
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const totalComments = results.reduce((sum, r) => sum + r.commentsProcessed.length, 0);
  const sent = results.flatMap((r) => r.commentsProcessed).filter((c) => c.status === "SENT").length;
  const queued = results.flatMap((r) => r.commentsProcessed).filter((c) => c.status === "AUTO_APPROVED").length;
  const needsHuman = results.flatMap((r) => r.commentsProcessed).filter((c) => c.status === "NEEDS_HUMAN").length;

  console.log(`[cron/comments] ${accountRows.length} accounts | ${totalComments} comments | sent=${sent} queued=${queued} needs_human=${needsHuman}`);

  return NextResponse.json({
    ok: true,
    accounts: accountRows.length,
    totalComments,
    sent,
    queued,
    needsHuman,
    results,
  });
}
