
// import { randomUUID } from 'crypto'; // Removed unused import
// Since this is likely running in a worker context or similar, we'll try to stick to standard Web Crypto if available or standard node imports.
// Assuming this is a server-side lib executed by scripts for now, but also usable by API.

// We need a way to execute D1 queries.
// In the context of this app, we usually have a DB binding or a way to execute.
// For the scripts, we use `wrangler d1 execute`.
// For the actual app code, we'd use the `db` binding.
// Since the prompt asks for `src / lib / mentoria / session - engine.ts`, this implies application code.
// However, I don't have a direct DB binding import available here without knowing the exact project structure for DB access.
// I will assume a standard D1 interface or a helper if one exists.
// Looking at `src / lib / db.ts` or similar would be good, but I'll write a standalone-ish version that can be adapted
// or uses a placeholder `getDb()` function.
// Actually, I'll check `src / lib / db.ts` in the next step to be sure, but for now I'll write the logic structure.
// Wait, I can't check it in parallel. I'll write the file assumming a standard `getDb()` or similar.
// Actually, I'll use a pragmatic approach: I'll create the file with the logic, and if I need to adjust imports I will.
// Given strict instructions to EXECUTE, I will provide the file content that aims to be correct.

import { MentoriaInvoicer } from '../../billing/mentoria-invoicer';

export interface SessionConfig {
    tenantId: string;
    db: any; // D1Database
}

// Core Logic for MentorIA Session Engine

export class MentorSessionEngine {
    private db: D1Database;
    private tenantId = 'mentoria-core';

    constructor(db: D1Database) {
        this.db = db;
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
        // Simple cost model: 1 EUR per 10 mins (Minimum 1 EUR)
        const costMajor = Math.max(1, Math.floor(durationMinutes / 10));

        await this.db.prepare(
            `UPDATE mentoria_sessions 
             SET status = 'completed', duration_minutes = ?, ai_tokens_used = ?, cost_est_major = ?, completed_at = ?
    WHERE id = ? AND tenant_id = ? `
        ).bind(durationMinutes, tokensUsed, costMajor, now, sessionId, this.tenantId).run();

        await this.emitEvent('SESSION_COMPLETED', { sessionId, durationMinutes, tokensUsed, costMajor });

        // Check for FIRST_REAL_USAGE
        const count = await this.db.prepare(`SELECT count(*) as c FROM mentoria_sessions WHERE tenant_id = ? AND status = 'completed'`).bind(this.tenantId).first('c');
        if (count === 1) {
            await this.emitEvent('FIRST_REAL_USAGE', { sessionId });
        }
    }

    async billSession(sessionId: string): Promise<void> {
        const now = new Date().toISOString();

        // 1. Get Session & Tenant
        const session = await this.db.prepare(`SELECT * FROM mentoria_sessions WHERE id = ? AND tenant_id = ?`).bind(sessionId, this.tenantId).first() as any;
        if (!session) throw new Error('Session not found');

        // Validation: Must be completed
        if (session.status !== 'completed') throw new Error(`Session must be completed before billing (Status: ${session.status})`);
        if (!session.completed_at) throw new Error('Session missing completed_at timestamp');

        // 2. Get SaaS Instance & Pricing Plan & Cycle Dates
        const saas = await this.db.prepare(`SELECT * FROM saas_instances WHERE tenant_id = ?`).bind(this.tenantId).first() as any;
        if (!saas) throw new Error('SaaS Instance not found');

        if (!saas.billing_cycle_start || !saas.billing_cycle_end) {
            throw new Error('SaaS Billing Cycle not initialized');
        }

        const planId = saas.pricing_plan_id || 'plan_mentoria_free';
        const plan = await this.db.prepare(`SELECT * FROM mentoria_pricing_plans WHERE id = ?`).bind(planId).first() as any;

        if (!plan) throw new Error('Pricing Plan not found');

        // 3. Count Usage in Current Billing Cycle (Using completed_at)
        // Rule: billing_cycle_start <= completed_at < billing_cycle_end

        if (session.status === 'billed') return;

        const countResult = await this.db.prepare(
            `SELECT count(*) as c FROM mentoria_sessions 
             WHERE tenant_id = ? 
             AND status IN ('completed', 'billed')
             AND completed_at >= ?
             AND completed_at < ?
             AND completed_at <= ?` // Order by completion time to determine rank
        ).bind(this.tenantId, saas.billing_cycle_start, saas.billing_cycle_end, session.completed_at).first() as any;

        const rank = countResult.c;

        // 4. Calculate Price & Event
        let priceCharged = 0;
        let eventType = 'SESSION_INCLUDED_CONSUMED';

        const included = plan.included_sessions; // -1 = always included.

        if (included !== -1 && rank > included) {
            priceCharged = plan.price_per_session_major;
            eventType = 'SESSION_OVERAGE_BILLED';
        }

        // 5. Update Session
        await this.db.prepare(
            `UPDATE mentoria_sessions 
             SET status = 'billed', price_charged_major = ?, billed_at = ?
             WHERE id = ? AND tenant_id = ? `
        ).bind(priceCharged, now, sessionId, this.tenantId).run();

        // 6. Update Economics
        // cost_est_major -> ALWAYS accumulate infrastructure cost (session.cost_est_major)
        await this.db.prepare(
            `UPDATE saas_instances 
             SET cost_est_major = cost_est_major + ?
             WHERE tenant_id = ? `
        ).bind(session.cost_est_major || 0, this.tenantId).run();

        // 7. Emit Event
        await this.emitEvent(eventType, {
            sessionId,
            price: priceCharged,
            planId: plan.id,
            currency: plan.currency,
            rank,
            includedLimit: included,
            cycleStart: saas.billing_cycle_start,
            cycleEnd: saas.billing_cycle_end
        }, priceCharged);
    }

