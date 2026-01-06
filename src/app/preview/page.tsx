import Link from "next/link";
import { headers } from "next/headers";

export default async function PreviewHub() {
  const headersList = await headers();
  const host = headersList.get("host") ?? "";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-12 text-white">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Environment Preview</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Drako Base Preview</h1>
        <p className="mt-3 max-w-2xl text-base text-slate-300">
          This preview environment is limited to diagnostics and public surfaces. Campamento Base admin is not exposed
          on pages.dev.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Request</p>
        <p className="mt-2 text-sm text-slate-200">Host: {host || "(unknown)"}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/api/health"
          className="rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-4 text-sm font-semibold text-white transition hover:border-slate-600"
        >
          View /api/health
        </Link>
        <Link
          href="/api/diag"
          className="rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-4 text-sm font-semibold text-white transition hover:border-slate-600"
        >
          View /api/diag
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6 text-sm text-slate-300">
        <p className="font-semibold text-white">Next steps</p>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>Verify D1 bindings in Pages settings (DRACO_DB for Production and Preview).</li>
          <li>Validate host routing on drako.systems and base.drako.systems after DNS is live.</li>
        </ul>
      </div>
    </div>
  );
}
