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
  DISCONNECTED: "bg-gray-100 text-gray-500",
  CONNECTED_DEMO: "bg-emerald-50 text-emerald-700",
  CONNECTED_REAL: "bg-emerald-50 text-emerald-700",
  INVALID_CREDENTIALS: "bg-rose-50 text-red-700",
  PENDING_REAL: "bg-amber-50 text-amber-700",
  NEEDS_RECONNECTION: "bg-amber-50 text-amber-700",
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
              ? "rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              : callbackBanner.tone === "warning"
                ? "rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700"
                : "rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
          }
        >
          {callbackBanner.message}
        </div>
      )}

      {planBannerMessage && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          {planBannerMessage}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {networks.map((network) => {
          const account = accountsByProvider.get(network.key);
          const status = account?.status ?? "DISCONNECTED";
          const isConnected = status === "CONNECTED_REAL" || status === "CONNECTED_DEMO" || status === "PENDING_REAL";
          const label = SOCIAL_PROVIDER_LABEL[network.key];
          const abbr = SOCIAL_PROVIDER_ABBR[network.key];
          const color = SOCIAL_PROVIDER_COLOR[network.key];
          const connectHref = network.connectPath
            ? `${network.connectPath}?saasId=${encodeURIComponent(saasId)}&redirectTo=${encodeURIComponent(redirectTo)}`
            : null;
          const showExtraBadge = !network.comingSoon && network.entitlement === "extra" && !isConnected;

          return (
            <div key={network.key} className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black ${color}`}>
                    {abbr}
                  </span>
                  <div>
                    <h3 className="text-base font-black uppercase italic tracking-tight text-gray-900">{label}</h3>
                    {network.comingSoon ? (
                      <span className="mt-1 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">
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
                  <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700">
                    Extra
                  </span>
                )}
              </header>
              <div className="space-y-3 px-5 py-4">
                <p className="text-sm text-gray-500">{network.description}</p>
                {account && (account.displayName || account.handle) && (
                  <div className="text-sm font-semibold text-gray-700">{account.displayName ?? account.handle}</div>
                )}

                {network.comingSoon ? (
                  <button
                    disabled
                    className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-400"
                  >
                    Próximamente
                  </button>
                ) : isConnected ? (
                  <button
                    onClick={() => disconnect(network.key as SaasSocialProvider)}
                    disabled={isPending}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pendingProvider === network.key && (
                      <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
                    )}
                    Desconectar
                  </button>
                ) : showExtraBadge ? (
                  <a
                    href="/socialflow/settings/billing"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
                  >
                    Actualizar plan para conectar
                  </a>
                ) : connectHref ? (
                  <a
                    href={connectHref}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] px-4 py-2 text-sm font-semibold text-white shadow-md shadow-[#3b82f6]/20 transition hover:brightness-110"
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
