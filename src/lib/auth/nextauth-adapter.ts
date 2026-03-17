import type { Adapter, AdapterAccount, AdapterSession, AdapterUser, VerificationToken } from "next-auth/adapters";
import { queryAll, queryOne, run } from "@/lib/db";

function nowIso(): string {
  return new Date().toISOString();
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function DrakoD1AuthAdapter(): Adapter {
  return {
    async createUser(user: Omit<AdapterUser, "id">) {
      const id = crypto.randomUUID();
      await run(
        `INSERT INTO auth_users (id, email, name, email_verified, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        id,
        user.email,
        user.name ?? null,
        user.emailVerified ? user.emailVerified.toISOString() : null,
        nowIso(),
        nowIso(),
      );
      return {
        id,
        email: user.email,
        emailVerified: user.emailVerified ?? null,
        name: user.name ?? null,
        image: user.image ?? null,
      };
    },
    async getUser(id) {
      const row = await queryOne<{
        id: string;
        email: string;
        name: string | null;
        email_verified: string | null;
      }>(
        `SELECT id, email, name, email_verified
         FROM auth_users
         WHERE id = ?
         LIMIT 1`,
        id,
      );
      if (!row) return null;
      return {
        id: row.id,
        email: row.email,
        emailVerified: row.email_verified ? new Date(row.email_verified) : null,
        name: row.name,
        image: null,
      } satisfies AdapterUser;
    },
    async getUserByEmail(email) {
      const row = await queryOne<{
        id: string;
        email: string;
        name: string | null;
        email_verified: string | null;
      }>(
        `SELECT id, email, name, email_verified
         FROM auth_users
         WHERE lower(email) = lower(?)
         LIMIT 1`,
        email,
      );
      if (!row) return null;
      return {
        id: row.id,
        email: row.email,
        emailVerified: row.email_verified ? new Date(row.email_verified) : null,
        name: row.name,
        image: null,
      } satisfies AdapterUser;
    },
    async getUserByAccount({ provider, providerAccountId }) {
      const row = await queryOne<{
        id: string;
        email: string;
        name: string | null;
        email_verified: string | null;
      }>(
        `SELECT u.id, u.email, u.name, u.email_verified
         FROM auth_accounts a
         JOIN auth_users u ON u.id = a.user_id
         WHERE a.provider = ? AND a.provider_account_id = ?
         LIMIT 1`,
        provider,
        providerAccountId,
      );
      if (!row) return null;
      return {
        id: row.id,
        email: row.email,
        emailVerified: row.email_verified ? new Date(row.email_verified) : null,
        name: row.name,
        image: null,
      } satisfies AdapterUser;
    },
    async updateUser(user) {
      await run(
        `UPDATE auth_users
         SET email = COALESCE(?, email),
             name = COALESCE(?, name),
             email_verified = COALESCE(?, email_verified),
             updated_at = ?
         WHERE id = ?`,
        user.email ?? null,
        user.name ?? null,
        user.emailVerified ? user.emailVerified.toISOString() : null,
        nowIso(),
        user.id,
      );
      const updated = await this.getUser?.(user.id);
      return updated as AdapterUser;
    },
    async linkAccount(account: AdapterAccount) {
      await run(
        `INSERT INTO auth_accounts (
          id, user_id, type, provider, provider_account_id, refresh_token, access_token,
          expires_at, token_type, scope, id_token, session_state, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(provider, provider_account_id) DO UPDATE SET
           user_id = excluded.user_id,
           type = excluded.type,
           refresh_token = excluded.refresh_token,
           access_token = excluded.access_token,
           expires_at = excluded.expires_at,
           token_type = excluded.token_type,
           scope = excluded.scope,
           id_token = excluded.id_token,
           session_state = excluded.session_state,
           updated_at = excluded.updated_at`,
        crypto.randomUUID(),
        account.userId,
        account.type,
        account.provider,
        account.providerAccountId,
        account.refresh_token ?? null,
        account.access_token ?? null,
        account.expires_at ?? null,
        account.token_type ?? null,
        account.scope ?? null,
        account.id_token ?? null,
        account.session_state ?? null,
        nowIso(),
        nowIso(),
      );
      return account as AdapterAccount;
    },
    async createSession(session) {
      await run(
        `INSERT INTO auth_sessions (session_token, user_id, expires, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        session.sessionToken,
        session.userId,
        session.expires.toISOString(),
        nowIso(),
        nowIso(),
      );
      return session satisfies AdapterSession;
    },
    async getSessionAndUser(sessionToken) {
      const row = await queryOne<{
        session_token: string;
        user_id: string;
        expires: string;
        id: string;
        email: string;
        name: string | null;
        email_verified: string | null;
      }>(
        `SELECT
          s.session_token,
          s.user_id,
          s.expires,
          u.id,
          u.email,
          u.name,
          u.email_verified
         FROM auth_sessions s
         JOIN auth_users u ON u.id = s.user_id
         WHERE s.session_token = ?
         LIMIT 1`,
        sessionToken,
      );
      if (!row) return null;
      return {
        session: {
          sessionToken: row.session_token,
          userId: row.user_id,
          expires: toDate(row.expires),
        },
        user: {
          id: row.id,
          email: row.email,
          name: row.name,
          emailVerified: row.email_verified ? new Date(row.email_verified) : null,
          image: null,
        },
      };
    },
    async updateSession(session) {
      await run(
        `UPDATE auth_sessions
         SET expires = COALESCE(?, expires),
             updated_at = ?
         WHERE session_token = ?`,
        session.expires ? session.expires.toISOString() : null,
        nowIso(),
        session.sessionToken,
      );
      if (!session.sessionToken) return null;
      const row = await queryOne<{ session_token: string; user_id: string; expires: string }>(
        `SELECT session_token, user_id, expires
         FROM auth_sessions
         WHERE session_token = ?
         LIMIT 1`,
        session.sessionToken,
      );
      if (!row) return null;
      return {
        sessionToken: row.session_token,
        userId: row.user_id,
        expires: new Date(row.expires),
      } satisfies AdapterSession;
    },
    async deleteSession(sessionToken) {
      const existing = await queryOne<{ session_token: string; user_id: string; expires: string }>(
        `SELECT session_token, user_id, expires
         FROM auth_sessions
         WHERE session_token = ?
         LIMIT 1`,
        sessionToken,
      );
      await run(`DELETE FROM auth_sessions WHERE session_token = ?`, sessionToken);
      if (!existing) return null;
      return {
        sessionToken: existing.session_token,
        userId: existing.user_id,
        expires: new Date(existing.expires),
      } satisfies AdapterSession;
    },
    async createVerificationToken(token) {
      await run(
        `INSERT INTO auth_verification_tokens (identifier, token, expires)
         VALUES (?, ?, ?)`,
        token.identifier,
        token.token,
        token.expires.toISOString(),
      );
      return token satisfies VerificationToken;
    },
    async useVerificationToken(params) {
      const existing = await queryOne<{ identifier: string; token: string; expires: string }>(
        `SELECT identifier, token, expires
         FROM auth_verification_tokens
         WHERE identifier = ? AND token = ?
         LIMIT 1`,
        params.identifier,
        params.token,
      );
      if (!existing) return null;
      await run(
        `DELETE FROM auth_verification_tokens
         WHERE identifier = ? AND token = ?`,
        params.identifier,
        params.token,
      );
      return {
        identifier: existing.identifier,
        token: existing.token,
        expires: new Date(existing.expires),
      } satisfies VerificationToken;
    },
  };
}
