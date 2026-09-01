// Fuente única de verdad para PLATFORM_ADMIN_EMAILS — sin otras dependencias a
// propósito (nada de D1, next-auth, etc.) para que sea seguro importarlo tanto
// desde código de servidor (src/lib/auth/session.ts, src/lib/auths/services.ts)
// como desde src/middleware.ts, que corre en el runtime de Edge y no puede
// arrastrar el grafo de imports pesado de session.ts (next-auth/jwt, campamento-core).

function getPlatformAdminEmailAllowlist(): string[] {
  const raw = process.env.PLATFORM_ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

// Puerta de acceso (requireOwnerAccess, middleware /operator|/admin|...): lista
// vacía = no restringir, compat hacia atrás, mismo patrón que
// SOCIALFLOW_PRIVATE_PILOT_TENANT_ALLOWLIST.
export function isPlatformAdminEmailAllowed(email: string): boolean {
  const allowlist = getPlatformAdminEmailAllowlist();
  if (allowlist.length === 0) return true;
  return allowlist.includes(email.trim().toLowerCase());
}

// Concesión de privilegio (resolveRole): a diferencia de isPlatformAdminEmailAllowed,
// una lista vacía nunca debe conceder admin a nadie. Nunca compartir la misma
// función que isPlatformAdminEmailAllowed — solo la misma lista.
export function isPlatformAdminEmail(email: string): boolean {
  return getPlatformAdminEmailAllowlist().includes(email.trim().toLowerCase());
}
