import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AuthForm } from "@/components/auth/auth-form";
import { authOptions } from "@/lib/auth";
import { safeEnv } from "@/lib/env";

export default async function BasesLoginPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    redirect("/bases");
  }

  const googleOperatorAuthEnabled = Boolean(safeEnv.GOOGLE_CLIENT_ID && safeEnv.GOOGLE_CLIENT_SECRET);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_transparent_42%),linear-gradient(135deg,#f8fafc_0%,#eef6ff_45%,#f8fafc_100%)]">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-10">
        <div className="grid w-full gap-10 lg:grid-cols-[1.1fr,0.9fr]">
          <section className="rounded-[36px] border border-slate-200 bg-slate-950 px-8 py-10 text-white shadow-[0_40px_120px_rgba(15,23,42,0.28)]">
            <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-sky-200">
              Campamento Base Holding
            </div>
            <h1 className="mt-8 text-4xl font-black tracking-tight text-white lg:text-5xl">
              Operator access only.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
              This is the private holding control plane. Product users never authenticate here.
            </p>
          </section>

          <section className="flex items-center justify-center">
            <div className="w-full max-w-xl rounded-[32px] border border-slate-200 bg-white/95 p-8 shadow-[0_30px_100px_rgba(15,23,42,0.12)] backdrop-blur-xl lg:p-10">
              <div className="mb-8">
                <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-sky-600">Operator sign in</div>
                <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Sign in to Campamento Base</h2>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  NextAuth + D1 is the only valid authentication layer for the holding operator surface.
                </p>
              </div>

              <AuthForm
                saasSlug="campo_base"
                authApiBase="/api/auth/workspace"
                postLoginRedirect="/bases"
                allowRegistration={false}
                enableGoogleAuth={googleOperatorAuthEnabled}
                googleButtonLabel="Continue with Google as Operator"
              />

              <div className="mt-8 flex items-center justify-between gap-3 border-t border-slate-100 pt-6 text-sm text-slate-500">
                <span className="font-semibold text-slate-700">Private operator surface</span>
                <Link href="/site" className="transition-colors hover:text-sky-600">
                  Back to site
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