    async rolloverBillingCycle(saasId: string): Promise<void> {
        // 0. Trigger Invoicing (Phase 20) BEFORE date advance
        const { MentoriaInvoicer } = await import('../../billing/mentoria-invoicer');
        const invoicer = new MentoriaInvoicer(this.db);

        try {
            await invoicer.createUsageInvoiceRun(saasId);
        } catch (e: any) {
            console.error(`[Rollover] Invoice failed for ${saasId}: ${e.message}`);
            throw e; // Block rollover if invoice fails
        }

        // 1. Get SaaS & Plan
        const saas = await this.db.prepare(`SELECT * FROM saas_instances WHERE id = ?`).bind(saasId).first() as any;
        if (!saas) throw new Error('SaaS not found');

        const planId = saas.pricing_plan_id || 'plan_mentoria_free';
        const plan = await this.db.prepare(`SELECT * FROM mentoria_pricing_plans WHERE id = ?`).bind(planId).first() as any;

        // 2. Metrics Calculation
        const start = saas.billing_cycle_start;
        const end = saas.billing_cycle_end;

        const stats = await this.db.prepare(
            `SELECT count(*) as total FROM mentoria_sessions 
             WHERE tenant_id = ? 
             AND status IN ('completed', 'billed')
             AND completed_at >= ? AND completed_at < ?`
        ).bind(saas.tenant_id, start, end).first() as any;

        const total = stats.total;
        const includedLimit = plan.included_sessions;

        let includedUsed = 0;
        let overageCount = 0;

        if (includedLimit === -1) {
            includedUsed = total;
        } else {
            includedUsed = Math.min(total, includedLimit);
            overageCount = Math.max(0, total - includedLimit);
        }

        // Usage Revenue from Events
        const revStats = await this.db.prepare(
            `SELECT sum(amount_major) as revenue FROM economic_events
             WHERE saas_id = ? 
             AND event_type = 'SESSION_OVERAGE_BILLED'
             AND created_at >= ? AND created_at < ?`
        ).bind(saasId, start, end).first() as any;

        const usageRevenue = revStats.revenue || 0;
        const fixedFee = plan.monthly_fee_major;

        // 3. Create Snapshot
        const snapId = crypto.randomUUID();
        await this.db.prepare(`
            INSERT INTO saas_economics_snapshots (
                id, saas_id, tenant_id, cycle_start, cycle_end, 
                included_sessions_used, overage_sessions, usage_revenue_major, 
                fixed_fee_major, cost_est_major
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            snapId, saasId, saas.tenant_id, start, end,
            includedUsed, overageCount, usageRevenue,
            fixedFee, saas.cost_est_major
        ).run();

        // 4. Advance Cycle
        const oldEnd = new Date(end);
        const newStart = new Date(oldEnd);
        const newEnd = new Date(newStart);
        newEnd.setMonth(newEnd.getMonth() + 1);

        const fmt = (d: Date) => d.toISOString().split('T')[0];

        await this.db.prepare(
            `UPDATE saas_instances 
             SET billing_cycle_start = ?, billing_cycle_end = ?
             WHERE id = ?`
        ).bind(fmt(newStart), fmt(newEnd), saasId).run();

        // 5. Emit Rollover Event
        await this.emitEvent('BILLING_CYCLE_ROLLOVER', {
            saasId,
            oldCycle: { start, end },
            newCycle: { start: fmt(newStart), end: fmt(newEnd) },
            snapshotId: snapId
        });
    }


    async getStats(days = 30): Promise<{ count: number, revenue: number, cost: number }> {
        // D1 doesn't have robust date math in all versions, but we can try modifiers or just filter in app if volume is low.
        // Better: use SQL for aggregation.
        const sql = `
            SELECT 
                COUNT(*) as count,
                SUM(price_charged_major) as revenue,
                SUM(cost_est_major) as cost
            FROM mentoria_sessions 
            WHERE tenant_id = ? 
            AND created_at >= datetime('now', '-${days} days')
        `;

        const result = await this.db.prepare(sql).bind(this.tenantId).first() as any;
        return {
            count: result?.count as number || 0,
            revenue: result?.revenue as number || 0,
            cost: result?.cost as number || 0
        };
    }

    private async emitEvent(eventType: string, metadata: any, amountMajor: number = 0) {
        const id = crypto.randomUUID();
        const metaJson = JSON.stringify(metadata);

        // Assuming economic_events table exists
        await this.db.prepare(
            `INSERT INTO economic_events(id, saas_id, tenant_id, event_type, amount_major, metadata_json, created_at)
VALUES(?, (SELECT id FROM saas_instances WHERE tenant_id = ?), ?, ?, ?, ?, ?)`
        ).bind(id, this.tenantId, this.tenantId, eventType, amountMajor, metaJson, new Date().toISOString()).run();
    }
}
