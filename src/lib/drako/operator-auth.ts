import bcrypt from "bcryptjs";

// Credenciales del único operator del panel de drako.systems. Solo el hash bcrypt (salt
// 10) vive en el repo — la contraseña en claro nunca se commitea ni se loguea.
// OPERATOR_PASSWORD_HASH en el entorno, si existe, sustituye al hash de abajo (rotar
// la contraseña sin redeploy de código).

export const OPERATOR_EMAIL = "socialcors@gmail.com";
export const OPERATOR_PASSWORD_HASH = "$2b$10$j7WZ/WLqRpm1IUFWu8Fbf..oZRSymQFQC/FlV02Z9hq4zsHh4rP9K";

function resolvePasswordHash(): string {
  const fromEnv = typeof process !== "undefined" ? process.env.OPERATOR_PASSWORD_HASH?.trim() : undefined;
  return fromEnv || OPERATOR_PASSWORD_HASH;
}

export function verifyOperatorCredentials(email: string, password: string): boolean {
  if (typeof email !== "string" || typeof password !== "string" || !password) return false;
  // bcrypt se compara siempre, aunque el email no coincida: mismo tiempo de respuesta.
  const passwordOk = bcrypt.compareSync(password, resolvePasswordHash());
  return passwordOk && email.trim().toLowerCase() === OPERATOR_EMAIL;
}
