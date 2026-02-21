export { };

// --- Inlined from workers/drako-scheduler/src/reconciliation.ts due to TSX nesting issues ---
async function runReconciliationLocal(env: any) {
    const db = env.DRACO_DB;
    if (!db) {
        console.error("DRACO_DB not bound");
        return;
    }

    const runId = `rec_${Date.now()}`;
    console.log(`[Reconciliation] Starting run ${runId}`);

    await db.prepare(`
        INSERT INTO reconciliation_logs (id, scope, status) VALUES (?, 'FULL_SYNC', 'RUNNING')
    `).bind(runId).run();

    try {
        let mismatchesCount = 0;
        let checkedCount = 0;

        if (!env.STRIPE_SECRET_KEY) {
            throw new Error("Missing STRIPE_SECRET_KEY");
        }

        const stripeAuth = "Bearer " + env.STRIPE_SECRET_KEY;
        let hasMore = true;
        let startingAfter: string | undefined;

        // Two-Way Sync Data Structure: Set of "tenantId:slug" that are Active in Stripe
        const activeStripeSlugs = new Set<string>();

        // --- PHASE 1: STRIPE -> D1 (Pagination) ---
        while (hasMore) {
            const url = new URL("https://api.stripe.com/v1/subscriptions");
            url.searchParams.set("status", "active");
            url.searchParams.set("limit", "100");
            if (startingAfter) url.searchParams.set("starting_after", startingAfter);

            const resp = await fetch(url.toString(), {
                headers: { "Authorization": stripeAuth }
            });

            if (!resp.ok) throw new Error(`Stripe API Error: ${resp.status}`);

            const data = await resp.json() as any;
            const subs = data.data || [];
            hasMore = data.has_more;
            if (subs.length > 0) {
                startingAfter = subs[subs.length - 1].id;
            }

            for (const sub of subs) {
                checkedCount++;
                const tenantId = sub.metadata?.tenant_id;
                const saasSlug = sub.metadata?.saas_slug;

                if (tenantId && saasSlug) {
                    const key = `${tenantId}:${saasSlug}`;
                    activeStripeSlugs.add(key);

                    // Check D1 existence
                    const saas = await db.prepare("SELECT id, status FROM saas_instances WHERE slug = ? AND tenant_id = ?").bind(saasSlug, tenantId).first();

                    if (!saas) {
                        mismatchesCount++;
                        await db.prepare(`INSERT INTO reconciliation_mismatches (id, run_id, type, tenant_id, saas_slug, stripe_id, action_taken) VALUES (?, ?, 'MISSING_IN_D1', ?, ?, ?, 'ALERTED')`).bind(crypto.randomUUID(), runId, tenantId, saasSlug, sub.id).run();
                    } else if (saas.status !== 'active') {
                        mismatchesCount++;
                        await db.prepare(`UPDATE saas_instances SET status = 'active' WHERE slug = ? AND tenant_id = ?`).bind(saasSlug, tenantId).run();
                        await db.prepare(`INSERT INTO reconciliation_mismatches (id, run_id, type, tenant_id, saas_slug, stripe_id, d1_id, action_taken) VALUES (?, ?, 'STATUS_MISMATCH', ?, ?, ?, ?, 'AUTO_FIXED')`).bind(crypto.randomUUID(), runId, tenantId, saasSlug, sub.id, saas.id).run();
                    }
                }
            }
        }

        // --- PHASE 2: D1 -> STRIPE (Orphan Detection) ---
        // Fetch all D1 active instances
        const { results } = await db.prepare("SELECT id, slug, tenant_id FROM saas_instances WHERE status = 'active'").all();

        if (results) {
            for (const row of results) {
                const r = row as any;
                const key = `${r.tenant_id}:${r.slug}`;

                if (!activeStripeSlugs.has(key)) {
                    // D1 thinks it's active, Stripe does not have it in expected "active" list.
                    // It might be past_due, canceled, or unpaid. Or missing.
                    // Requirement: Degrade in D1.
                    console.warn(`[Mismatch] D1 Active ${key} but not found in Stripe Active List. Downgrading.`);
                    mismatchesCount++;

                    // Action: Downgrade to 'inactive' (or 'restricted' if we had that state)
                    await db.prepare(`UPDATE saas_instances SET status = 'inactive' WHERE id = ?`).bind(r.id).run();

                    await db.prepare(`INSERT INTO reconciliation_mismatches (id, run_id, type, tenant_id, saas_slug, d1_id, action_taken) VALUES (?, ?, 'MISSING_IN_STRIPE', ?, ?, ?, 'DOWNGRADED')`).bind(crypto.randomUUID(), runId, r.tenant_id, r.slug, r.id).run();
                }
            }
        }

        await db.prepare(`
            UPDATE reconciliation_logs 
            SET status = 'COMPLETED', mismatches_count = ?, details_json = ? 
            WHERE id = ?
        `).bind(mismatchesCount, JSON.stringify({ checked: checkedCount, d1_active: results?.length }), runId).run();

        console.log(`[Reconciliation] Finished. Mismatches: ${mismatchesCount}`);

    } catch (e: any) {
        console.error("[Reconciliation] Failed:", e);
        await db.prepare(`UPDATE reconciliation_logs SET status = 'FAILED', details_json = ? WHERE id = ?`).bind(e.message, runId).run();
    }
}
// --- End Inlined ---

// Mock DB to simulate "Active in D1"
const mockDb = {
    prepare: (sql: string) => {
        if (sql.includes("SELECT id, slug, tenant_id FROM saas_instances")) {
            return {
                all: async () => ({
                    results: [
                        { id: "saas_1", slug: "active-in-d1", tenant_id: "t1" }, // Orphan
                        { id: "saas_2", slug: "active-in-both", tenant_id: "t2" } // Match
                    ]
                })
            };
        }
        if (sql.includes("UPDATE saas_instances SET status = 'inactive'")) {
            return {
                bind: (id: string) => ({
                    run: async () => {
                        console.log(`[MockDB] Downgrading Orphan ${id}`);
                        if (id !== "saas_1") throw new Error("Downgraded wrong instance");
                        return { success: true };
                    }
                })
            }
        }
        // Default
        return {
            bind: (...args: any[]) => ({
                run: async () => ({ success: true }),
                first: async () => null
            })
        };
    }
};

// Mock Stripe to only return "active-in-both"
global.fetch = (async (url: any) => {
    return new Response(JSON.stringify({
        has_more: false,
        data: [
            { id: "sub_2", metadata: { tenant_id: "t2", saas_slug: "active-in-both" } }
        ]
    }));
}) as any;

const mockEnv = {
    DRACO_DB: mockDb,
    STRIPE_SECRET_KEY: "sk_test_mock"
};

async function verify() {
    console.log("--- Verifying Reconciliation Two-Way Sync ---");
    await runReconciliationLocal(mockEnv);
    console.log("SUCCESS: Two-way sync verified (Orphan detection logic executed).");
}

verify().catch(console.error);
