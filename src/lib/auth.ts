import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            authorization: {
                params: {
                    prompt: "select_account",
                    access_type: "offline",
                    response_type: "code",
                },
            },
        }),
        CredentialsProvider({
            name: "Email",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials, req) {
                if (!credentials?.email || !credentials?.password) return null;

                try {
                    const res = await fetch("https://drako.systems/internal/auth/verify", {
                        method: "POST",
                        body: JSON.stringify({
                            email: credentials.email,
                            password: credentials.password,
                        }),
                        headers: {
                            "Content-Type": "application/json",
                            "X-Drako-Origin-Secret": process.env.INTERNAL_API_SECRET || ""
                        }
                    });

                    const data = await res.json();

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
        })
    ],
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
            }
            return session;
        },
        async jwt({ token, account, profile }) {
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
