import { env as resolveEnv } from "@/lib/cf";

export function getMentoriaDb(env?: any) {
  const runtimeEnv = env ?? resolveEnv();

  if (runtimeEnv?.MENTORIA_DB) {
    return runtimeEnv.MENTORIA_DB;
  }

  if ((globalThis as any).__TEST_DB__) {
    return (globalThis as any).__TEST_DB__;
  }

  throw new Error("MENTORIA_DB binding is required for Mentoria product runtime");
}
