import { env } from "@/lib/cf";

function isLocalHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

export function getRequestBaseUrl(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim() || url.host;
  const forwardedProto = request.headers.get("x-forwarded-proto")?.trim();
  const proto = forwardedProto || url.protocol.replace(/:$/, "") || "https";

  if (host && !isLocalHost(host.split(":")[0] ?? host)) {
    return `${proto}://${host}`.replace(/\/$/, "");
  }

  const envUrl =
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    env()?.APP_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.replace(/\/$/, "");
  }
  const originHeader = request.headers.get("origin");
  if (originHeader) {
    return originHeader.replace(/\/$/, "");
  }
  return `${url.protocol}//${url.host}`;
}

export function getServerBaseUrl(headers: Headers): string {
  const forwardedHost = headers.get("x-forwarded-host")?.trim();
  const host = forwardedHost || headers.get("host")?.trim();
  const forwardedProto = headers.get("x-forwarded-proto")?.trim();
  const proto = forwardedProto || "https";
  if (host) {
    return `${proto}://${host}`;
  }
  const envUrl =
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    env()?.APP_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}
