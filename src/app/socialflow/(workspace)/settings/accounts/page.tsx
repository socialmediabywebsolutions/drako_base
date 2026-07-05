import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";

export default async function SocialFlowAccountsSettingsPage() {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-400">Socialcors · Cuentas</div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Cuentas conectadas</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
          La conexión de redes sociales ahora se gestiona desde <strong className="text-white/80">Mis Redes</strong>.
        </p>
      </div>

      <Link
        href="/socialflow/redes"
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-violet-500/20 transition hover:brightness-110"
      >
        Ir a Mis Redes
      </Link>
    </div>
  );
}
