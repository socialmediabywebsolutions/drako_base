import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import {
  getEmailMessage,
  resolveEmailIntakeContext,
  updateEmailMessageStatus,
  EmailIntakeContextError,
} from "@/lib/email-intake/repository";
import { resolveEconomyContext } from "@/lib/economy/repository";
import { applyEmailAutomations } from "@/lib/email-intake/automation";
import type { EmailClassification, EmailStatus } from "@/lib/email-intake/types";

export const runtime = "edge";

const validClassifications: EmailClassification[] = ["INVOICE", "QUOTE", "SUPPLIER", "LEAD", "OTHER"];
const validStatuses: EmailStatus[] = ["NEW", "REVIEWED", "ARCHIVED", "CONVERTED_TO_EXPENSE", "CONVERTED_TO_LEAD"];

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    const { id } = await params;
    if (!saasId || !id) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId and id are required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveEmailIntakeContext({ tenantId, saasId });
    const message = await getEmailMessage(ctx, id);
    if (!message) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Email no encontrado" }, { status: 404 });
    }
    const economyCtx = await resolveEconomyContext({ tenantId, saasId });
    const automation = await applyEmailAutomations(ctx, message, economyCtx);
    const { message: automationMessage, ...automationRest } = automation;
    return NextResponse.json({ message, automationMessage, ...automationRest });
  } catch (error) {
    if (error instanceof EmailIntakeContextError) {
      return NextResponse.json({ code: "INVALID_EMAIL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("EMAIL_INTAKE_MESSAGE_GET", error);
    return NextResponse.json({ code: "EMAIL_INTAKE_ERROR", message: "No se pudo cargar el email" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json().catch(() => null)) as {
      saasId?: string | null;
      status?: EmailStatus;
      classification?: EmailClassification;
      linkedExpenseId?: string | null;
      linkedCustomerId?: string | null;
    } | null;
    const { id } = await params;
    if (!body?.saasId || !id) {
      return NextResponse.json({ code: "INVALID_BODY", message: "saasId and id are required" }, { status: 400 });
    }
    if (!body.status && !body.classification) {
      return NextResponse.json(
        { code: "INVALID_BODY", message: "classification or status is required" },
        { status: 400 },
      );
    }
    if (body.classification && !validClassifications.includes(body.classification)) {
      return NextResponse.json({ code: "INVALID_BODY", message: "classification is invalid" }, { status: 400 });
    }
    if (body.status && !validStatuses.includes(body.status)) {
      return NextResponse.json({ code: "INVALID_BODY", message: "status is invalid" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveEmailIntakeContext({ tenantId, saasId: body.saasId });
    const updated = await updateEmailMessageStatus(ctx, id, body.status ?? null, {
      classification: body.classification ?? null,
      linkedExpenseId: typeof body.linkedExpenseId === "undefined" ? undefined : body.linkedExpenseId,
      linkedCustomerId: typeof body.linkedCustomerId === "undefined" ? undefined : body.linkedCustomerId,
    });
    return NextResponse.json({ message: updated });
  } catch (error) {
    if (error instanceof EmailIntakeContextError) {
      return NextResponse.json({ code: "INVALID_EMAIL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("EMAIL_INTAKE_MESSAGE_PATCH", error);
    return NextResponse.json({ code: "EMAIL_INTAKE_ERROR", message: "No se pudo actualizar el email" }, { status: 500 });
  }
}
