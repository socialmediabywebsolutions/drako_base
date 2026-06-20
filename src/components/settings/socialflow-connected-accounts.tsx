"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import type { SaasSocialAccountStatus, SaasSocialProvider } from "@/lib/social-core/types";

export type ConnectedAccountSummary = {
  provider: SaasSocialProvider;
  handle: string | null;
  displayName: string | null;
  status: SaasSocialAccountStatus;
  isPrimary: boolean;
  updatedAt: string;
};

type SocialFlowConnectedAccountsProps = {
  accounts: ConnectedAccountSummary[];
  saasId: string;
};

type ProviderDefinition = {
  provider: SaasSocialProvider;
  label: string;
  description: string;
  connectPath: string;
};

const PROVIDERS: ProviderDefinition[] = [
  {
    provider: "INSTAGRAM",
    label: "Instagram",
    description: "Connect an Instagram Business account directly via Instagram Business Login.",
    connectPath: "/api/socialflow/oauth/instagram/connect",
  },
  {
    provider: "FACEBOOK_PAGE",
    label: "Facebook Page",
    description: "Connect a Facebook Page to fetch followers, engagement and recent posts.",
    connectPath: "/api/socialflow/meta/connect",
  },
  {
    provider: "LINKEDIN",
    label: "LinkedIn",
    description: "Connect a LinkedIn profile or Company Page.",
    connectPath: "/api/socialflow/linkedin/connect",
  },
];

const STATUS_LABELS: Record<SaasSocialAccountStatus, string> = {
  DISCONNECTED: "Disconnected",
  CONNECTED_DEMO: "Connected (demo)",
  CONNECTED_REAL: "Connected",
  INVALID_CREDENTIALS: "Connection error",
  PENDING_REAL: "Pending",
  NEEDS_RECONNECTION: "Needs reconnection",
};

const STATUS_TONES: Record<SaasSocialAccountStatus, "default" | "success" | "danger"> = {
  DISCONNECTED: "default",
  CONNECTED_DEMO: "success",
  CONNECTED_REAL: "success",
  INVALID_CREDENTIALS: "danger",
  PENDING_REAL: "default",
  NEEDS_RECONNECTION: "danger",
};

const SETTINGS_PATH = "/socialflow/settings/accounts";

const CONNECT_LINK_CLASS =
  "relative inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white bg-sky-500 shadow-lg shadow-sky-500/30 transition-all duration-150 hover:-translate-y-0.5 hover:bg-sky-600 hover:shadow-sky-600/40";

export default function SocialFlowConnectedAccounts({ accounts, saasId }: SocialFlowConnectedAccountsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pendingProvider, setPendingProvider] = useState<SaasSocialProvider | null>(null);
  const [isPending, startTransition] = useTransition();

  const accountsByProvider = new Map(accounts.map((account) => [account.provider, account]));

  const callbackBanner = resolveCallbackBanner(searchParams);

  function disconnect(provider: SaasSocialProvider) {
    setError(null);
    setPendingProvider(provider);
    startTransition(async () => {
      try {
        const res = await fetch("/api/socialflow/accounts/disconnect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider, saasId }),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Unable to disconnect account");
        }
        router.refresh();
      } catch (e: any) {
        setError(e?.message || "Unable to disconnect account");
      } finally {
        setPendingProvider(null);
      }
    });
  }

  return (
    <div className="space-y-6">
      {callbackBanner && (
        <div
          className={
            callbackBanner.tone === "error"
              ? "rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
              : callbackBanner.tone === "warning"
                ? "rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700"
                : "rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
          }
        >
          {callbackBanner.message}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {PROVIDERS.map((definition) => {
          const account = accountsByProvider.get(definition.provider);
          const status = account?.status ?? "DISCONNECTED";
          const isConnected = status === "CONNECTED_REAL" || status === "CONNECTED_DEMO";
          const connectHref = `${definition.connectPath}?saasId=${encodeURIComponent(saasId)}&redirectTo=${encodeURIComponent(SETTINGS_PATH)}`;

          return (
            <Card
              key={definition.provider}
              title={definition.label}
              subtitle={STATUS_LABELS[status]}
              tone={STATUS_TONES[status]}
            >
              <div className="space-y-3">
                <p className="text-sm text-slate-500">{definition.description}</p>

                {account && (account.displayName || account.handle) && (
                  <div className="text-sm font-semibold text-slate-800">
                    {account.displayName ?? account.handle}
                  </div>
                )}

                {isConnected ? (
                  <Button
                    variant="outline"
                    onClick={() => disconnect(definition.provider)}
                    disabled={isPending}
                    loading={pendingProvider === definition.provider}
                  >
                    Disconnect
                  </Button>
                ) : (
                  <a href={connectHref} className={CONNECT_LINK_CLASS}>
                    Connect
                  </a>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function resolveCallbackBanner(searchParams: URLSearchParams): { tone: "error" | "warning" | "success"; message: string } | null {
  const meta = searchParams.get("meta");
  const linkedin = searchParams.get("linkedin");
  const instagram = searchParams.get("instagram");
  const status = meta ?? linkedin ?? instagram;
  if (!status) return null;

  const provider = searchParams.get("provider") ?? (meta ? "meta" : instagram ? "Instagram" : "linkedin");
  const code = searchParams.get("code");
  const message = searchParams.get("message");

  if (status === "error") {
    return { tone: "error", message: message || `Could not connect ${provider}${code ? ` (${code})` : ""}.` };
  }
  if (status === "warning") {
    return { tone: "warning", message: message || `${provider} connected, but saving the connection failed${code ? ` (${code})` : ""}.` };
  }
  return { tone: "success", message: `${provider} connected successfully.` };
}
