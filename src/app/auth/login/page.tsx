import Image from "next/image";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AuthForm } from "@/components/auth/auth-form";
import { authOptions } from "@/lib/auth";
import { getTenantInviteByToken } from "@/lib/auth/campamento-core";
import { resolveAuthsContextFromHost } from "@/lib/auths/contexts";
import { safeEnv } from "@/lib/env";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function resolveSearchParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  return Array.isArray(value) ? value[0] ?? null : null;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    redirect("/client");
  }

  const params = (await searchParams) ?? {};
  const inviteToken = typeof params.invite === "string" ? params.invite : null;
  const localOverrideHost = resolveSearchParam(params.__drako_host);
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const requestedHost =
    localOverrideHost
    || requestHeaders.get("x-drako-effective-host")
    || cookieStore.get("drako_host")?.value
    || requestHeaders.get("x-forwarded-host")
    || requestHeaders.get("host");
  const context = resolveAuthsContextFromHost(requestedHost);
  const isBasesContext = context === "bases";
  const invite = inviteToken ? await getTenantInviteByToken(inviteToken) : null;
  const isMentoriasContext = context === "mentorias";
  const googleOperatorAuthEnabled = isBasesContext && Boolean(safeEnv.GOOGLE_CLIENT_ID && safeEnv.GOOGLE_CLIENT_SECRET);

  const authApiBase =
    context === "mentorias"
      ? "/api/mentorias/auths"
      : context === "bases"
        ? "/api/auth/workspace"
        : "/api/drakos/auths";
  const saasSlug = context === "mentorias" ? "mentorias" : context === "bases" ? "campo_base" : "drako";
  const redirectTo = context === "mentorias" ? "/client/sessions" : context === "bases" ? "/client" : "/site/onboarding";
  const heroEyebrow = isBasesContext ? "Private Operator Access" : isMentoriasContext ? "Mentorias Access" : "Public Product Access";
  const heroTitle = isBasesContext
    ? "Enter the owner control center."
    : isMentoriasContext
      ? "Access your Mentorias environment."
      : "Access your Drako account.";
  const heroCopy = isBasesContext
    ? "Campamento Base is a private operator surface. Only owner and internal workspace operators authenticate here."
    : isMentoriasContext
      ? "Sign in to the Mentorias auth boundary for this product surface. Operator access remains isolated from Campamento Base."
      : "Sign in to the public Drako auth boundary and continue into onboarding or your active product flow.";
  const panelEyebrow = invite ? "Workspace invite" : isBasesContext ? "Operator sign in" : isMentoriasContext ? "Product sign in" : "Public sign in";
  const panelTitle = invite ? `Join ${invite.tenantName}` : isBasesContext ? "Sign in to Campamento Base" : isMentoriasContext ? "Welcome back to Mentorias" : "Welcome back to Drako";
  const panelCopy = invite
    ? `Use the invited email to join ${invite.tenantName} as ${invite.role}.`
    : isBasesContext
      ? "Use your private operator credentials. Internal workspace bootstrap, when enabled, stays inside this private access surface."
      : isMentoriasContext
        ? "Use your Mentorias credentials to continue inside this product auth boundary."
        : "Use your Drako credentials to continue into the public product flow.";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_transparent_42%),linear-gradient(135deg,#f8fafc_0%,#eef6ff_45%,#f8fafc_100%)]">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-10 px-6 py-10 lg:grid-cols-[1.1fr,0.9fr] lg:px-10">
        <section className="relative overflow-hidden rounded-[36px] border border-slate-200 bg-slate-950 px-8 py-10 text-white shadow-[0_40px_120px_rgba(15,23,42,0.28)] lg:px-10 lg:py-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.28),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(34,197,94,0.18),_transparent_30%)]" />
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div>
              <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-sky-200">
                {heroEyebrow}
              </div>
              <div className="mt-8">
                <Image
                  src="/logo-drako-full.png"
                  alt="Drako Systems"
                  width={190}
                  height={74}
                  className="h-14 w-auto object-contain brightness-0 invert"
                  priority
                />
              </div>
              <h1 className="mt-10 max-w-xl text-4xl font-black tracking-tight text-white lg:text-5xl">
                {heroTitle}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
                {heroCopy}
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-200">Workspace auth</div>
                <p className="mt-3 text-sm leading-6 text-slate-300">Persistent database sessions with tenant-aware access.</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-200">Team operations</div>
                <p className="mt-3 text-sm leading-6 text-slate-300">Members, invites and roles live in the same operational workspace.</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-200">Child SaaS ready</div>
                <p className="mt-3 text-sm leading-6 text-slate-300">SocialFlow and future products are provisioned by Drako and expose their own user auth boundaries.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center">
          <div className="w-full max-w-xl rounded-[32px] border border-slate-200 bg-white/95 p-8 shadow-[0_30px_100px_rgba(15,23,42,0.12)] backdrop-blur-xl lg:p-10">
            <div className="mb-8">
              <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-sky-600">
                {panelEyebrow}
              </div>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
                {panelTitle}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                {panelCopy}
              </p>
            </div>

            <AuthForm
              saasSlug={saasSlug}
              authApiBase={authApiBase}
              postLoginRedirect={redirectTo}
              inviteHint={invite ? { email: invite.email, tenantName: invite.tenantName ?? invite.tenantSlug ?? "Workspace", role: invite.role } : null}
              allowRegistration={isBasesContext ? !invite : true}
              registrationLabel={isBasesContext ? "Workspace setup" : undefined}
              enableGoogleAuth={googleOperatorAuthEnabled}
              googleButtonLabel={isBasesContext ? "Continue with Google as Operator" : undefined}
            />

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-6 text-sm text-slate-500">
              {!isBasesContext ? (
                <Link href={invite ? `/auth/register?invite=${invite.token}` : "/auth/register"} className="font-semibold text-slate-900 transition-colors hover:text-sky-600">
                  Create an account
                </Link>
              ) : (
                <span className="font-semibold text-slate-700">Private operator access only</span>
              )}
              <Link href="/site" className="transition-colors hover:text-sky-600">
                Back to site
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
