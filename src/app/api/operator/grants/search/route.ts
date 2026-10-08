export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireOwnerAccess, UnauthorizedError } from "@/lib/auth/session";
import { queryAll, run } from "@/lib/db";
import { runAi } from "@/lib/ai/client";

type OwnerRow = { id: string; name: string | null; nif: string | null };
type SaasRow = { id: string; name: string };

type GrantProposal = {
  name: string;
  entity: string;
  description: string;
  program: string;
  url: string;
  max_amount: number | null;
  grant_type: "GRANT" | "LOAN" | "SUBSIDY" | "ADVANCE";
  deadline: string | null;
  requirements: string;
  ai_summary: string;
  ai_fit_score: number;
};

const SYSTEM_PROMPT = `Eres un experto en ayudas y subvenciones públicas para startups y empresas tecnológicas en España.
Tu misión es identificar convocatorias de ayudas, subvenciones, préstamos y programas públicos para los que el holding tecnológico Drako podría aplicar.

Devuelves ÚNICAMENTE un JSON válido con la siguiente estructura (array de objetos, sin texto adicional):
[
  {
    "name": "Nombre oficial de la convocatoria",
    "entity": "Organismo convocante (ej: CDTI, ENISA, ICO, Comunidad de Madrid, etc.)",
    "description": "Descripción concisa en 2-3 frases de qué financia",
    "program": "Nombre del programa si aplica",
    "url": "URL oficial (puede ser genérica del organismo si no sabes la exacta)",
    "max_amount": 150000,
    "grant_type": "GRANT|LOAN|SUBSIDY|ADVANCE",
    "deadline": "2026-12-31 o null si no hay fecha concreta",
    "requirements": "Requisitos principales separados por coma",
    "ai_summary": "Por qué encaja con el perfil de este holding (2-3 frases específicas)",
    "ai_fit_score": 85
  }
]

Solo devuelves el JSON, sin markdown, sin explicaciones, sin \`\`\`.`;

function buildUserPrompt(owner: OwnerRow | null, saasCount: number, saasNames: string[]): string {
  return `Perfil del holding:
- Empresa: ${owner?.name ?? "Drako Sistemas Tecnológicos"}
- NIF: ${owner?.nif ?? "Pendiente de registrar"}
- Sector: Tecnología / SaaS / Inteligencia Artificial
- Número de SaaS: ${saasCount}
- Productos: ${saasNames.slice(0, 5).join(", ")}
- País: España
- Descripción: Holding tecnológico que desarrolla múltiples SaaS especializados con IA (marketing, educación, inmobiliario, fintech, análisis cripto)

Busca 6-8 convocatorias de ayudas y subvenciones vigentes o que abrirán pronto, priorizando:
1. CDTI — proyectos de I+D y tecnología
2. ENISA — préstamos participativos para startups
3. Red.es — digitalización y economía digital
4. ICO — líneas de financiación para empresas tecnológicas
5. Comunidades autónomas — especialmente si tienen programas tech
6. Programas europeos accesibles (Horizonte Europa, EIC Accelerator)
7. Ministerio de Ciencia — proyectos de IA

Devuelve el JSON con las más relevantes para este perfil.`;
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireOwnerAccess(req);

    // Obtener contexto del holding
    const [ownerRows, saasRows] = await Promise.all([
      queryAll<OwnerRow>(
        "SELECT id, name, nif FROM owners WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1",
        tenantId
      ),
      queryAll<SaasRow>(
        "SELECT id, name FROM saas WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 10",
        tenantId
      ).catch(() => [] as SaasRow[]),
    ]);

    const owner = ownerRows[0] ?? null;
    const saasNames = saasRows.map((s) => s.name);

    const userPrompt = buildUserPrompt(owner, saasRows.length, saasNames);

    const aiResp = await runAi({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      tenantId,
      saasId: null,
      agentId: "grants-search-agent",
      department: "fiscal",
      plan: null,
      mode: "smart",
    });

    if (!aiResp.ok || !aiResp.content) {
      return NextResponse.json({ ok: false, error: "AI no disponible" }, { status: 503 });
    }

    // Parsear la respuesta IA
    let proposals: GrantProposal[] = [];
    try {
      const raw = aiResp.content.trim();
      const jsonStart = raw.indexOf("[");
      const jsonEnd = raw.lastIndexOf("]");
      if (jsonStart === -1 || jsonEnd === -1) throw new Error("No JSON array found");
      proposals = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as GrantProposal[];
    } catch {
      console.error("GRANTS_SEARCH_PARSE_ERROR", aiResp.content.slice(0, 500));
      return NextResponse.json({ ok: false, error: "Error al parsear propuestas IA" }, { status: 500 });
    }

    // Guardar cada propuesta como ayuda nueva (status IDENTIFIED)
    const now = new Date().toISOString();
    const created: string[] = [];

    for (const p of proposals.slice(0, 10)) {
      if (!p.name || !p.entity) continue;
      const id = `grant_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      await run(
        `INSERT OR IGNORE INTO operator_grants (
          id, tenant_id, name, entity, description, program, url,
          max_amount, grant_type, deadline, status,
          requirements, ai_summary, ai_fit_score,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'IDENTIFIED', ?, ?, ?, ?, ?)`,
        id, tenantId,
        p.name.slice(0, 255),
        p.entity.slice(0, 255),
        p.description ?? null,
        p.program ?? null,
        p.url ?? null,
        p.max_amount ?? null,
        ["GRANT", "LOAN", "SUBSIDY", "ADVANCE"].includes(p.grant_type) ? p.grant_type : "GRANT",
        p.deadline ?? null,
        p.requirements ?? null,
        p.ai_summary ?? null,
        typeof p.ai_fit_score === "number" ? Math.min(100, Math.max(0, Math.round(p.ai_fit_score))) : null,
        now, now
      );
      created.push(id);
    }

    return NextResponse.json({ ok: true, created: created.length, proposals });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error("GRANTS_SEARCH_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
