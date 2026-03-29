import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveAuthsContextFromHost } from "@/lib/auths/contexts";
import { normalizeHost } from "@/lib/hosts";

type LegacyAuthPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function resolveSearchParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  return Array.isArray(value) ? value[0] ?? null : null;
}

function resolveDestination(context: ReturnType<typeof resolveAuthsContextFromHost>) {
  if (context === "bases") return "/bases/login";
  if (context === "mentorias") return "/mentorias/auths/logins";
  if (context === "socialflow") return "/socialflow/auth";
  return "/drakos/auths/logins";
}

export default async function LegacyLoginPage({ searchParams }: LegacyAuthPageProps) {
  const params = (await searchParams) ?? {};
  const localOverrideHost = resolveSearchParam(params.__drako_host);
  const callbackUrl = resolveSearchParam(params.callbackUrl);
  const invite = resolveSearchParam(params.invite);
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const requestedHost =
    localOverrideHost
    || requestHeaders.get("x-drako-effective-host")
    || cookieStore.get("drako_host")?.value
    || requestHeaders.get("x-forwarded-host")
    || requestHeaders.get("host");
  const normalizedHost = normalizeHost(requestedHost ?? "");
  const isAmbiguousLocalHost = !localOverrideHost && (normalizedHost === "localhost" || normalizedHost === "127.0.0.1");

  if (isAmbiguousLocalHost) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
        <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-white/5 p-8">
          <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-sky-200">Explicit context required</div>
          <h1 className="mt-4 text-3xl font-black">Local auth no longer falls back to Drakos.</h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            Use an explicit host context in local development: `?__drako_host=bases.drako.systems`, `?__drako_host=drako.systems`,
            `?__drako_host=mentorias.drako.systems` or an explicit SocialFlow host.
          </p>
        </div>
      </div>
    );
  }

  const context = resolveAuthsContextFromHost(requestedHost);
  const target = new URL(resolveDestination(context), "http://localhost");
  if (callbackUrl) target.searchParams.set("callbackUrl", callbackUrl);
  if (invite) target.searchParams.set("invite", invite);
  if (localOverrideHost) target.searchParams.set("__drako_host", localOverrideHost);
  redirect(`${target.pathname}${target.search}`);
}
