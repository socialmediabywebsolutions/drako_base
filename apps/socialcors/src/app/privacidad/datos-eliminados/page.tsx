import { env } from "@/lib/cf";
import { getDataDeletionRequestByConfirmationCode } from "@/lib/socialflow/meta/dataDeletionRepository";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ id?: string }>;
};

export default async function DatosEliminadosPage({ searchParams }: PageProps) {
  const { id } = await searchParams;
  const db = env()?.SOCIAL_DB;
  const record = id && db ? await getDataDeletionRequestByConfirmationCode(db, id) : null;

  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400">Socialcors</p>
      <h1 className="mt-3 text-3xl font-black text-slate-900">Estado de la solicitud de eliminación de datos</h1>

      {!id ? (
        <p className="mt-6 text-slate-600">
          No se proporcionó un código de confirmación. Esta página se usa junto con el código que Meta
          entrega tras procesar una solicitud de eliminación de datos.
        </p>
      ) : !record ? (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
          No se encontró ninguna solicitud con el código <code className="font-mono">{id}</code>.
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900">
          <p className="font-bold">Solicitud procesada</p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-emerald-700">Código de confirmación</dt>
              <dd className="font-mono">{record.confirmationCode}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-emerald-700">Fecha de solicitud</dt>
              <dd>{new Date(record.requestedAt).toLocaleString("es-ES")}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-emerald-700">Cuentas de Instagram desconectadas</dt>
              <dd>{record.accountsDeleted}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-emerald-700">Conversaciones eliminadas</dt>
              <dd>{record.threadsDeleted}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-emerald-700">Leads eliminados</dt>
              <dd>{record.leadsDeleted}</dd>
            </div>
          </dl>
        </div>
      )}

      <p className="mt-10 text-sm text-slate-500">
        ¿Preguntas sobre esta solicitud? Escríbenos a{" "}
        <a href="mailto:privacidad@socialcors.com" className="underline">
          privacidad@socialcors.com
        </a>
        .
      </p>
    </main>
  );
}
