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

            const { env: getEnv } = await import("@/lib/cf");
            const { verifyPassword } = await import("@/lib/auth/crypto");

            const conf = getEnv();
            if (!conf || !conf.DRACO_DB) {
                console.warn("AUTH_ERROR: Environment or DB not available");
                return null;
            }

            const email = credentials.email.trim().toLowerCase();
            const db = conf.DRACO_DB;

            // 1. Try DB First (The Professional Path)
            try {
                const user = await db.prepare(`
                    SELECT u.id, u.email, u.name, c.hash, c.salt, c.iterations 
                    FROM auth_users u 
                    JOIN auth_credentials c ON u.id = c.user_id 
                    WHERE u.email = ? AND c.type = 'email'
                    LIMIT 1
                `).bind(email).first<{
                    id: string;
                    email: string;
                    name: string | null;
                    hash: string;
                    salt: string;
                    iterations: number;
                }>();

                if (user) {
                    const isValid = await verifyPassword(credentials.password, user.hash, user.salt, user.iterations);
                    if (isValid) {
                        return {
                            id: user.id,
                            name: user.name || user.email.split("@")[0],
                            email: user.email,
                            role: (user.email === conf.ADMIN_EMAIL?.toLowerCase()) ? "admin" : "user",
                            tenantId: conf.DEFAULT_TENANT_ID || "demo-tenant"
                        };
                    }
                }
            } catch (dbError) {
                console.error("AUTH_DB_QUERY_FAILED", dbError);
            }

            // 2. Fallback to Env Vars (Maintenance/Bootstrap)
            const adminEmail = conf.ADMIN_EMAIL?.trim().toLowerCase();
            const adminPassword = conf.ADMIN_PASSWORD;
            const userPassword = conf.USER_PASSWORD;

            if (adminEmail && email === adminEmail && adminPassword && credentials.password === adminPassword) {
                return {
                    id: "admin-system",
                    name: "System Admin",
                    email: email,
                    role: "admin",
                    tenantId: conf.DEFAULT_TENANT_ID || "demo-tenant"
                };
            }

            if (userPassword && credentials.password === userPassword) {
                return {
                    id: `env-user-${email}`,
                    name: email.split("@")[0],
                    email: email,
                    role: "user",
                    tenantId: conf.DEFAULT_TENANT_ID || "demo-tenant"
                };
            }

            console.warn("AUTH_FAILED: Invalid credentials for", email);
            return null;
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
