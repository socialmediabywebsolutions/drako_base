import type { NextRequest } from "next/server";

export type EffectiveHost = {
  effectiveHost: string;
  realHost: string;
  shouldPersistCookie: string | null;
};

function isLocalHost(host: string) {
  return host === "127.0.0.1" || host === "localhost";
}

function normalizeHost(value: string): string {
  const raw = value.split(",")[0]?.trim().toLowerCase() ?? "";
  const host = raw.split(":")[0] ?? "";
  return host.startsWith("www.") ? host.slice(4) : host;
}

export function resolveEffectiveHost(req: NextRequest): EffectiveHost {
  const forwarded = req.headers.get("x-forwarded-host");
  const hostHeader = req.headers.get("host");
  const realHost = normalizeHost(hostHeader ?? "");
  const forwardedHost = normalizeHost(forwarded ?? "");
  const effectiveBase = forwardedHost || realHost || "localhost";
  const isLocal = isLocalHost(effectiveBase);
  const isProd = process.env.NODE_ENV === "production";
  let override: string | null = null;
  let shouldPersist = false;

  if (!isProd && isLocal) {
    const param = req.nextUrl.searchParams.get("__drako_host");
    const cookie = req.cookies.get("drako_host")?.value;
    if (param) {
      override = normalizeHost(param);
      shouldPersist = true;
    } else if (cookie) {
      override = normalizeHost(cookie);
    } else {
      override = "drako.systems";
    }
  }

  return {
    effectiveHost: override ?? effectiveBase,
    realHost,
    shouldPersistCookie: shouldPersist && override ? override : null,
  };
}
