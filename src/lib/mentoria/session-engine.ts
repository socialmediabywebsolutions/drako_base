
import { MentoriaInvoicer } from '../billing/mentoria-invoicer';

export interface SessionConfig {
    tenantId: string;
    db: any; // D1Database
}

type MentoriaSessionRow = {
    status: string;
    cost_est_major: number | null;
};

type CountRow = {
    c: number | null;
};

type SumRow = {
    total: number | null;
};

type SaasCycleRow = {
    billing_cycle_start: string;
    billing_cycle_end: string;
    tenant_id: string;
    included_sessions: number | null;
};

export class MentorSessionEngine {
    private db: D1Database;
    private tenantId: string;
    private saasId: string;

    constructor(db: D1Database, tenantId = "mentoria-core", saasId = "mentoria-global") {
        this.db = db;
        this.tenantId = tenantId;
        this.saasId = saasId;
    }

    async createSession(mentorId: string, clientId: string, metadata: any = {}): Promise<string> {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const metaJson = JSON.stringify(metadata);

        await this.db.prepare(
            `INSERT INTO mentoria_sessions(id, tenant_id, mentor_id, client_id, status, metadata_json, created_at)
VALUES(?, ?, ?, ?, 'scheduled', ?, ?)`
        ).bind(id, this.tenantId, mentorId, clientId, metaJson, now).run();

        await this.emitEvent('SESSION_CREATED', { sessionId: id, mentorId, clientId });

        return id;
    }

    async getSessions(limit = 50): Promise<any[]> {
        const { results } = await this.db.prepare(
            `SELECT * FROM mentoria_sessions WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ? `
        ).bind(this.tenantId, limit).all();
        return results || [];
    }

    async completeSession(sessionId: string, durationMinutes: number, tokensUsed: number): Promise<void> {
        const now = new Date().toISOString();
        const costMajor = Math.max(1, Math.floor(durationMinutes / 10));

        await this.db.prepare(
            `UPDATE mentoria_sessions 
             SET status = 'completed', duration_minutes = ?, ai_tokens_used = ?, cost_est_major = ?, completed_at = ?
    WHERE id = ? AND tenant_id = ? `
        ).bind(durationMinutes, tokensUsed, costMajor, now, sessionId, this.tenantId).run();

        await this.emitEvent('SESSION_COMPLETED', { sessionId, durationMinutes, tokensUsed, costMajor });

        const count = await this.db.prepare(`SELECT count(*) as c FROM mentoria_sessions WHERE tenant_id = ? AND status = 'completed'`).bind(this.tenantId).first<number>('c');
        if ((count ?? 0) === 1) {
            await this.emitEvent('FIRST_REAL_USAGE', { sessionId });
        }
    }

    async billSession(sessionId: string): Promise<void> {
        const now = new Date().toISOString();

        const session = await this.db.prepare(`SELECT status, cost_est_major FROM mentoria_sessions WHERE id = ? AND tenant_id = ?`).bind(sessionId, this.tenantId).first<MentoriaSessionRow>();
        if (!session) throw new Error(`Session ${sessionId} not found`);
        if (session.status !== 'completed') throw new Error(`Session must be completed before billing`);

        const costMajor = session.cost_est_major ?? 0;

        await this.db.prepare(`UPDATE mentoria_sessions SET status = 'billed', billed_at = ? WHERE id = ?`).bind(now, sessionId).run();

        await this.emitEvent('SESSION_OVERAGE_BILLED', { sessionId, amount: costMajor }, costMajor);
    }

