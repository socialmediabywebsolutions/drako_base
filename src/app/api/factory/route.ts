export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireOwnerAccess, UnauthorizedError } from "@/lib/auth/session";
import {
  archiveFactoryControlPlaneSaas,
  getFactoryControlPlaneItem,
  listFactoryControlPlane,
  setFactoryControlPlaneStatus,
} from "@/lib/factory/control-plane";
import type { FactorySaasStatus } from "@/lib/factory/registry";

type FactoryAction =
  | { action: "set_status"; saasId: string; status: FactorySaasStatus }
  | { action: "archive"; saasId: string };

function readSaasId(url: URL): string | null {
  const saasId = url.searchParams.get("saasId")?.trim() ?? "";
  return saasId || null;
}

function validateAction(body: unknown): FactoryAction | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const action = "action" in body ? body.action : null;
  const saasId = "saasId" in body && typeof body.saasId === "string" ? body.saasId.trim() : "";
  const status = "status" in body && typeof body.status === "string" ? body.status.trim() : "";

  if (!saasId) {
    return null;
  }

  if (action === "archive") {
    return { action, saasId };
  }

  if (action === "set_status" && ["ACTIVE", "DISABLED", "DEGRADED", "ARCHIVED"].includes(status)) {
    return { action, saasId, status: status as FactorySaasStatus };
  }

  return null;
}

function resolveFactoryError(error: unknown): {
  status: number;
  code: string;
  message: string;
} {
  if (error instanceof Error && error.message === "FACTORY_SAAS_NOT_FOUND") {
    return { status: 404, code: error.message, message: "Factory SaaS was not found." };
  }

  if (error instanceof Error && error.message.startsWith("FACTORY_")) {
    return { status: 400, code: error.message, message: error.message };
  }

  return {
    status: 500,
    code: "FACTORY_CONTROL_PLANE_UNEXPECTED_ERROR",
    message: error instanceof Error ? error.message : "Unexpected factory control plane error",
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  try {
    await requireOwnerAccess(request);
    const saasId = readSaasId(url);

    if (saasId) {
      const item = await getFactoryControlPlaneItem(saasId);
      if (!item) {
        return NextResponse.json(
          { code: "FACTORY_SAAS_NOT_FOUND", message: "Factory SaaS was not found." },
          { status: 404 },
        );
      }
      return NextResponse.json({ item });
    }

    const items = await listFactoryControlPlane();
    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }

    const resolved = resolveFactoryError(error);
    return NextResponse.json(resolved, { status: resolved.status });
  }
}

export async function POST(request: Request) {
  try {
    await requireOwnerAccess(request);
    const action = validateAction(await request.json().catch(() => null));

    if (!action) {
      return NextResponse.json(
        { code: "FACTORY_CONTROL_PLANE_INVALID_ACTION", message: "Invalid factory action payload." },
        { status: 400 },
      );
    }

    const item = action.action === "archive"
      ? await archiveFactoryControlPlaneSaas(action.saasId)
      : await setFactoryControlPlaneStatus(action.saasId, action.status);

    return NextResponse.json({ action: action.action, item });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }

    const resolved = resolveFactoryError(error);
    return NextResponse.json(resolved, { status: resolved.status });
  }
}
