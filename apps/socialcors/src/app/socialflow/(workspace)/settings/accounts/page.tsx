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
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[#3b82f6]">Socialcors · Cuentas</div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-900">Cuentas conectadas</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
          La conexión de redes sociales ahora se gestiona desde <strong className="text-gray-700">Mis Redes</strong>.
        </p>
      </div>

      <Link
        href="/socialflow/redes"
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-[#3b82f6]/20 transition hover:brightness-110"
      >
        Ir a Mis Redes
      </Link>
    </div>
  );
}
