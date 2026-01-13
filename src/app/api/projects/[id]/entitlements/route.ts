import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { respondDatabaseError } from "@/lib/http/errors";
import { getProjectById } from "@/lib/projects/repository";
import {
  getProjectEntitlements,
  upsertProjectEntitlements,
} from "@/lib/projects/entitlements";

export const runtime = "edge";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function authErrorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  return null;
}

function invalidRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

async function loadProjectDetail(tenantId: string, projectId: string) {
  const detail = await getProjectById({ tenantId, projectId });
  if (!detail) {
    return null;
  }
  return detail;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function validateStringArray(value: unknown, field: string, options?: { required?: boolean }): string[] | undefined {
  const required = options?.required ?? false;
  if (value == null) {
    if (required) {
      throw invalidRequest(`${field} es obligatorio`);
    }
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw invalidRequest(`${field} debe ser un arreglo de strings`);
  }
  if (value.length > 200) {
    throw invalidRequest(`${field} excede el máximo de 200 elementos`);
  }
  const invalidItem = value.find((item) => typeof item !== "string");
  if (invalidItem !== undefined) {
    throw invalidRequest(`${field} solo puede contener strings`);
  }
  return value as string[];
}

function validateLimits(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  if (!isPlainObject(value)) {
    throw invalidRequest("limits debe ser un objeto");
  }

  for (const [key, raw] of Object.entries(value)) {
    if (typeof key !== "string" || !key.trim()) {
      throw invalidRequest("limits contiene claves inválidas");
    }
    if (raw == null) {
      throw invalidRequest(`limits[${key}] no puede ser nulo`);
    }
    if (typeof raw === "number") {
      if (!Number.isFinite(raw) || raw < 0) {
        throw invalidRequest(`limits[${key}] debe ser un número mayor o igual a 0`);
      }
      continue;
    }
    if (typeof raw === "string") {
      const parsed = Number(raw);
      if (Number.isNaN(parsed) || !Number.isFinite(parsed) || parsed < 0) {
        throw invalidRequest(`limits[${key}] debe ser numérico`);
      }
      continue;
    }
    throw invalidRequest(`limits[${key}] debe ser numérico`);
  }

  return value as Record<string, unknown>;
}

function validateMetadata(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  if (!isPlainObject(value)) {
    throw invalidRequest("metadata debe ser un objeto");
  }
  try {
    JSON.stringify(value);
  } catch (error) {
    throw invalidRequest("metadata no es serializable");
  }
  return value as Record<string, unknown>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const projectId = id?.trim();
    if (!projectId) {
      return invalidRequest("project_id es obligatorio");
    }

    const { tenantId } = await requireTenantAccess(request);

    const detail = await loadProjectDetail(tenantId, projectId);
    if (!detail) {
      return NextResponse.json({ ok: false, error: "Proyecto no encontrado" }, { status: 404 });
    }

    const entitlements = detail.entitlements ?? (await getProjectEntitlements({ tenantId, projectId }));

    return NextResponse.json({ ok: true, tenantId, projectId, entitlements });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    if (error instanceof Response) return error;
    const dbError = respondDatabaseError(error);
    if (dbError) return dbError;
    const correlationId = globalThis.crypto?.randomUUID?.() ?? `project_entitlements_get_${Date.now()}`;
    console.error("PROJECT_ENTITLEMENTS_GET_ERROR", correlationId, error);
    return NextResponse.json(
      { ok: false, error: "Internal server error", reason: "query_failed", correlationId },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const projectId = id?.trim();
    if (!projectId) {
      return invalidRequest("project_id es obligatorio");
    }

    const { tenantId } = await requireTenantAccess(request);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return invalidRequest("Payload inválido");
    }

    const payload = body as Record<string, unknown>;

    const enabledFeatures = validateStringArray(payload.enabled_features, "enabled_features", { required: true });
    const enabledPacks = validateStringArray(payload.enabled_packs, "enabled_packs", { required: true });
    const limits = validateLimits(payload.limits);
    const metadata = validateMetadata(payload.metadata);

    const detail = await loadProjectDetail(tenantId, projectId);
    if (!detail) {
      return NextResponse.json({ ok: false, error: "Proyecto no encontrado" }, { status: 404 });
    }

    const entitlements = await upsertProjectEntitlements({
      tenantId,
      projectId,
      entitlements: {
        enabledFeatures,
        enabledPacks,
        limits: limits ?? payload.limits,
        metadata,
      },
    });

    return NextResponse.json({ ok: true, tenantId, projectId, entitlements });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    if (error instanceof Response) return error;
    const dbError = respondDatabaseError(error);
    if (dbError) return dbError;
    const correlationId = globalThis.crypto?.randomUUID?.() ?? `project_entitlements_put_${Date.now()}`;
    console.error("PROJECT_ENTITLEMENTS_PUT_ERROR", correlationId, error);
    return NextResponse.json(
      { ok: false, error: "Internal server error", reason: "mutation_failed", correlationId },
      { status: 500 },
    );
  }
}
