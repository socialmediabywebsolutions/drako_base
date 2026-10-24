
import { run } from "@/lib/db";

export async function archiveInstance(saasId: string, tenantId: string): Promise<boolean> {
    const now = new Date().toISOString();

    // 1. Archive Instance
    const updatedInstance = await run(
        "UPDATE saas_instances SET status = 'archived', updated_at = ? WHERE id = ? AND tenant_id = ?",
        now,
        saasId,
        tenantId
    );

    if (!updatedInstance) return false;

    // 2. Deactivate Agents
    await run(
        "UPDATE saas_agents SET status = 'inactive' WHERE instance_id = ?",
        saasId
    );

    // 3. Log Event
    await run(
        "INSERT INTO economic_events (id, tenant_id, saas_id, type, severity, payload_json, created_at) VALUES (?, ?, ?, 'INSTANCE_ARCHIVED', 'info', ?, ?)",
        globalThis.crypto.randomUUID(),
        tenantId,
        saasId,
        JSON.stringify({ reason: "Manual archive request or end of life" }),
        now
    );

    return true;
}
