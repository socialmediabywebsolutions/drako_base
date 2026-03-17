import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { safeEnv } from "@/lib/env";
import { DrakoD1AuthAdapter } from "@/lib/auth/nextauth-adapter";
import {
  ensureUserHasWorkspace,
  getWorkspaceUserByEmail,
  getWorkspaceUserById,
  resolveActiveMembershipForUser,
  validateWorkspaceCredentials,
} from "@/lib/auth/campamento-core";

function buildProviders() {
  const providers = [];

  if (safeEnv.GOOGLE_CLIENT_ID && safeEnv.GOOGLE_CLIENT_SECRET) {
    providers.push(
      GoogleProvider({
        clientId: safeEnv.GOOGLE_CLIENT_ID,
        clientSecret: safeEnv.GOOGLE_CLIENT_SECRET,
        authorization: {
          params: {
            prompt: "select_account",
            access_type: "offline",
            response_type: "code",
          },
        },
      }),
    );
  }

  providers.push(
    CredentialsProvider({
      name: "Workspace credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;

        const resolved = await validateWorkspaceCredentials(email, password);
        if (!resolved) return null;

        return {
          id: resolved.userId,
          email: resolved.email,
          name: resolved.name ?? resolved.email.split("@")[0],
        };
      },
    }),
  );

  return providers;
}

async function resolveSessionUser(sessionUser: {
  id?: string;
  email?: string | null;
  name?: string | null;
}) {
  const userId = sessionUser.id ?? null;
  const email = sessionUser.email?.trim().toLowerCase() ?? null;
  if (!userId && !email) return null;

  const user = userId
    ? await getWorkspaceUserById(userId)
    : email
      ? await getWorkspaceUserByEmail(email)
      : null;

  if (!user) return null;
  const membership = await resolveActiveMembershipForUser(user.id);
  if (!membership) return null;
  return {
    user,
    membership,
  };
}

export const authOptions: NextAuthOptions = {
  adapter: DrakoD1AuthAdapter(),
  providers: buildProviders(),
  pages: {
    signIn: "/auth/login",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user?.id || !user.email) return false;
      await ensureUserHasWorkspace({
        userId: user.id,
        email: user.email,
        name: user.name ?? null,
      });
      return true;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return `${baseUrl}/client`;
    },
    async session({ session }) {
      if (!session.user) return session;
      const resolved = await resolveSessionUser({
        id: session.user.id,
        email: session.user.email,
        name: session.user.name ?? null,
      });
      if (!resolved) return session;
      session.user.id = resolved.user.id;
      session.user.email = resolved.user.email;
      session.user.name = resolved.user.name ?? session.user.name ?? null;
      session.user.tenantId = resolved.membership.tenantId;
      session.user.role = resolved.membership.role;
      return session;
    },
  },
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET ?? process.env.SESSION_SECRET,
};
