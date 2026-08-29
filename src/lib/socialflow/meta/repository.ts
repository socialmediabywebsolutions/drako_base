import { listSaasSocialAccounts, resolveSocialContext, upsertSaasSocialAccount } from "@/lib/socialflow/repository";
import type { SaasSocialAccount } from "@/lib/social-core/types";
import { encryptToken } from "@/lib/socialflow/token-encryption";
import type { MetaInstagramAccount, MetaPage, MetaTokenResponse } from "@/lib/socialflow/meta/core";
import { triggerNicheInitializationOnFirstAccount } from "@/lib/socialflow/intelligence/nicheInitTrigger";

type PersistMetaConnectionInput = {
  tenantId: string;
  saasId: string;
  token: MetaTokenResponse;
  page: MetaPage;
  instagramAccount: MetaInstagramAccount | null;
};

export type PersistMetaConnectionResult = {
  accounts: SaasSocialAccount[];
  status: "persisted" | "updated";
};

function resolveTokenExpiresAt(expiresInSeconds: number | null | undefined): string | null {
  if (typeof expiresInSeconds !== "number" || !Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
    return null;
  }
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}

export async function persistSocialFlowMetaConnection(input: PersistMetaConnectionInput): Promise<PersistMetaConnectionResult> {
  const socialContext = await resolveSocialContext({ tenantId: input.tenantId, saasId: input.saasId });
  const existingAccounts = await listSaasSocialAccounts(socialContext);
  const existingFacebookAccount = existingAccounts.find((account) => account.provider === "FACEBOOK_PAGE");
  const existingInstagramAccount = existingAccounts.find((account) => account.provider === "INSTAGRAM");
  const status: PersistMetaConnectionResult["status"] = existingFacebookAccount || existingInstagramAccount ? "updated" : "persisted";

  const encryptedPageAccessToken = await encryptToken(input.page.access_token);
  const expiresAt = resolveTokenExpiresAt(input.token.expires_in);

  const facebookAccount = await upsertSaasSocialAccount(socialContext, {
    id: existingFacebookAccount?.id,
    saasId: input.saasId,
    provider: "FACEBOOK_PAGE",
    handle: input.page.id,
    displayName: input.page.name,
    status: "CONNECTED_REAL",
    authMeta: {
      mode: "live",
      provider: "FACEBOOK_PAGE",
      accessToken: encryptedPageAccessToken,
      pageId: input.page.id,
      pageName: input.page.name,
      tokenType: input.token.token_type ?? null,
      expiresIn: input.token.expires_in ?? null,
      expiresAt,
    },
    isPrimary: existingFacebookAccount?.isPrimary ?? false,
  });

  const accounts: SaasSocialAccount[] = [facebookAccount];

  if (input.instagramAccount) {
    const instagramAccount = await upsertSaasSocialAccount(socialContext, {
      id: existingInstagramAccount?.id,
      saasId: input.saasId,
      provider: "INSTAGRAM",
      handle: input.instagramAccount.username,
      displayName: input.instagramAccount.username,
      status: "CONNECTED_REAL",
      authMeta: {
        mode: "live",
        provider: "INSTAGRAM",
        accessToken: encryptedPageAccessToken,
        igUserId: input.instagramAccount.id,
        pageId: input.page.id,
        tokenType: input.token.token_type ?? null,
        expiresIn: input.token.expires_in ?? null,
        expiresAt,
      },
      isPrimary: existingInstagramAccount?.isPrimary ?? false,
    });
    accounts.push(instagramAccount);
  }

  // Primera cuenta social de cualquier proveedor — dispara el análisis de nicho ahora
  // en vez de esperar hasta 7 días al cron semanal. Fire-and-forget, nunca bloquea ni
  // rompe este callback.
  if (existingAccounts.length === 0) {
    triggerNicheInitializationOnFirstAccount(input.tenantId, input.saasId);
  }

  return { accounts, status };
}
