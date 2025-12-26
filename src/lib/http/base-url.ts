import { env } from "@/lib/cf";

export function getRequestBaseUrl(request: Request): string {
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
  const url = new URL(request.url);
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
