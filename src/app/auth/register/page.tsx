import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveAuthsContextFromHost } from "@/lib/auths/contexts";
import { normalizeHost } from "@/lib/hosts";

type LegacyRegisterPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function resolveSearchParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  return Array.isArray(value) ? value[0] ?? null : null;
}

function resolveDestination(context: ReturnType<typeof resolveAuthsContextFromHost>) {
  if (context === "bases") return "/bases/register";
  if (context === "mentorias") return "/mentorias/auths/registrations";
  if (context === "socialflow") return "/socialflow/auth";
  return "/drakos/auths/registrations";
}

export default async function LegacyRegisterPage({ searchParams }: LegacyRegisterPageProps) {
  const params = (await searchParams) ?? {};
  const localOverrideHost = resolveSearchParam(params.__drako_host);
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

  if (!localOverrideHost && (normalizedHost === "localhost" || normalizedHost === "127.0.0.1")) {
    redirect("/auth/login");
  }

  const context = resolveAuthsContextFromHost(requestedHost);
  const target = new URL(resolveDestination(context), "http://localhost");
  if (invite) target.searchParams.set("invite", invite);
  if (localOverrideHost) target.searchParams.set("__drako_host", localOverrideHost);
  redirect(`${target.pathname}${target.search}`);
}
