import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import {
  createEmailMessage,
  getEmailIntakeSnapshot,
  listEmailMessages,
  resolveEmailIntakeContext,
  EmailIntakeContextError,
} from "@/lib/email-intake/repository";
import { resolveEconomyContext } from "@/lib/economy/repository";
import { applyEmailAutomations } from "@/lib/email-intake/automation";
import type { EmailClassification, EmailStatus } from "@/lib/email-intake/types";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    const classification = url.searchParams.get("classification") as EmailClassification | null;
    const status = url.searchParams.get("status") as EmailStatus | null;
    const search = url.searchParams.get("search");
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveEmailIntakeContext({ tenantId, saasId });
    const [items, snapshot] = await Promise.all([
      listEmailMessages(ctx, { classification, status, search }),
      getEmailIntakeSnapshot(ctx),
    ]);
    return NextResponse.json({ items, snapshot, count: items.length });
  } catch (error) {
    if (error instanceof EmailIntakeContextError) {
      return NextResponse.json({ code: "INVALID_EMAIL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("EMAIL_INTAKE_MESSAGES_GET", error);
    return NextResponse.json({ code: "EMAIL_INTAKE_ERROR", message: "No se pudieron cargar los emails" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      saasId?: string | null;
      fromAddress?: string;
      fromName?: string | null;
      toAddress?: string | null;
      subject?: string | null;
      snippet?: string | null;
      body?: string | null;
      receivedAt?: string;
    } | null;
    if (!body?.saasId || !body.fromAddress || !body.receivedAt) {
      return NextResponse.json(
        { code: "INVALID_BODY", message: "saasId, fromAddress and receivedAt are required" },
        { status: 400 },
      );
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveEmailIntakeContext({ tenantId, saasId: body.saasId });
    const message = await createEmailMessage(ctx, {
      saasId: body.saasId,
      fromAddress: body.fromAddress,
      fromName: body.fromName ?? null,
      toAddress: body.toAddress ?? null,
      subject: body.subject ?? null,
      snippet: body.snippet ?? null,
      body: body.body ?? null,
      receivedAt: body.receivedAt,
    });
    const economyCtx = await resolveEconomyContext({ tenantId, saasId: body.saasId });
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
    console.error("EMAIL_INTAKE_MESSAGES_POST", error);
    return NextResponse.json({ code: "EMAIL_INTAKE_ERROR", message: "No se pudo registrar el email" }, { status: 500 });
  }
}
