import { queryAll } from "@/lib/db";

export type CompanyDomainRecord = {
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

export type CompanyDomainFilters = {
  companyId?: string | null;
  status?: string | null;
};

export type QueryAllFn = <T>(sql: string, ...params: unknown[]) => Promise<T[]>;

export async function listCompanyDomains(
  tenantId: string,
  filters: CompanyDomainFilters = {},
  query: QueryAllFn = queryAll,
): Promise<CompanyDomainRecord[]> {
  const clauses: string[] = ["tenant_id = ?"];
  const params: (string | null)[] = [tenantId];

  if (filters.companyId) {
    clauses.push("company_id = ?");
    params.push(filters.companyId);
  }

  if (filters.status) {
    clauses.push("status = ?");
    params.push(filters.status);
  }

  const whereClause = `WHERE ${clauses.join(" AND ")}`;

  return query<CompanyDomainRecord>(
    `SELECT id, tenant_id, company_id, domain, status, verification_status, verification_reason, retry_count, last_checked_at, created_at, updated_at
     FROM company_domains
     ${whereClause}
     ORDER BY (updated_at IS NULL), datetime(updated_at) DESC, (created_at IS NULL), datetime(created_at) DESC, domain ASC`,
    ...params,
  );
}

export async function listCompanyDomainsForCompany(
  tenantId: string,
  companyId: string,
  query: QueryAllFn = queryAll,
): Promise<CompanyDomainRecord[]> {
  return listCompanyDomains(tenantId, { companyId }, query);
}
