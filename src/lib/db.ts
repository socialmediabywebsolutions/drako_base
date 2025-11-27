import { env } from "@/lib/cf";

export async function queryAll<T>(sql: string, ...params: unknown[]): Promise<T[]> {
  const e = env();
  if (!e) return [];
  const stmt = e.DRACO_DB.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const res = await bound.all<T>();
  return res.results ?? [];
}

export async function run(sql: string, ...params: unknown[]): Promise<boolean> {
  const e = env();
  if (!e) return false;
  const stmt = e.DRACO_DB.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const res = await bound.run();
  return Boolean(res?.success);
}
