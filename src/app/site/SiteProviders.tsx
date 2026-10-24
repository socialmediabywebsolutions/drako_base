"use client";

import type { PropsWithChildren } from "react";
import { NextAuthProviders } from "@/components/providers/next-auth-providers";
import SiteSessionProvider from "@/contexts/site-session-context";

export default function SiteProviders({ children }: PropsWithChildren) {
  return (
    <NextAuthProviders>
      <SiteSessionProvider>{children}</SiteSessionProvider>
    </NextAuthProviders>
  );
}
