// Persiste una cuenta de Threads en saas_social_accounts después de completar el OAuth.
// auth_meta JSON schema:
//   accessToken: string (encrypted:v1:aes-gcm:...)
//   userId: string        — Threads user ID
//   username: string
//   scope: string         — scopes concedidos
//   expiresAt: string     — ISO timestamp de expiración del long-lived token

import { listSaasSocialAccounts, resolveSocialContext, upsertSaasSocialAccount } from "@/lib/socialflow/repository";
import type { SaasSocialAccount } from "@/lib/social-core/types";
import { encryptToken } from "@/lib/socialflow/token-encryption";
import { triggerNicheInitializationOnFirstAccount } from "@/lib/socialflow/intelligence/nicheInitTrigger";
import type { ThreadsLongLivedTokenResponse, ThreadsUserProfile } from "@/lib/socialflow/threads/types";

export type PersistThreadsConnectionInput = {
  tenantId: string;
  saasId: string;
  token: ThreadsLongLivedTokenResponse;
  profile: ThreadsUserProfile;
  grantedScope: string;
};

export type PersistThreadsConnectionResult = {
  account: SaasSocialAccount;
  status: "persisted" | "updated";
};

export async function persistSocialFlowThreadsConnection(
  input: PersistThreadsConnectionInput,
): Promise<PersistThreadsConnectionResult> {
  const socialContext = await resolveSocialContext({
    tenantId: input.tenantId,
    saasId: input.saasId,
  });

  const encryptedAccessToken = await encryptToken(input.token.access_token);

  // Calcular expiresAt: ahora + expires_in segundos
  const expiresAt = new Date(
    Date.now() + (input.token.expires_in ?? 5184000) * 1000,
  ).toISOString();

  const existingAccounts = await listSaasSocialAccounts(socialContext);
  const existingThreads = existingAccounts.filter((a) => a.provider === "THREADS");
  const isFirstAccount = existingAccounts.length === 0;

  // Si ya existe una cuenta de Threads para este userId, actualizarla (rota el token)
  const existing = existingThreads.find(
    (a) => (a.authMeta as Record<string, unknown> | null)?.userId === input.profile.id,
  );

  const authMeta = {
    accessToken: encryptedAccessToken,
    userId: input.profile.id,
    username: input.profile.username,
    scope: input.grantedScope,
    expiresAt,
  };

  const account = await upsertSaasSocialAccount(socialContext, {
    id: existing?.id,
    saasId: input.saasId,
    provider: "THREADS",
    handle: `@${input.profile.username}`,
    displayName: input.profile.name ?? input.profile.username,
    status: "CONNECTED_REAL",
    authMeta: authMeta as unknown as Record<string, unknown>,
    isPrimary: existingThreads.length === 0, // primera cuenta Threads → primary
  });

  const resultStatus: "persisted" | "updated" = existing ? "updated" : "persisted";

  if (isFirstAccount) {
    try {
      await triggerNicheInitializationOnFirstAccount({
        tenantId: input.tenantId,
        saasId: input.saasId,
      });
    } catch (err) {
      console.warn("THREADS_NICHE_INIT_FAILED", err instanceof Error ? err.message : err);
    }
  }

  return { account, status: resultStatus };
}

// Devuelve las credenciales de una cuenta de Threads para publicar.
export async function requireThreadsCredentials(account: SaasSocialAccount): Promise<{
  accessToken: string;
  userId: string;
  username: string;
}> {
  const meta = account.authMeta as Record<string, unknown> | null;
  if (!meta) {
    throw new Error("THREADS_AUTH_META_MISSING: No auth_meta for Threads account");
  }

  const rawToken = meta.accessToken as string | undefined;
  if (!rawToken) {
    throw new Error("THREADS_ACCESS_TOKEN_MISSING");
  }

  // Decrypt if encrypted (encryptToken stores as "encrypted:v1:aes-gcm:...")
  const { decryptToken } = await import("@/lib/socialflow/token-encryption");
  const accessToken = rawToken.startsWith("encrypted:") ? await decryptToken(rawToken) : rawToken;
  if (!accessToken) {
    throw new Error("THREADS_ACCESS_TOKEN_DECRYPTION_FAILED");
  }

  const userId = meta.userId as string | undefined;
  if (!userId) {
    throw new Error("THREADS_USER_ID_MISSING");
  }

  return {
    accessToken,
    userId,
    username: (meta.username as string | undefined) ?? account.handle ?? "",
  };
}
