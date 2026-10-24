"use client";

import type { ReactNode } from "react";

export function AppProviders({
  children,
  enableNextAuth = false,
}: {
  children: ReactNode;
  enableNextAuth?: boolean;
}) {
  return (
    <div data-neutral-provider={enableNextAuth ? "nextauth-bridge-disabled" : "neutral-only"}>
      {children}
    </div>
  );
}
