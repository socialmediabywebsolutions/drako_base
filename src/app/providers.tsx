"use client";

import { SessionProvider } from "next-auth/react";

export function Providers({
    children,
    enableNextAuth,
}: {
    children: React.ReactNode;
    enableNextAuth: boolean;
}) {
    if (!enableNextAuth) {
        return <>{children}</>;
    }
    return <SessionProvider>{children}</SessionProvider>;
}
