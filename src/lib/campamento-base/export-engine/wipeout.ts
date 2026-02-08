import JSZip from "jszip";
import { queryOne, queryAll } from "@/lib/db";



// Types corresponding to DB schemas
interface SaasInstance {
    id: string;
    tenant_id: string;
    name: string;
    slug: string;
    status: string;
    blueprint_snapshot: string | null;
    plan_tier: string | null;
    created_at: string;
    mrr_eur: number;
    cost_eur: number;
    risk_level: string;
    // ... other fields
}

interface StrategicDossier {
    id: string;
    tenant_id: string;
    form_data: string;
    analysis_data: string | null;
    plan_data: string | null;
    // ...
}

interface AgentWorkLog {
    id: string;
    agent_name: string;
    action_type: string;
    status: string;
    output_json: string;
    cost_eur: number;
    created_at: string;
}

interface EconomicEvent {
    id: string;
    type: string;
    severity: string;
    payload_json: string;
    created_at: string;
}

interface DomainRecord {
    domain: string;
    is_primary: number | boolean;
    status: string;
}

export async function generateWipeoutPackage(saasId: string, tenantId: string): Promise<{ buffer: Buffer; filename: string }> {
    // 1. Fetch Core SaaS Instance
    const saas = await queryOne<SaasInstance>(
        "SELECT * FROM saas_instances WHERE id = ? AND tenant_id = ?",
        saasId,
        tenantId
    );

    if (!saas) {
        throw new Error(`SaaS instance not found or acccess denied: ${saasId}`);
    }

    const zip = new JSZip();
    const warnings: string[] = [];
    const counts: Record<string, number> = {
        logs: 0,
        economic_events: 0,
        domains: 0
    };

    // 2. Fetch Dossier (Tenant Level usually, but let's check if linked or just use tenant's active one)
    // Assuming 1 active dossier per tenant for simplicity in this context, or we try to find one that matches.
    // In Phase 13 context, likely the tenant has one dossier.
    const dossier = await queryOne<StrategicDossier>(
        "SELECT * FROM tenant_strategic_dossiers WHERE tenant_id = ? AND status IN ('active', 'analyzed') ORDER BY created_at DESC LIMIT 1",
        tenantId
    );

    if (dossier) {
        zip.folder("dossier")?.file("dossier.json", JSON.stringify(dossier, null, 2));
        // PDF execution would go here if we had it stored as blob or path.
        // For now, per requirements: "dossier.pdf (si existe; si no existe, omitir y reflejar warning en meta.json)"
        warnings.push("dossier.pdf not found (storage not implemented)");
    } else {
        warnings.push("No active Strategic Dossier found for tenant");
    }

    // 3. Fetch Blueprint
    if (saas.blueprint_snapshot) {
        // It's already JSON string in DB
        try {
            const bpParsed = JSON.parse(saas.blueprint_snapshot);
            zip.folder("blueprint")?.file("blueprint.json", JSON.stringify(bpParsed, null, 2));
        } catch {
            zip.folder("blueprint")?.file("blueprint.json", saas.blueprint_snapshot); // Dump raw if parse fails
            warnings.push("Blueprint snapshot was invalid JSON");
        }
    } else {
        zip.folder("blueprint")?.file("blueprint.json", "{}");
        warnings.push("No blueprint_snapshot found in saas_instances");
    }

    // 4. Execution Logs
    const workLogs = await queryAll<AgentWorkLog>(
        "SELECT id, agent_name, action_type, status, output_json, cost_eur, created_at FROM agent_work_logs WHERE saas_id = ? ORDER BY created_at DESC LIMIT 5000",
        saasId
    );
    counts.logs = workLogs.length;

    if (workLogs.length > 0) {
        // CSV Generation
        const csvHeader = "id,agent_name,action_type,status,cost_eur,created_at,output_snippet\n";
        const csvRows = workLogs.map(log => {
            // Escape output_json to avoid CSV breakage, also truncate for readability in CSV
            const validJson = log.output_json ? log.output_json.replace(/"/g, '""') : "";
            const snippet = validJson.slice(0, 1000); // 1KB limit per cell for CSV sanity
            return `${log.id},${log.agent_name},${log.action_type},${log.status},${log.cost_eur},${log.created_at},"${snippet}"`;
        }).join("\n");

        zip.folder("execution")?.file("work_logs.csv", csvHeader + csvRows);
    } else {
        zip.folder("execution")?.file("work_logs.csv", "id,agent_name,action_type,status,cost_eur,created_at,output_snippet\n");
    }

    // Orchestrator Messages (if exists)
    // Checking `orchestrator_messages` table from `0006_orchestrator_messages.sql` (in inferred memory, checking actual existence is safer/cleaner)
    // Let's assume it exists or wrap in try/catch if we aren't sure. But requirements say "si existe tabla".
    // SQL usually won't fail if table exists. To be safe, we can try query or just omit if empty.
    try {
        const msgs = await queryAll<{ role: string, content: string, created_at: string }>(
            "SELECT role, content, created_at FROM orchestrator_messages WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1000",
            tenantId
        );
        if (msgs && msgs.length > 0) {
            const msgHeader = "role,created_at,content\n";
            const msgRows = msgs.map(m => {
                const content = m.content ? m.content.replace(/"/g, '""') : "";
                return `${m.role},${m.created_at},"${content}"`;
            }).join("\n");
            zip.folder("execution")?.file("orchestrator_messages.csv", msgHeader + msgRows);
        }
    } catch (e) {
        // Table might not exist or other error
        // console.warn("Orchestrator messages fetch failed", e);
    }

    // 5. Economics
    // financials.csv from saas_instances fields + recent metrics
    const financialsHeader = "metric,value,unit\n";
    const financialsRows = [
        `mrr,${saas.mrr_eur},EUR`,
        `total_cost,${saas.cost_eur},EUR`,
        `risk_level,${saas.risk_level},ENUM`,
        `plan_tier,${saas.plan_tier},ENUM`
    ].join("\n");
    zip.folder("economics")?.file("financials.csv", financialsHeader + financialsRows);

    const ecoEvents = await queryAll<EconomicEvent>(
        "SELECT id, type, severity, payload_json, created_at FROM economic_events WHERE saas_id = ? ORDER BY created_at DESC LIMIT 2000",
        saasId
    );
    counts.economic_events = ecoEvents.length;

    if (ecoEvents.length > 0) {
        const ecoHeader = "id,type,severity,created_at,payload\n";
        const ecoRows = ecoEvents.map(e => {
            const payload = e.payload_json ? e.payload_json.replace(/"/g, '""') : "";
            return `${e.id},${e.type},${e.severity},${e.created_at},"${payload}"`;
        }).join("\n");
        zip.folder("economics")?.file("economic_events.csv", ecoHeader + ecoRows);
    }

    // 6. Domains
    const domains = await queryAll<DomainRecord>(
        "SELECT domain, is_primary, status FROM saas_domains WHERE saas_id = ?",
        saasId
    );
    counts.domains = domains.length;
    if (domains.length > 0) {
        zip.folder("domains")?.file("domain_status.json", JSON.stringify(domains, null, 2));
    } else {
        zip.folder("domains")?.file("domain_status.json", "[]");
    }

    // 7. Meta.json
    const meta = {
        saasId: saas.id,
        tenantId: saas.tenant_id,
        slug: saas.slug,
        generatedAt: new Date().toISOString(),
        planTag: saas.plan_tier,
        counts,
        warnings
    };
    zip.file("meta.json", JSON.stringify(meta, null, 2));

    // Generate ZIP
    const content = await zip.generateAsync({ type: "nodebuffer" });
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const filename = `drako-export-${saas.slug}-${dateStr}.zip`;

    return { buffer: content, filename };
}
