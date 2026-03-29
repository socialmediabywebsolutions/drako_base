"use client";

import { SessionProvider } from "next-auth/react";

export function NextAuthProviders({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
