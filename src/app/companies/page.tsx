import Card from "@/components/ui/card";
import Badge from "@/components/ui/badge";
import EmptyState from "@/components/ui/empty-state";
import { headers, cookies } from "next/headers";
import Link from "next/link";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";
import { getServerBaseUrl } from "@/lib/http/base-url";

export const metadata = {
  title: "Companies • Campamento Base",
};

type CompanyRecord = {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  created_at: string | null;
};

type PageProps = {
  searchParams?: Promise<{ tenantId?: string }>;
};

export default async function CompaniesPage({ searchParams }: PageProps) {
  const resolvedSearch = searchParams ? await searchParams : undefined;
  const tenantId = resolvedSearch?.tenantId?.trim() || DEMO_TENANT_ID;
  const baseUrl = getServerBaseUrl(await headers());
  const cookieHeader = cookies().toString();
  const qs = `tenantId=${encodeURIComponent(tenantId)}`;

  let companies: CompanyRecord[] = [];
  let hadError = false;

  try {
    const res = await fetch(`${baseUrl}/api/companies?${qs}`, {
      cache: "no-store",
      headers: {
        "x-tenant-id": tenantId,
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
    });
    if (res.ok) {
      const payload = (await res.json()) as { ok?: boolean; companies?: CompanyRecord[] };
      if (payload.ok && Array.isArray(payload.companies)) {
        companies = payload.companies;
      } else {
        hadError = true;
      }
    } else {
      hadError = true;
    }
  } catch (error) {
    console.error("COMPANIES_PAGE_FETCH_ERROR", error);
    hadError = true;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[var(--muted)]">Projects Factory · Compat layer</p>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Companies (read-only)</h1>
          <p className="text-sm text-[var(--muted)]">
            Vista paralela al catálogo legacy. Solo lectura mientras company_id = saas_id.
          </p>
        </div>
        <Badge variant="outline" className="text-[var(--muted)]">
          Compat mode · company_id = saas_id
        </Badge>
      </header>

      <Card
        tone="glass"
        title="Contexto de compatibilidad"
        subtitle="Seguimos sirviendo el catálogo legacy mientras avanzamos al Projects Factory."
        bodyClassName="space-y-3"
      >
        <p className="text-sm text-[var(--muted)]">
          Esta vista consume <code className="text-[var(--foreground)]/80">/api/companies</code> y mantiene la equivalencia
          temporal <strong>company_id = saas_id</strong>. Úsala para auditar datos antes de migrar la UI principal.
        </p>
        <div className="flex flex-col gap-2 text-xs text-[var(--muted)] md:flex-row md:items-center md:justify-between">
          <span>
            Tenant activo: <code className="text-[var(--foreground)]/80">{tenantId}</code>
          </span>
          <Link href="/departments" className="text-[var(--brand)] hover:underline">
            Mantener departamentos visibles en paralelo →
          </Link>
        </div>
      </Card>

      {companies.length === 0 ? (
        <EmptyState
          title={hadError ? "No se pudieron cargar las compañías" : "Sin compañías registradas"}
          subtitle={
            hadError
              ? "Revisa los logs del endpoint /api/companies o el binding DRACO_DB."
              : "Cuando existan compañías en la vista compat aparecerán aquí."
          }
        >
          <Link
            href="/departments"
            className="relative inline-flex items-center justify-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--brand-strong)] bg-[var(--brand-quiet)] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--brand)] hover:bg-[var(--brand-quiet)]/80"
          >
            Ver departamentos legacy
          </Link>
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {companies.map((company) => (
            <Card
              key={company.id}
              className="border border-[var(--border)]/70 bg-[var(--panel)]/80"
              title={company.name}
              subtitle={company.description ?? "Sin descripción"}
              right={
                <span className="text-[11px] font-mono text-[var(--muted)]">
                  ID: <span className="text-[var(--foreground)]">{company.id}</span>
                </span>
              }
              actions={
                <Link
                  href={`/companies/${encodeURIComponent(company.id)}?tenantId=${encodeURIComponent(tenantId)}`}
                  className="relative inline-flex items-center justify-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--brand-strong)] bg-[var(--brand-quiet)] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--brand)] hover:bg-[var(--brand-quiet)]/80"
                >
                  Ver dominios
                </Link>
              }
              bodyClassName="space-y-3"
            >
              <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <Badge variant="neutral" className="text-[10px] uppercase tracking-[0.3em]">
                  {company.slug ?? "sin-slug"}
                </Badge>
                {company.created_at && (
                  <span>
                    Creado el {new Date(company.created_at).toLocaleDateString("es-ES", { dateStyle: "medium" })}
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
