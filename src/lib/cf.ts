import { getRequestContext } from "@cloudflare/next-on-pages";

export type DracoEnv = {
  DRACO_DB: D1Database;
};

type CtxWithEnv = { env?: DracoEnv };

export function env(): DracoEnv | null {
  try {
    const ctx = getRequestContext() as unknown as CtxWithEnv;
    return ctx.env ?? null;
  } catch {
    return null;
  }
}
