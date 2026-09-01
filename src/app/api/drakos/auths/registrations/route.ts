export const dynamic = "force-dynamic";

import { jsonError } from "@/lib/auths/http";

// Auditoría de seguridad 2026-09-01: drako.systems es la superficie de founder/admin
// (/operator, /admin, /clients...) — nunca debió tener registro público de
// autoservicio. Deshabilitado sin condiciones: ni siquiera un email ya presente en
// PLATFORM_ADMIN_EMAILS puede autoregistrarse desde aquí, para no dejar una vía de
// creación de cuentas alcanzable con un POST directo (curl/Postman), pasando por
// alto la UI (que ya no ofrece la pestaña "Crear cuenta", ver /auth/login/page.tsx).
// Alta de cuentas de founder/admin: fuera de esta ruta, por un canal interno.
//
// La ruta se conserva (en vez de borrar el archivo) porque
// scripts/lib/auth-ssot-audit.ts exige que /api/drakos/auths/registrations exista
// como endpoint registrado.
export async function POST() {
  return jsonError("REGISTRATION_DISABLED", "Public registration is disabled for this context.", 403);
}
