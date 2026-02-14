import { NextAuthOptions } from "next-auth";
import { safeEnv } from "@/lib/env";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

// Build providers array conditionally
function buildProviders() {
    const providers: any[] = [];

    // Only add Google provider if credentials are configured
    if (safeEnv.GOOGLE_CLIENT_ID && safeEnv.GOOGLE_CLIENT_SECRET) {
        providers.push(GoogleProvider({
            clientId: safeEnv.GOOGLE_CLIENT_ID,
            clientSecret: safeEnv.GOOGLE_CLIENT_SECRET,
            authorization: {
                params: {
                    prompt: "select_account",
                    access_type: "offline",
                    response_type: "code",
                },
            },
        }));
    }

    // Always add credentials provider
    providers.push(CredentialsProvider({
        name: "Email",
        credentials: {
            email: { label: "Email", type: "email" },
            password: { label: "Password", type: "password" }
        },
        async authorize(credentials, req) {
            if (!credentials?.email || !credentials?.password) return null;

            try {
                // Use internal API URL from env, ensuring we don't break in dev/preview
                const baseUrl = safeEnv.INTERNAL_API_URL.replace(/\/$/, "");
                const res = await fetch(`${baseUrl}/api/auth/verify`, {
                    method: "POST",
                    body: JSON.stringify({
                        email: credentials.email,
                        password: credentials.password,
                    }),
                    headers: {
                        "Content-Type": "application/json",
                        "X-Drako-Origin-Secret": safeEnv.INTERNAL_API_SECRET
                    }
                });

                const data = (await res.json()) as { user?: any; error?: string };

                if (!res.ok || !data.user) {
                    // Logging but not leaking details in prod
                    console.warn("AUTH_FAILED", credentials.email, data.error);
                    return null;
                }

                return data.user;
            } catch (e: any) {
                console.error("AUTH_ERROR", e);
                return null;
            }
        }
    }));

    return providers;
}

export const authOptions: NextAuthOptions = {
    providers: buildProviders(),
    pages: {
        signIn: "/auth/login",
    },
    callbacks: {
        async redirect({ url, baseUrl }) {
            // If the url is relative, it's already safe
            if (url.startsWith("/")) return `${baseUrl}${url}`;
            // If the url is absolute, ensure it's within the same domain
            if (new URL(url).origin === baseUrl) return url;
            // Fallback to site panel
            return `${baseUrl}/site/panel`;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.sub!;
                session.user.tenantId = token.tenantId as string;
                session.user.role = token.role as string;
            }
            return session;
        },
        async jwt({ token, user, account }) {
            if (user) {
                token.id = user.id;
                token.tenantId = (user as any).tenantId;
                token.role = (user as any).role;
            }
            if (account) {
                token.accessToken = account.access_token;
            }
            return token;
        },
    },
    session: {
        strategy: "jwt",
    },
    secret: process.env.NEXTAUTH_SECRET,
};
