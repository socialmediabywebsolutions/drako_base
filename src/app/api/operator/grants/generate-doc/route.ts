export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireOwnerAccess, UnauthorizedError } from "@/lib/auth/session";
import { queryAll, run } from "@/lib/db";
import { runAi } from "@/lib/ai/client";

type GrantRow = {
  id: string;
  name: string;
  entity: string;
  description: string | null;
  requirements: string | null;
  ai_summary: string | null;
  documents_generated: string | null;
};

type OwnerRow = { name: string | null; nif: string | null; email: string | null; address: string | null };
type SaasRow = { name: string };

const DOC_SYSTEM_PROMPT = `Eres un experto en redacción de solicitudes para ayudas y subvenciones públicas en España.
Generas documentos profesionales, claros y adaptados exactamente a los requisitos de cada convocatoria.
El documento debe estar en español, ser formal y destacar los puntos fuertes del proyecto.
Estructura el documento con secciones claras usando encabezados markdown (##).`;

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireOwnerAccess(req);
    const body = (await req.json().catch(() => null)) as { grantId: string; docType?: string } | null;
    if (!body?.grantId) {
      return NextResponse.json({ ok: false, error: "grantId is required" }, { status: 400 });
    }

    const [grantRows, ownerRows, saasRows] = await Promise.all([
      queryAll<GrantRow>(
        "SELECT id, name, entity, description, requirements, ai_summary, documents_generated FROM operator_grants WHERE id = ? AND tenant_id = ? LIMIT 1",
        body.grantId, tenantId
      ),
      queryAll<OwnerRow>(
        "SELECT name, nif, email, address FROM owners WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1",
        tenantId
      ),
      queryAll<SaasRow>(
        "SELECT name FROM saas WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 5",
        tenantId
      ).catch(() => [] as SaasRow[]),
    ]);

    const grant = grantRows[0];
    if (!grant) return NextResponse.json({ ok: false, error: "Grant not found" }, { status: 404 });

    const owner = ownerRows[0] ?? null;
    const docType = body.docType ?? "memoria_proyecto";

    const userPrompt = `Genera una ${docType === "solicitud" ? "solicitud formal" : "memoria técnica del proyecto"} para la siguiente ayuda:

AYUDA:
- Nombre: ${grant.name}
- Organismo: ${grant.entity}
- Descripción: ${grant.description ?? "No especificada"}
- Requisitos: ${grant.requirements ?? "No especificados"}
- Por qué aplica: ${grant.ai_summary ?? "Empresa tecnológica española con múltiples SaaS"}

DATOS DEL SOLICITANTE:
- Empresa: ${owner?.name ?? "Drako Sistemas Tecnológicos S.L."}
- NIF: ${owner?.nif ?? "Pendiente"}
- Email: ${owner?.email ?? "admin@drako.systems"}
- Dirección: ${owner?.address ?? "España"}
- Productos: ${saasRows.map((s) => s.name).join(", ") || "SaaS de IA especializados"}
- Sector: Tecnología / SaaS / Inteligencia Artificial

Genera el documento completo, listo para presentar. Usa secciones con encabezados ##.`;

    const aiResp = await runAi({
      messages: [
        { role: "system", content: DOC_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      tenantId,
      saasId: null,
      agentId: "grants-doc-agent",
      department: "fiscal",
      plan: null,
      mode: "smart",
    });

    if (!aiResp.ok || !aiResp.content) {
      return NextResponse.json({ ok: false, error: "AI no disponible" }, { status: 503 });
    }

    // Actualizar el campo documents_generated
    const existing = grant.documents_generated ? (JSON.parse(grant.documents_generated) as { type: string; createdAt: string }[]) : [];
    existing.push({ type: docType, createdAt: new Date().toISOString() });
    await run(
      "UPDATE operator_grants SET documents_generated = ?, status = CASE WHEN status = 'IDENTIFIED' THEN 'EVALUATING' ELSE status END, updated_at = ? WHERE id = ? AND tenant_id = ?",
      JSON.stringify(existing),
      new Date().toISOString(),
      body.grantId,
      tenantId
    );

    return NextResponse.json({ ok: true, document: aiResp.content, docType });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error("GRANTS_DOC_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
