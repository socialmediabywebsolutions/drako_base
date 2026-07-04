"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { SaasSocialAccountStatus, SaasSocialProvider } from "@/lib/social-core/types";
import {
  SOCIAL_PROVIDER_ABBR,
  SOCIAL_PROVIDER_COLOR,
  SOCIAL_PROVIDER_LABEL,
  type SocialFlowNetworkKey,
} from "@/lib/socialflow/social-providers";

export type ConnectedAccountSummary = {
  provider: SaasSocialProvider;
  handle: string | null;
  displayName: string | null;
  status: SaasSocialAccountStatus;
  isPrimary: boolean;
  updatedAt: string;
};

export type SocialNetworkCardModel = {
  key: SocialFlowNetworkKey;
  connectPath: string | null;
  comingSoon: boolean;
  entitlement: "included" | "extra";
  description: string;
};

type Props = {
  networks: SocialNetworkCardModel[];
  accounts: ConnectedAccountSummary[];
  saasId: string;
  redirectTo: string;
};

const STATUS_LABELS: Record<SaasSocialAccountStatus, string> = {
  DISCONNECTED: "Desconectada",
  CONNECTED_DEMO: "Conectada (demo)",
  CONNECTED_REAL: "Conectada",
  INVALID_CREDENTIALS: "Error de conexión",
  PENDING_REAL: "Pendiente",
  NEEDS_RECONNECTION: "Requiere reconexión",
};

const STATUS_CLS: Record<SaasSocialAccountStatus, string> = {
  DISCONNECTED: "bg-white/8 text-white/45",
  CONNECTED_DEMO: "bg-emerald-500/15 text-emerald-300",
  CONNECTED_REAL: "bg-emerald-500/15 text-emerald-300",
  INVALID_CREDENTIALS: "bg-rose-500/15 text-red-300",
  PENDING_REAL: "bg-amber-500/15 text-amber-300",
  NEEDS_RECONNECTION: "bg-amber-500/15 text-amber-300",
};

export default function SocialNetworksBoard({ networks, accounts, saasId, redirectTo }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const accountsByProvider = new Map<string, ConnectedAccountSummary>(accounts.map((account) => [account.provider, account]));
  const callbackBanner = resolveCallbackBanner(searchParams);
  const planBannerMessage = resolvePlanBannerMessage(searchParams);

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
          throw new Error(data.error || "No se pudo desconectar la cuenta");
        }
        router.refresh();
      } catch (e: any) {
        setError(e?.message || "No se pudo desconectar la cuenta");
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
              ? "rounded-xl border border-red-500/20 bg-red-500/8 p-4 text-sm text-red-300"
              : callbackBanner.tone === "warning"
                ? "rounded-xl border border-amber-500/20 bg-amber-500/8 p-4 text-sm text-amber-300"
                : "rounded-xl border border-emerald-500/20 bg-emerald-500/8 p-4 text-sm text-emerald-300"
          }
        >
          {callbackBanner.message}
        </div>
      )}

      {planBannerMessage && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 p-4 text-sm text-amber-300">
          {planBannerMessage}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/8 p-4 text-sm text-red-300">{error}</div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {networks.map((network) => {
          const account = accountsByProvider.get(network.key);
          const status = account?.status ?? "DISCONNECTED";
          const isConnected = status === "CONNECTED_REAL" || status === "CONNECTED_DEMO";
          const label = SOCIAL_PROVIDER_LABEL[network.key];
          const abbr = SOCIAL_PROVIDER_ABBR[network.key];
          const color = SOCIAL_PROVIDER_COLOR[network.key];
          const connectHref = network.connectPath
            ? `${network.connectPath}?saasId=${encodeURIComponent(saasId)}&redirectTo=${encodeURIComponent(redirectTo)}`
            : null;
          const showExtraBadge = !network.comingSoon && network.entitlement === "extra" && !isConnected;

          return (
            <div key={network.key} className="rounded-2xl border border-white/10 bg-white/4">
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/8 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black ${color}`}>
                    {abbr}
                  </span>
                  <div>
                    <h3 className="text-base font-black uppercase italic tracking-tight text-white">{label}</h3>
                    {network.comingSoon ? (
                      <span className="mt-1 inline-flex rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
                        Próximamente
                      </span>
                    ) : (
                      <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] ${STATUS_CLS[status]}`}>
                        {STATUS_LABELS[status]}
                      </span>
                    )}
                  </div>
                </div>
                {showExtraBadge && (
                  <span className="inline-flex rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
                    Extra
                  </span>
                )}
              </header>
              <div className="space-y-3 px-5 py-4">
                <p className="text-sm text-white/45">{network.description}</p>
                {account && (account.displayName || account.handle) && (
                  <div className="text-sm font-semibold text-white/80">{account.displayName ?? account.handle}</div>
                )}

                {network.comingSoon ? (
                  <button
                    disabled
                    className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/35"
                  >
                    Próximamente
                  </button>
                ) : isConnected ? (
                  <button
                    onClick={() => disconnect(network.key as SaasSocialProvider)}
                    disabled={isPending}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/65 transition hover:border-red-500/30 hover:bg-red-500/8 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pendingProvider === network.key && (
                      <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
                    )}
                    Desconectar
                  </button>
                ) : showExtraBadge ? (
                  <a
                    href="/socialflow/settings/billing"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/15"
                  >
                    Actualizar plan para conectar
                  </a>
                ) : connectHref ? (
                  <a
                    href={connectHref}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-violet-500/20 transition hover:brightness-110"
                  >
                    Conectar
                  </a>
                ) : null}
              </div>
            </div>
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

  const provider = searchParams.get("provider") ?? (meta ? "meta" : instagram ? "Instagram" : "LinkedIn");
  const code = searchParams.get("code");
  const message = searchParams.get("message");

  if (status === "error") {
    return { tone: "error", message: message || `No se pudo conectar ${provider}${code ? ` (${code})` : ""}.` };
  }
  if (status === "warning") {
    return { tone: "warning", message: message || `${provider} conectado, pero no se pudo guardar la conexión${code ? ` (${code})` : ""}.` };
  }
  return { tone: "success", message: `${provider} conectado correctamente.` };
}

function resolvePlanBannerMessage(searchParams: URLSearchParams): string | null {
  const planError = searchParams.get("planError");
  if (!planError) return null;
  return searchParams.get("planMessage") || "Tu plan actual no permite conectar esta red todavía.";
}
