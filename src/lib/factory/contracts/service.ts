import { queryOne, run } from "@/lib/db";
import { BlueprintResponse } from "@/lib/factory/ai-blueprint/prompts";

export interface ProjectContract {
    id: string;
    project_id: string;
    tenant_id: string;
    content_markdown: string;
    status: "DRAFT" | "PENDING" | "SIGNED" | "VOID";
    signed_at?: string;
    created_at: string;
}

export class ContractService {
    static async generateFromBlueprint(
        tenantId: string,
        projectId: string,
        projectName: string,
        blueprint: BlueprintResponse
    ): Promise<ProjectContract> {
        const timestamp = new Date().toISOString();
        const roadmap = (blueprint.entitlements?.features || [])
            .map((f: string) => `- ${f}`)
            .join("\n");

        const contentMarkdown = `
# ACUERDO DE MATERIALIZACIÓN DIGITAL v3.0
## DRAKO SYSTEMS • ${projectName}

Este documento establece los términos técnicos y operativos para la ejecución del proyecto **${projectName}** dentro de la infraestructura de **Drako.Systems**.

---

### 1. ALCANCE DEL PROYECTO
El sistema orquestará los recursos necesarios para materializar la siguiente visión técnica:
${blueprint.understanding}

**Funcionalidades Clave:**
${roadmap}

### 2. INFRAESTRUCTURA Y DESPLIEGUE
- **Provisionamiento**: Cloudflare Edge (Workers + D1 + R2).
- **Billing Integrity**: Integración nativa con Stripe.
- **Mantenimiento**: Orquestación automatizada 24/7.

### 3. COMPROMISO OPERATIVO
Al firmar este documento, el solicitante autoriza a **Drako.Systems** a iniciar el ciclo de producción acelerado. 

**Presupuesto Estimado**: ${blueprint.pricing?.monthly || 0} USD/mes.
*Nota: Este valor está sujeto al consumo real de recursos en el Edge.*

---
**ESTADO DE SINCRONIZACIÓN**: NEURAL LINK ESTABLISHED
**CONFIANZA DEL MOTOR**: PLATINUM 70B
`;

        const contractId = crypto.randomUUID();

        // Check if one already exists for this project
        const existing = await queryOne<{ id: string }>(
            "SELECT id FROM project_contracts WHERE project_id = ? AND tenant_id = ? AND status != 'VOID'",
            projectId, tenantId
        );

        if (existing) {
            await run(
                "UPDATE project_contracts SET content_markdown = ?, updated_at = ? WHERE project_id = ? AND status = 'DRAFT'",
                contentMarkdown, timestamp, projectId
            );

            const updated = await queryOne<ProjectContract>(
                "SELECT * FROM project_contracts WHERE project_id = ?",
                projectId
            );

            return updated!;
        }

        const newContract: ProjectContract = {
            id: contractId,
            project_id: projectId,
            tenant_id: tenantId,
            content_markdown: contentMarkdown,
            status: "DRAFT",
            created_at: timestamp
        };

        await run(
            "INSERT INTO project_contracts (id, tenant_id, project_id, content_markdown, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            newContract.id,
            tenantId,
            projectId,
            contentMarkdown,
            "DRAFT",
            timestamp,
            timestamp
        );

        return newContract;
    }

    static async signContract(
        id: string,
        tenantId: string,
        ip: string,
        metadata: string
    ): Promise<boolean> {
        const timestamp = new Date().toISOString();
        const success = await run(
            "UPDATE project_contracts SET status = 'SIGNED', signed_at = ?, signature_ip = ?, signature_metadata_json = ?, updated_at = ? WHERE id = ? AND tenant_id = ? AND status != 'SIGNED'",
            timestamp, ip, metadata, timestamp, id, tenantId
        );

        return success;
    }
}
