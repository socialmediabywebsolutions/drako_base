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
        async authorize(credentials) {
            if (!credentials?.email || !credentials?.password) return null;

            // USE LOCAL LOGIC (from @/lib/cf) instead of falling fetch
            const { env } = await import("@/lib/cf");
            const conf = env();
            if (!conf) {
                console.warn("AUTH_ERROR: Environment not available");
                return null;
            }

            const email = credentials.email.trim().toLowerCase();
            const adminEmail = conf.ADMIN_EMAIL?.trim().toLowerCase() ?? null;
            const adminPassword = conf.ADMIN_PASSWORD ?? null;
            const userPassword = conf.USER_PASSWORD ?? null;

            let role: string | null = null;
            let expectedPassword: string | null = null;

            if (adminEmail && email === adminEmail) {
                role = "admin";
                expectedPassword = adminPassword ?? userPassword;
            } else {
                role = "user";
                expectedPassword = userPassword ?? adminPassword;
            }

            if (!expectedPassword || credentials.password !== expectedPassword) {
                console.warn("AUTH_FAILED: Invalid credentials for", email);
                return null;
            }

            return {
                id: email,
                name: email.split("@")[0],
                email: email,
                role: role,
                tenantId: conf.DEFAULT_TENANT_ID || "demo-tenant"
            };
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
