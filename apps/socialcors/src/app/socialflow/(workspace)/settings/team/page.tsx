import { listSocialFlowAuthUsersByTenant } from "@/lib/socialflow/platform/auth/repository";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import { redirect } from "next/navigation";

export default async function SocialFlowTeamSettingsPage() {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }

  const members = await listSocialFlowAuthUsersByTenant(session.tenantId);

  const admins = members.filter((m) => m.role === "admin");
  const nonAdmins = members.filter((m) => m.role !== "admin");

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[#3b82f6]">Equipo Socialcors</div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-900">Usuarios del workspace</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
          Esta vista lee los usuarios de Socialcors directamente desde el perímetro de autenticación del producto. La invitación y gestión de roles requiere un flujo nativo antes de habilitar acciones de escritura aquí.
        </p>
      </div>

      {/* Stats */}
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <header className="border-b border-gray-200 px-6 py-5">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#3b82f6]">Registro de autenticación del producto</p>
          <h2 className="mt-1 text-lg font-black uppercase italic tracking-tight text-gray-900">Usuarios registrados en Socialcors para este tenant</h2>
        </header>
        <div className="px-6 py-6">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { label: "Usuarios", value: members.length },
              { label: "Admins", value: admins.length },
              { label: "Miembros", value: nonAdmins.length },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400">{stat.label}</div>
                <div className="mt-3 text-2xl font-black tracking-tight text-gray-900">{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lista de miembros */}
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <header className="border-b border-gray-200 px-6 py-5">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#3b82f6]">Usuarios registrados</p>
          <h2 className="mt-1 text-lg font-black uppercase italic tracking-tight text-gray-900">Solo lectura — el flujo de invitación nativo está pendiente</h2>
        </header>
        <div className="px-6 py-6">
          {members.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-400">
              No se encontraron usuarios de Socialcors para este tenant.
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.id} className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-5">
                  <div>
                    <div className="text-base font-black tracking-tight text-gray-900">{member.name ?? member.email}</div>
                    <div className="mt-1 text-sm text-gray-500">{member.email}</div>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${
                      member.role === "admin"
                        ? "bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/25"
                        : "bg-gray-100 text-gray-500 border border-gray-200"
                    }`}
                  >
                    {member.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
