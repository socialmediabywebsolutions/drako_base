import { env as resolveEnv, type DracoEnv } from "@/lib/cf";

function readEnvValue(key: string, envOverride?: DracoEnv | null): string {
  const fromBindingRaw = envOverride
    ? (envOverride as unknown as Record<string, unknown>)[key]
    : undefined;
  const fromBinding = typeof fromBindingRaw === "string" ? fromBindingRaw : undefined;
  const fromProcess = typeof process !== "undefined" ? process.env[key] : undefined;
  return (fromBinding ?? fromProcess ?? "").trim().toLowerCase();
}

export function isProductionEnvironment(envOverride?: DracoEnv | null): boolean {
  const runtimeEnv = envOverride ?? resolveEnv();

  const environment = readEnvValue("ENVIRONMENT", runtimeEnv);
  if (environment === "production" || environment === "prod") return true;

  const pagesEnvironment = readEnvValue("CF_PAGES_ENVIRONMENT", runtimeEnv);
  if (pagesEnvironment === "production") return true;

  const nodeEnv = readEnvValue("NODE_ENV", runtimeEnv);
  return nodeEnv === "production";
}