    /**
     * Get global session statistics
     * @param days Number of days to look back (default: 30)
     */
    async getStats(days: number = 30): Promise<{
        total_7d: number;
        total_30d: number;
        completed_count: number;
        overage_revenue: number;
        avg_per_instance: number;
    }> {
        const now = new Date();
        const date7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const date30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

        // Count sessions (7d)
        const count7d = await this.db.prepare(
            `SELECT COUNT(*) as c FROM mentoria_sessions WHERE created_at >= ?`
        ).bind(date7d).first<CountRow>();

        // Count sessions (30d)
        const count30d = await this.db.prepare(
            `SELECT COUNT(*) as c FROM mentoria_sessions WHERE created_at >= ?`
        ).bind(date30d).first<CountRow>();

        // Count completed sessions (all time)
        const completedCount = await this.db.prepare(
            `SELECT COUNT(*) as c FROM mentoria_sessions WHERE status IN ('completed', 'billed')`
        ).first<CountRow>();

        // Calculate overage revenue from economic_events
        const revenueData = await this.db.prepare(
            `SELECT SUM(amount_major) as total FROM economic_events 
             WHERE event_type = 'SESSION_OVERAGE_BILLED'`
        ).first<SumRow>();

        // Count distinct instances
        const instanceCount = await this.db.prepare(
            `SELECT COUNT(DISTINCT id) as c FROM saas_instances WHERE slug = 'mentoria'`
        ).first<CountRow>();

        const total7d = count7d?.c ?? 0;
        const total30d = count30d?.c ?? 0;
        const completed = completedCount?.c ?? 0;
        const overageRev = revenueData?.total ?? 0;
        const instances = Math.max(1, instanceCount?.c ?? 1);

        return {
            total_7d: total7d,
            total_30d: total30d,
            completed_count: completed,
            overage_revenue: overageRev,
            avg_per_instance: total30d / instances
        };
    }

    async rolloverBillingCycle(saasId: string): Promise<void> {
        // 0. Trigger Invoicing (Phase 20) BEFORE date advance
        const { MentoriaInvoicer } = await import('../billing/mentoria-invoicer');
        const invoicer = new MentoriaInvoicer(this.db);

        try {
            await invoicer.createUsageInvoiceRun(saasId);
        } catch (e: any) {
            console.error(`[Rollover] Invoice failed for ${saasId}: ${e.message}`);
            throw e;
        }

        // 1. Snapshot usage
        const saas = await this.db.prepare(
            `SELECT billing_cycle_start, billing_cycle_end, tenant_id, included_sessions FROM saas_instances WHERE id = ?`
        ).bind(saasId).first<SaasCycleRow>();
        if (!saas) throw new Error('SaaS not found');

        const start = saas.billing_cycle_start;
        const end = saas.billing_cycle_end;

        const usageRes = await this.db.prepare(
            `SELECT count(*) as total FROM mentoria_sessions 
             WHERE tenant_id = ? AND created_at >= ? AND created_at < ? AND status IN ('completed', 'billed')`
        ).bind(saas.tenant_id, start, end).first<SumRow>();

        const usageCount = usageRes?.total ?? 0;
        const includedSessions = saas.included_sessions ?? 10;
        const overage = Math.max(0, usageCount - includedSessions);

        await this.emitEvent('MONTHLY_USAGE_SNAPSHOT_CREATED', {
            saasId,
            period: { start, end },
            included: includedSessions,
            used: usageCount,
            overage
        });

        // 2. Advance dates
        const newStart = end;
        const nextEnd = new Date(new Date(end).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        await this.db.prepare(
            `UPDATE saas_instances SET billing_cycle_start = ?, billing_cycle_end = ? WHERE id = ?`
        ).bind(newStart, nextEnd, saasId).run();

        // 3. Emit rollover event
        await this.emitEvent('BILLING_CYCLE_ROLLOVER', {
            saasId,
            previous: { start, end },
            current: { start: newStart, end: nextEnd }
        });

        await this.emitEvent('BILLING_CYCLE_STARTED', {
            saasId,
            start: newStart,
            end: nextEnd
        });
    }

    private async emitEvent(type: string, metadata: any, amountMajor: number = 0) {
        const id = crypto.randomUUID();
        await this.db.prepare(
            `INSERT INTO economic_events(id, saas_id, tenant_id, event_type, amount_major, currency, metadata_json, created_at)
              VALUES(?, ?, ?, ?, ?, 'EUR', ?, datetime('now'))`
        ).bind(id, this.saasId, this.tenantId, type, amountMajor, JSON.stringify(metadata)).run();
    }
}
