import { queryAll } from "@/lib/db";

export type QueryAllFn = <T>(sql: string, ...params: unknown[]) => Promise<T[]>;

export type CompanyRecord = {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  created_at: string | null;
};

export async function listCompanies(query: QueryAllFn = queryAll): Promise<CompanyRecord[]> {
  return query<CompanyRecord>("SELECT id, slug, name, description, created_at FROM companies ORDER BY name ASC");
}
