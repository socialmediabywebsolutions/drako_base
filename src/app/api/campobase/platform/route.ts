export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireOwnerAccess, UnauthorizedError } from "@/lib/auth/session";
import {
  executePlatformIntegrationOperation,
  getPlatformOperatorSurface,
  refreshPlatformOperatorSurface,
  resolvePlatformOperatorError,
  runPlatformAutomationAction,
  setPlatformAutomationEnabled,
  validatePlatformIntegration,
} from "@/lib/campobase/platform-operator-service";

type PlatformOperatorAction =
  | { action: "refresh"; tenantId: string; saasId: string }
  | { action: "run_automation"; tenantId: string; saasId: string; automationKey: string }
  | { action: "enable_automation"; tenantId: string; saasId: string; automationKey: string }
  | { action: "disable_automation"; tenantId: string; saasId: string; automationKey: string }
  | { action: "validate_integration"; tenantId: string; saasId: string; integrationKey: string }
  | {
      action: "execute_integration_operation";
      tenantId: string;
      saasId: string;
      integrationKey: string;
      operationKey: string;
      payload?: Record<string, unknown> | null;
    };

function requireIdentity(url: URL) {
  const tenantId = url.searchParams.get("tenantId")?.trim() ?? "";
  const saasId = url.searchParams.get("saasId")?.trim() ?? "";

  if (!tenantId || !saasId) {
    return null;
  }

  return { tenantId, saasId };
}

function validateAction(body: unknown): PlatformOperatorAction | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const action = "action" in body ? body.action : null;
  const tenantId = "tenantId" in body && typeof body.tenantId === "string" ? body.tenantId.trim() : "";
  const saasId = "saasId" in body && typeof body.saasId === "string" ? body.saasId.trim() : "";
  const automationKey = "automationKey" in body && typeof body.automationKey === "string"
    ? body.automationKey.trim()
    : "";
  const integrationKey = "integrationKey" in body && typeof body.integrationKey === "string"
    ? body.integrationKey.trim()
    : "";
  const operationKey = "operationKey" in body && typeof body.operationKey === "string"
    ? body.operationKey.trim()
    : "";
  const payload = "payload" in body && body.payload && typeof body.payload === "object"
    ? body.payload as Record<string, unknown>
    : null;

  if (!tenantId || !saasId) {
    return null;
  }

  if (action === "refresh") {
    return { action, tenantId, saasId };
  }

  if ((action === "run_automation" || action === "enable_automation" || action === "disable_automation") && automationKey) {
    return { action, tenantId, saasId, automationKey };
  }

  if (action === "validate_integration" && integrationKey) {
    return { action, tenantId, saasId, integrationKey };
  }

  if (action === "execute_integration_operation" && integrationKey && operationKey) {
    return { action, tenantId, saasId, integrationKey, operationKey, payload };
  }

  return null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    await requireOwnerAccess(request);
    const identity = requireIdentity(url);

    if (!identity) {
      return NextResponse.json(
        { code: "PLATFORM_OPERATOR_IDENTITY_REQUIRED", message: "tenantId and saasId are required" },
        { status: 400 },
      );
    }

    const surface = await getPlatformOperatorSurface(identity.tenantId, identity.saasId);
    return NextResponse.json({ surface });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }

    const resolved = resolvePlatformOperatorError(error);
    console.error("CAMPOBASE_PLATFORM_OPERATOR_GET_ERROR", {
      code: resolved.code,
      message: resolved.message,
      tenantId: url.searchParams.get("tenantId"),
      saasId: url.searchParams.get("saasId"),
      cause: error,
    });
    return NextResponse.json(resolved, { status: resolved.status });
  }
}

export async function POST(request: Request) {
  try {
    await requireOwnerAccess(request);
    const action = validateAction(await request.json().catch(() => null));

    if (!action) {
      return NextResponse.json(
        { code: "PLATFORM_OPERATOR_INVALID_ACTION", message: "Invalid action payload" },
        { status: 400 },
      );
    }

    let result: unknown = null;

    if (action.action === "refresh") {
      const surface = await refreshPlatformOperatorSurface(action.tenantId, action.saasId);
      return NextResponse.json({ action: action.action, surface, result: null });
    }

    if (action.action === "run_automation") {
      result = await runPlatformAutomationAction(action);
    } else if (action.action === "enable_automation") {
      result = await setPlatformAutomationEnabled({ ...action, enabled: true });
    } else if (action.action === "disable_automation") {
      result = await setPlatformAutomationEnabled({ ...action, enabled: false });
    } else if (action.action === "validate_integration") {
      result = await validatePlatformIntegration(action);
    } else if (action.action === "execute_integration_operation") {
      result = await executePlatformIntegrationOperation(action);
    }

    const surface = await getPlatformOperatorSurface(action.tenantId, action.saasId);
    return NextResponse.json({ action: action.action, result, surface });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }

    const resolved = resolvePlatformOperatorError(error);
    console.error("CAMPOBASE_PLATFORM_OPERATOR_POST_ERROR", {
      code: resolved.code,
      message: resolved.message,
      cause: error,
    });
    return NextResponse.json(resolved, { status: resolved.status });
  }
}
