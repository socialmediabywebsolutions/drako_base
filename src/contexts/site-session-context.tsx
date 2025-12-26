"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type DraftCompany = {
  ownerName?: string;
  ownerEmail?: string;
  clientName?: string;
  clientNif?: string;
};

type DraftSaas = {
  saasName?: string;
  saasSlug?: string;
  saasDescription?: string;
};

export type SiteSession = {
  ownerId?: string;
  clientId?: string;
  saasId?: string;
  clientSaasId?: string;
  draftCompany?: DraftCompany;
  draftSaas?: DraftSaas;
};

type SiteSessionContextValue = {
  session: SiteSession;
  updateSession: (partial: Partial<SiteSession>) => void;
  clearSession: () => void;
};

const STORAGE_KEY = "drako_site_session";

const SiteSessionContext = createContext<SiteSessionContextValue | undefined>(undefined);

function readInitialSession(): SiteSession {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? ((JSON.parse(stored) as SiteSession) ?? {}) : {};
  } catch (error) {
    console.warn("SITE_SESSION_LOAD_ERROR", error);
    return {};
  }
}

export default function SiteSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SiteSession>(readInitialSession);

  const updateSession = useCallback((partial: Partial<SiteSession>) => {
    setSession((prev) => {
      const next = { ...prev, ...partial };
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch (error) {
          console.warn("SITE_SESSION_SAVE_ERROR", error);
        }
      }
      return next;
    });
  }, []);

  const clearSession = useCallback(() => {
    setSession({});
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        console.warn("SITE_SESSION_CLEAR_ERROR", error);
      }
    }
  }, []);

  const value = useMemo<SiteSessionContextValue>(
    () => ({ session, updateSession, clearSession }),
    [session, updateSession, clearSession]
  );

  return <SiteSessionContext.Provider value={value}>{children}</SiteSessionContext.Provider>;
}

export function useSiteSession() {
  const context = useContext(SiteSessionContext);
  if (!context) {
    throw new Error("useSiteSession must be used within SiteSessionProvider");
  }
  return context;
}
