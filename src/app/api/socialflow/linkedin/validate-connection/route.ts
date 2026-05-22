export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { LinkedInIntegrationError } from "@/lib/socialflow/linkedin/core";
import { validateAccount } from "@/lib/socialflow/linkedin/publishing";
import { isEncryptedToken } from "@/lib/socialflow/token-encryption";
import {
  listSaasSocialAccounts,
  resolveSocialContext,
  SocialContextError,
  upsertSaasSocialAccount,
} from "@/lib/socialflow/repository";
import type { SaasSocialAccount } from "@/lib/social-core/types";
import type { SocialContext } from "@/lib/socialflow/repository";

type ValidateRequestBody = {
  saasId?: string | null;
};

type LinkedInAuthMeta = {
  accessToken?: string;
  profileId?: string;
  linkedInSub?: string;
  lastValidationAt?: string;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  [key: string]: unknown;
};

function getLinkedInAccount(accounts: SaasSocialAccount[]): SaasSocialAccount | null {
  const primary = accounts.find((account) => account.provider === "LINKEDIN" && account.isPrimary);
  if (primary) return primary;
  return accounts.find((account) => account.provider === "LINKEDIN") ?? null;
}

function resolveStoredProfileId(meta: LinkedInAuthMeta): string | null {
  if (typeof meta.profileId === "string" && meta.profileId.trim()) return meta.profileId.trim();
  if (typeof meta.linkedInSub === "string" && meta.linkedInSub.trim()) return meta.linkedInSub.trim();
  return null;
}

async function persistValidationPatch(input: {
  context: SocialContext;
  account: SaasSocialAccount;
  status: SaasSocialAccount["status"];
  validatedAt?: string;
  errorCode?: string | null;
}) {
  const authMeta = (input.account.authMeta ?? {}) as LinkedInAuthMeta;
  await upsertSaasSocialAccount(input.context, {
    id: input.account.id,
    saasId: input.account.saasId,
    provider: input.account.provider,
    handle: input.account.handle,
    displayName: input.account.displayName,
    status: input.status,
    isPrimary: input.account.isPrimary,
    authMeta: {
      ...authMeta,
      ...(typeof input.validatedAt === "string" ? { lastValidationAt: input.validatedAt } : {}),
      lastErrorCode: input.errorCode ?? null,
      lastErrorMessage: input.errorCode ? "LINKEDIN_VALIDATION_FAILED" : null,
    },
  });
}

export async function POST(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const body = (await request.json().catch(() => null)) as ValidateRequestBody | null;
    const saasId = body?.saasId?.trim() ?? "";
    if (!saasId) {
      return NextResponse.json({ ok: false, error: "INVALID_INPUT", message: "saasId is required." }, { status: 400 });
    }

    const context = await resolveSocialContext({
      tenantId: session.tenantId,
      saasId,
    });
    const account = getLinkedInAccount(await listSaasSocialAccounts(context));
    if (!account) {
      return NextResponse.json({ ok: false, error: "LINKEDIN_ACCOUNT_NOT_FOUND" }, { status: 404 });
    }
    if (account.status !== "CONNECTED_REAL") {
      return NextResponse.json({
        ok: false,
        error: "LINKEDIN_ACCOUNT_NOT_CONNECTED_REAL",
        status: account.status,
      }, { status: 409 });
    }

    const authMeta = (account.authMeta ?? {}) as LinkedInAuthMeta;
    const tokenEncrypted = isEncryptedToken(
      typeof authMeta.accessToken === "string" ? authMeta.accessToken : null,
    );

    try {
      const validation = await validateAccount(account);
      const validatedAt = new Date().toISOString();
      const storedProfileId = resolveStoredProfileId(authMeta);
      const profileMatch = storedProfileId ? storedProfileId === validation.profileId : true;
      await persistValidationPatch({
        context,
        account,
        status: "CONNECTED_REAL",
        validatedAt,
        errorCode: null,
      });

      return NextResponse.json({
        ok: true,
        provider: "LINKEDIN",
        status: "CONNECTED_REAL",
        tokenEncrypted,
        validatedAt,
        profileMatch,
      });
    } catch (error) {
      if (error instanceof LinkedInIntegrationError) {
        const nextStatus = error.accountStatus === "INVALID_CREDENTIALS" ? "INVALID_CREDENTIALS" : account.status;
        await persistValidationPatch({
          context,
          account,
          status: nextStatus,
          errorCode: error.code,
        });
        return NextResponse.json({
          ok: false,
          error: "LINKEDIN_VALIDATION_FAILED",
          code: error.code,
          provider: "LINKEDIN",
          status: nextStatus,
          tokenEncrypted,
        }, { status: 502 });
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 401 });
    }
    if (error instanceof SocialContextError) {
      return NextResponse.json({ ok: false, error: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "LINKEDIN_VALIDATE_CONNECTION_FAILED" }, { status: 500 });
  }
}
