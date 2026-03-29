export function getMentoriaDb(env?: any) {
  // Preferred: dedicated Mentoria DB
  if (env?.MENTORIA_DB) {
    return env.MENTORIA_DB;
  }

  // Fallback for legacy/tests
  if (env?.DRACO_DB) {
    return env.DRACO_DB;
  }

  // Last fallback: global test DB (used in vitest)
  if ((globalThis as any).__TEST_DB__) {
    return (globalThis as any).__TEST_DB__;
  }

  throw new Error("DB_BINDING_REQUIRED");
}
