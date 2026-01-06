import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { createEmailMessage, resolveEmailIntakeContext, EmailIntakeContextError } from "@/lib/email-intake/repository";
import { resolveEconomyContext } from "@/lib/economy/repository";
import { applyEmailAutomations } from "@/lib/email-intake/automation";
export const runtime = "edge";


const demoEmails = [
  {
    fromAddress: "facturas@endesa.com",
    fromName: "Endesa",
    subject: "Factura luz abril",
    snippet: "Factura de electricidad por 210,10 €.",
    body: "Adjuntamos la factura de luz del mes. Importe total: 210,10 €.",
  },
  {
    fromAddress: "ofertas@proveedorcolor.com",
    fromName: "Proveedor Color",
    subject: "Oferta tinte morado 8,90 €",
    snippet: "Tarifa especial para tinte morado.",
    body: "Tinte morado a 8,90 € por unidad. Oferta limitada.",
  },
  {
    fromAddress: "ana.lead@example.com",
    fromName: "Ana Ruiz",
    subject: "Quiero pedir cita para corte",
    snippet: "Hola, me gustaria reservar un corte.",
    body: "Quiero pedir hora para corte de pelo la semana que viene.",
  },
];

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveEmailIntakeContext({ tenantId, saasId });
    const economyCtx = await resolveEconomyContext({ tenantId, saasId });
    const created = [];
    for (const email of demoEmails) {
      const message = await createEmailMessage(ctx, {
        saasId,
        fromAddress: email.fromAddress,
        fromName: email.fromName,
        subject: email.subject,
        snippet: email.snippet,
        body: email.body,
        receivedAt: new Date().toISOString(),
      });
      await applyEmailAutomations(ctx, message, economyCtx);
      created.push(message);
    }
    return NextResponse.json({ items: created, count: created.length });
  } catch (error) {
    if (error instanceof EmailIntakeContextError) {
      return NextResponse.json({ code: "INVALID_EMAIL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("EMAIL_INTAKE_SEED_ERROR", error);
    return NextResponse.json({ code: "EMAIL_INTAKE_ERROR", message: "No se pudo crear emails demo" }, { status: 500 });
  }
}
