import Link from "next/link";

export const dynamic = "force-static";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center space-y-4">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">DRĀKO.SYSTEMS</p>
        <h1 className="text-3xl font-semibold">Página no encontrada</h1>
        <p className="text-sm text-[var(--muted)]">
          La ruta que has abierto no existe o ya no está disponible.
        </p>
        <div className="flex items-center justify-center gap-3 text-sm">
          <Link
            href="/admin"
            className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--panel)] px-4 py-1.5 font-medium hover:border-[var(--foreground)] transition"
          >
            Volver al panel de administración
          </Link>
          <Link
            href="/site"
            className="inline-flex items-center rounded-full border border-transparent px-4 py-1.5 text-[var(--muted)] hover:text-[var(--foreground)] transition"
          >
            Ir al sitio público
          </Link>
        </div>
      </div>
    </div>
  );
}
