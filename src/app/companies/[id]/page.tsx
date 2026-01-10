import Card from "@/components/ui/card";
import Badge from "@/components/ui/badge";
import EmptyState from "@/components/ui/empty-state";
import { getServerBaseUrl } from "@/lib/http/base-url";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";
import { headers, cookies } from "next/headers";
import Link from "next/link";

export const metadata = {
  title: "Company detail • Campamento Base",
};

type CompanyRecord = {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  created_at: string | null;
};

type CompanyDomainRecord = {
  id: string;
  tenant_id: string;
  company_id: string | null;
  domain: string;
  status: string;
  verification_status: string | null;
  verification_reason: string | null;
  retry_count: number | null;
  last_checked_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ tenantId?: string }>;
};

export default async function CompanyDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const resolvedSearch = searchParams ? await searchParams : undefined;
  const tenantId = resolvedSearch?.tenantId?.trim() || DEMO_TENANT_ID;
  const baseUrl = getServerBaseUrl(await headers());
  const cookieHeader = cookies().toString();
  const qs = `tenantId=${encodeURIComponent(tenantId)}`;
  const tenantHeaders = {
    "x-tenant-id": tenantId,
    ...(cookieHeader ? { cookie: cookieHeader } : {}),
  } satisfies Record<string, string>;

  let company: CompanyRecord | null = null;
  let domains: CompanyDomainRecord[] = [];
  let companyError = false;
  let domainsError = false;

  try {
    const companiesRes = await fetch(`${baseUrl}/api/companies?${qs}`, {
      cache: "no-store",
      headers: tenantHeaders,
    });
    if (companiesRes.ok) {
      const payload = (await companiesRes.json()) as { ok?: boolean; companies?: CompanyRecord[] };
      if (payload.ok && Array.isArray(payload.companies)) {
        company = payload.companies.find((item) => item.id === id) ?? null;
      } else {
        companyError = true;
      }
    } else {
      companyError = true;
    }
  } catch (error) {
    companyError = true;
    console.error("COMPANY_DETAIL_FETCH_COMPANY_ERROR", error);
  }

  try {
    const domainsRes = await fetch(`${baseUrl}/api/companies/${encodeURIComponent(id)}/domains?${qs}`, {
      cache: "no-store",
      headers: tenantHeaders,
    });
    if (domainsRes.ok) {
      const payload = (await domainsRes.json()) as { ok?: boolean; domains?: CompanyDomainRecord[] };
      if (payload.ok && Array.isArray(payload.domains)) {
        domains = payload.domains;
      } else {
        domainsError = true;
      }
    } else {
      domainsError = true;
    }
  } catch (error) {
    domainsError = true;
    console.error("COMPANY_DETAIL_FETCH_DOMAINS_ERROR", error);
  }

  const formattedCreated = company?.created_at
    ? new Date(company.created_at).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[var(--muted)]">Projects Factory · Compat layer</p>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">
            {company ? company.name : "Company detail"}
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Información de compañía y dominios publicados mediante la vista de compatibilidad.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <Badge variant="outline" className="text-[var(--muted)]">
            Compat mode · company_id = saas_id
          </Badge>
          <Link
            href={`/companies?tenantId=${encodeURIComponent(tenantId)}`}
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--muted)] transition hover:bg-[var(--panel)]/50 hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          >
            ← Volver a listado
          </Link>
        </div>
      </div>

      <Card
        tone="glass"
        title="Ficha de compañía"
        subtitle="Datos consumidos desde /api/companies"
        bodyClassName="space-y-3"
      >
        {company ? (
          <div className="grid gap-3 text-sm text-[var(--muted)] sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]/70">Identificadores</p>
              <p className="mt-1 font-mono text-[var(--foreground)]">{company.id}</p>
              <p className="font-mono text-[var(--muted)]/90">slug: {company.slug ?? "sin-slug"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]/70">Creado</p>
              <p className="mt-1 text-[var(--foreground)]">{formattedCreated ?? "Sin registro"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]/70">Descripción</p>
              <p className="mt-1 leading-relaxed text-[var(--muted)]/90">
                {company.description ?? "Sin descripción disponible"}
              </p>
            </div>
          </div>
        ) : companyError ? (
          <EmptyState
            title="No se pudo recuperar la compañía"
            subtitle="Verifica el ID o revisa los logs del endpoint /api/companies."
          />
        ) : (
          <EmptyState
            title="Cargando información de la compañía"
            subtitle="Este panel requiere datos del catálogo de compatibilidad."
          />
        )}
      </Card>

      <Card
        tone="glass"
        title="Dominios publicados"
        subtitle="Datos consumidos desde /api/companies/{id}/domains"
        bodyClassName="space-y-3"
      >
        {domains.length > 0 ? (
          <div className="grid gap-3">
            {domains.map((domain) => {
              const updatedAt = domain.updated_at
                ? new Date(domain.updated_at).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })
                : null;
              const lastChecked = domain.last_checked_at
                ? new Date(domain.last_checked_at).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })
                : null;
              return (
                <section
                  key={domain.id}
                  className="rounded-2xl border border-[var(--border)]/60 bg-[var(--panel)]/70 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base font-semibold text-[var(--foreground)]">{domain.domain}</h2>
                    <Badge variant="neutral" className="text-[10px] uppercase tracking-[0.3em]">
                      {domain.status}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-[var(--muted)]/90">
                    company_id: <span className="font-mono text-[var(--foreground)]/80">{domain.company_id ?? "—"}</span>
                  </p>
                  <div className="mt-3 grid gap-2 text-xs text-[var(--muted)] sm:grid-cols-2">
                    <p>
                      Última verificación: {lastChecked ?? "Sin registro"}
                    </p>
                    <p>
                      Última actualización: {updatedAt ?? "Sin registro"}
                    </p>
                  </div>
                  {(domain.verification_status || domain.verification_reason) && (
                    <p className="mt-3 text-xs text-[var(--muted)]/80">
                      Verificación: {domain.verification_status ?? "pendiente"}
                      {domain.verification_reason ? ` · ${domain.verification_reason}` : ""}
                    </p>
                  )}
                </section>
              );
            })}
          </div>
        ) : domainsError ? (
          <EmptyState
            title="No se pudo recuperar la información de dominios"
            subtitle="Verifica el ID o revisa los logs del endpoint /api/companies/{id}/domains."
          />
        ) : (
          <EmptyState
            title="Sin dominios registrados"
            subtitle="Cuando la compañía publique dominios compatibles aparecerán aquí."
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)]/60 pt-3 text-xs text-[var(--muted)]">
          <p>Datos extraídos desde company_domains (compat).</p>
          <Badge variant="outline" className="text-[var(--muted)]">
            Compat mode · company_id = saas_id
          </Badge>
        </div>
      </Card>
    </div>
  );
}
