import { NextResponse } from "next/server";
import {
  SOCIALCORS_CONTRACT_VERSION_HEADER,
  SOCIALCORS_INTERNAL_CONTRACT_VERSION,
  type InternalApiErrorCode,
} from "@/lib/capabilities/internal-api-types/socialflow";
import { validateInternalServiceTokenRequest } from "@/lib/capabilities/internal-api-auth/service-token";

// Helpers comunes de las rutas /api/internal/socialflow/* (P6): toda respuesta, también los
// errores, lleva la versión del contrato.

const CONTRACT_HEADERS = { [SOCIALCORS_CONTRACT_VERSION_HEADER]: SOCIALCORS_INTERNAL_CONTRACT_VERSION };

export function internalJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CONTRACT_HEADERS });
}

export function internalError(code: InternalApiErrorCode, message: string, requestId: string | undefined, status: number) {
  return internalJson({ code, message, ...(requestId ? { requestId } : {}) }, status);
}

export type InternalCaller = { requestId: string; tenantId: string | null };

export function authenticateInternalRequest(
  request: Request,
): { ok: true; caller: InternalCaller } | { ok: false; response: NextResponse } {
  const auth = validateInternalServiceTokenRequest(request);
  if (!auth.ok) return { ok: false, response: internalJson(auth.error, auth.status) };
  return { ok: true, caller: { requestId: auth.requestId, tenantId: auth.tenantId } };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
