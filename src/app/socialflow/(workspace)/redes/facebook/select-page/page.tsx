import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import { getPendingPageSelection } from "@/lib/socialflow/meta/pending-pages";

export const dynamic = "force-dynamic";

// Pantalla de selección de Página de Facebook — llega aquí el callback de Meta cuando el
// usuario administra varias Páginas (ver meta/oauth.ts). Solo muestra id y nombre; los
// tokens se quedan en el servidor (meta/pending-pages.ts). El formulario envía a
// /api/socialflow/meta/select-page.
export default async function FacebookSelectPagePage({
  searchParams,
}: {
  searchParams?: Promise<{ pending?: string }>;
}) {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }

  const pendingId = (await searchParams)?.pending?.trim() ?? "";
  const selection = pendingId ? await getPendingPageSelection(pendingId, session.tenantId).catch(() => null) : null;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link
        href="/socialflow/redes"
        className="flex items-center gap-1.5 text-sm font-medium text-gray-500 transition hover:text-gray-900"
      >
        <span aria-hidden>←</span> Volver a Mis Redes
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Elige tu Página de Facebook</h1>
        <p className="mt-1 text-sm text-gray-500">
          Administras varias Páginas. Selecciona la que quieres conectar a Socialcors para publicar y ver sus métricas.
        </p>
      </div>

      {!selection ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Esta selección ha caducado o no es válida. Vuelve a{" "}
          <Link href="/socialflow/redes" className="font-semibold underline">
            conectar Facebook
          </Link>{" "}
          desde Mis Redes.
        </div>
      ) : (
        <ul className="space-y-3">
          {selection.pages.map((page) => (
            <li key={page.id}>
              <form action="/api/socialflow/meta/select-page" method="post">
                <input type="hidden" name="pending" value={selection.id} />
                <input type="hidden" name="pageId" value={page.id} />
                <button
                  type="submit"
                  className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
                >
                  <span>
                    <span className="block text-sm font-semibold text-gray-900">{page.name}</span>
                    <span className="block text-xs text-gray-400">ID {page.id}</span>
                  </span>
                  <span className="rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 px-3 py-1.5 text-xs font-bold text-white">
                    Conectar
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
