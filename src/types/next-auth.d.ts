import NextAuth, { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      tenantId?: string;
      role?: "OWNER" | "ADMIN" | "MEMBER";
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    tenantId?: string;
    role?: "OWNER" | "ADMIN" | "MEMBER";
  }
}
