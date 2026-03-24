import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AuthForm } from "@/components/auth/auth-form";
import { authOptions } from "@/lib/auth";
import { getTenantInviteByToken } from "@/lib/auth/campamento-core";
import { resolveAuthsContextFromHost } from "@/lib/auths/contexts";

type RegisterPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function resolveSearchParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  return Array.isArray(value) ? value[0] ?? null : null;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    redirect("/client");
  }

  const params = (await searchParams) ?? {};
  const inviteToken = typeof params.invite === "string" ? params.invite : null;
  const invite = inviteToken ? await getTenantInviteByToken(inviteToken) : null;
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
  const isMentoriasContext = context === "mentorias";

  if (isBasesContext) {
    const loginUrl = new URL("/auth/login", "http://localhost");
    if (invite) {
      loginUrl.searchParams.set("invite", invite.token);
    }
    if (localOverrideHost) {
      loginUrl.searchParams.set("__drako_host", localOverrideHost);
    }
    redirect(`${loginUrl.pathname}${loginUrl.search}`);
  }

  const authApiBase = context === "mentorias" ? "/api/mentorias/auths" : "/api/drakos/auths";
  const saasSlug = context === "mentorias" ? "mentorias" : "drako";
  const postLoginRedirect = context === "mentorias" ? "/client/sessions" : "/site/onboarding";
  const heroEyebrow = invite ? "Accept invite" : isMentoriasContext ? "Create Mentorias account" : "Create Drako account";
  const heroTitle = invite ? "Join an existing team." : isMentoriasContext ? "Create your Mentorias account." : "Create your Drako account.";
  const heroCopy = invite
    ? `Finish your access to ${invite.tenantName}. This keeps membership and access inside the intended product boundary.`
    : isMentoriasContext
      ? "Create an account for the Mentorias auth boundary."
      : "Create a public Drako account and continue into the onboarding or product flow for this host.";
  const benefitItems = isMentoriasContext
    ? [
        "Isolated Mentorias identity and session",
        "Product-specific login and registration surface",
        "Separated from other product auth boundaries",
      ]
    : [
        "Public account creation in the Drako auth boundary",
        "Email/password sign-in aligned with the visible product surface",
        "Designed for the public product flow on this host",
      ];
  const honestyTitle = isMentoriasContext ? "Isolation rule" : "Auth contract";
  const honestyCopy = isMentoriasContext
    ? "This registration belongs to the Mentorias product boundary."
    : "Public Drako auth lives on the product host and stays focused on the end-user product flow.";
  const panelEyebrow = invite ? "Team access" : isMentoriasContext ? "Product registration" : "Public registration";
  const panelTitle = invite ? `Accept invite to ${invite.tenantName}` : isMentoriasContext ? "Create your Mentorias account" : "Create your Drako account";
  const panelCopy = invite
    ? "Use the invited email and set your password once. You will land directly inside the intended tenant workspace."
    : isMentoriasContext
      ? "This creates an account only for the Mentorias auth boundary."
      : "This creates a public Drako account for the current product flow.";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),_transparent_38%),linear-gradient(180deg,#f8fafc_0%,#ffffff_50%,#f8fafc_100%)]">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-10 px-6 py-10 lg:grid-cols-[0.95fr,1.05fr] lg:px-10">
        <section className="rounded-[36px] border border-slate-200 bg-white/90 p-8 shadow-[0_30px_100px_rgba(15,23,42,0.1)] backdrop-blur-xl lg:p-10">
          <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-sky-600">
            {heroEyebrow}
          </div>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 lg:text-5xl">
            {heroTitle}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
            {heroCopy}
          </p>

          <div className="mt-10 grid gap-4">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">What you get</div>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                {benefitItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-sky-50 p-5">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-700">{honestyTitle}</div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {honestyCopy}
              </p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center">
          <div className="w-full max-w-xl rounded-[32px] border border-slate-200 bg-white p-8 shadow-[0_30px_100px_rgba(15,23,42,0.12)] lg:p-10">
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
              defaultMode="register"
              saasSlug={saasSlug}
              authApiBase={authApiBase}
              postLoginRedirect={postLoginRedirect}
              inviteHint={invite ? { email: invite.email, tenantName: invite.tenantName ?? invite.tenantSlug ?? "Workspace", role: invite.role } : null}
            />

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-6 text-sm text-slate-500">
              <Link href={invite ? `/auth/login?invite=${invite.token}` : "/auth/login"} className="font-semibold text-slate-900 transition-colors hover:text-sky-600">
                Already have access? Sign in
              </Link>
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
