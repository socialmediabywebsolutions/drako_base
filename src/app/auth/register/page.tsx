import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AuthForm } from "@/components/auth/auth-form";
import { authOptions } from "@/lib/auth";
import { getTenantInviteByToken } from "@/lib/auth/campamento-core";
import { resolveAuthsContextFromHost } from "@/lib/auths/contexts";

type RegisterPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    redirect("/client");
  }

  const params = (await searchParams) ?? {};
  const inviteToken = typeof params.invite === "string" ? params.invite : null;
  const invite = inviteToken ? await getTenantInviteByToken(inviteToken) : null;

  const requestHeaders = await headers();
  const requestedHost = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  const context = resolveAuthsContextFromHost(requestedHost);
  const isBasesContext = context === "bases";

  const authApiBase =
    context === "mentorias"
      ? "/api/mentorias/auths"
      : context === "bases"
        ? "/api/auth/workspace"
        : "/api/drakos/auths";
  const saasSlug = context === "mentorias" ? "mentorias" : context === "bases" ? "campo_base" : "drako";
  const postLoginRedirect = context === "mentorias" ? "/client/sessions" : context === "bases" ? "/client" : "/site/onboarding";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),_transparent_38%),linear-gradient(180deg,#f8fafc_0%,#ffffff_50%,#f8fafc_100%)]">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-10 px-6 py-10 lg:grid-cols-[0.95fr,1.05fr] lg:px-10">
        <section className="rounded-[36px] border border-slate-200 bg-white/90 p-8 shadow-[0_30px_100px_rgba(15,23,42,0.1)] backdrop-blur-xl lg:p-10">
          <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-sky-600">
            {invite ? "Accept invite" : "Create workspace"}
          </div>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 lg:text-5xl">
            {invite ? "Join an existing team." : "Create the owner workspace."}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
            {invite
              ? `Finish your access to ${invite.tenantName}. The same workspace session will power team access, billing, onboarding and every SaaS mounted on top.`
              : isBasesContext
                ? "Create the owner account, become OWNER automatically, and enter the authenticated control workspace at /client. Final users will sign in inside each provisioned SaaS."
                : "Create an account for this Drako surface and continue into the current onboarding flow."}
          </p>

          <div className="mt-10 grid gap-4">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">What you get</div>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <li>Real database session scoped to the owner workspace</li>
                <li>OWNER role and tenant switching across operator memberships</li>
                <li>Factory oversight, onboarding, billing and child SaaS entry from one shell</li>
              </ul>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-sky-50 p-5">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-700">MVP honesty</div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Campamento Base is the holding-side SaaS core. Billing routes integrate with Stripe when configured; local demo bypass remains isolated to localhost only.
              </p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center">
          <div className="w-full max-w-xl rounded-[32px] border border-slate-200 bg-white p-8 shadow-[0_30px_100px_rgba(15,23,42,0.12)] lg:p-10">
            <div className="mb-8">
              <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-sky-600">
                {invite ? "Team access" : "Workspace setup"}
              </div>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
                {invite ? `Accept invite to ${invite.tenantName}` : "Create your operator account"}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                {invite
                  ? "Use the invited email and set your password once. You will land directly inside the tenant workspace."
                  : "This creates the owner account, the first workspace, the OWNER membership and the authenticated entry into /client."}
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
