// Copia de src/lib/cloudflare/runtime.ts para SocialCors (P5). El holding conserva el original; no se comparten módulos.
import { getCloudflareContext } from "@opennextjs/cloudflare";

export function isBuildPhase(): boolean {
  if (typeof process === "undefined" || !process.env) {
    return false;
  }

  const lifecycle = process.env.npm_lifecycle_event;

  return (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.OPENNEXT_PHASE === "build" ||
    lifecycle === "build" ||
    lifecycle === "build:factory" ||
    (process.env.CI === "true" && (lifecycle === "build" || lifecycle === "build:factory"))
  );
}

export function isCloudflareRuntimeAvailable(): boolean {
  if (isBuildPhase()) {
    return false;
  }

  if (typeof process !== "undefined" && process.env?.CF_PAGES === "1") {
    return false;
  }

  return true;
}

export async function getCloudflareContextSafeAsync(): Promise<unknown | null> {
  if (!isCloudflareRuntimeAvailable()) {
    return null;
  }

  try {
    return getCloudflareContext();
  } catch {
    return null;
  }
}

export function getCloudflareContextSafeSync(): unknown | null {
  if (!isCloudflareRuntimeAvailable()) {
    return null;
  }

  try {
    return getCloudflareContext();
  } catch {
    return null;
  }
}
