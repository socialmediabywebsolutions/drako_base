import { queryAll } from "@/lib/db";

export type QueryAllFn = <T>(sql: string, ...params: unknown[]) => Promise<T[]>;

export type CompanyRecord = {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  created_at: string | null;
};

// Vista compat company_id = saas_id: DRACO_DB nunca tuvo tabla `companies` (la query
// original fallaba con "no such table" y /companies mostraba "No se pudieron cargar las
// compañías"), así que las compañías se leen de `saas`. El dominio público hace de
// descripción.
export async function listCompanies(query: QueryAllFn = queryAll): Promise<CompanyRecord[]> {
  return query<CompanyRecord>(
    `SELECT id, slug, name, COALESCE(public_domain, domain) AS description, created_at
     FROM saas
     ORDER BY name ASC`,
  );
}
