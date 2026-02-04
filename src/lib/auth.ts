import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

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
