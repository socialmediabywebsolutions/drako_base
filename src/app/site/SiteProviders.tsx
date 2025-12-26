"use client";

import type { PropsWithChildren } from "react";
import SiteSessionProvider from "@/contexts/site-session-context";

export default function SiteProviders({ children }: PropsWithChildren) {
  return <SiteSessionProvider>{children}</SiteSessionProvider>;
}
