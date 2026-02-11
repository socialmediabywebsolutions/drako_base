import { MentoriaInvoicer } from '../src/lib/billing/mentoria-invoicer';
// Mock D1 for CLI usage
// Since we are running in Node via tsx, we need a way to execute D1 queries.
// We can use a proxy that calls wrangler d1 execute? 
// Or better: bind to local d1 sqlite file if we can locate it?
// "wraangler d1 execute" is slow for many queries.
// But MentoriaInvoicer expects a `db` object with `prepare().bind().first()/run()/all()`.
// We need to polyfill this `db` object to call `wrangler`.
// This is critical for reuse of the library code in scripts.

import { execSync } from 'child_process';

class D1Mock {
    prepare(sql: string) {
        return new D1Statement(sql);
    }
}

class D1Statement {
    constructor(private sql: string, private params: any[] = []) { }

    bind(...params: any[]) {
        this.params = params;
        return this;
    }

    private getSafeCmd() {
        // Simple parameter substitution (unsafe for prod, mostly ok for local verification scripts if inputs trusted)
        // Better: use sql.replace('?', val)
        let finalSql = this.sql.replace(/\n/g, ' '); // Strip newlines for Windows execSync compatibility
        for (const p of this.params) {
            let val = p;
            if (typeof p === 'string') val = `'${p.replace(/'/g, "''")}'`;
            if (p instanceof Date) val = `'${p.toISOString()}'`; // or D1 format?
            // D1/SQLite usually expects strings for dates mostly.
            finalSql = finalSql.replace('?', val);
        }
        return finalSql.replace(/"/g, '\\"');
    }

    private async exec(json = false) {
        const cmd = this.getSafeCmd();
        const flag = json ? '--json' : '';
        const res = execSync(`npx wrangler d1 execute drako_db_prod --local --command "${cmd}" ${flag}`, { encoding: 'utf-8' });
        if (json) {
            const idx = res.indexOf('[');
            if (idx === -1) return [];
            return JSON.parse(res.substring(idx));
        }
        return res;
    }

    async first() {
        const rows = await this.all();
        return rows.results ? rows.results[0] : null; // D1 response format is { results: [...] } logic depends on wrangler version but usually array of results.
        // Wrangler --json returns [ { results: [], ... } ]
        // So rows[0].results[0]
        // Wait, `all()` below handles the [0].results part?
        // Let's make `all()` return { results: [...] } to match D1 types?
        // D1Database.prepare().all() returns D1Result { results: T[] }.
        // D1Database.prepare().first() returns T | null.
    }

    async run() {
        await this.exec(false);
        return { success: true };
    }

    async all() {
        const json = await this.exec(true);
        // json is [ { results: [...] } ]
        return { results: json[0]?.results || [] };
    }
}

const db = new D1Mock() as any;

const saasId = process.argv[2];
if (!saasId) {
    console.error('Usage: npx tsx run-invoicer-cli.ts <saasId>');
    process.exit(1);
}

const invoicer = new MentoriaInvoicer(db, undefined, true); // Mock mode forced or via env?
// Constructor: (db, key, forceMock).
// We pass forceMock=false, but ensure STRIPE_MODE=mock env var is set in wrapper.
// Actually, let's look at constructor again.
// const key = stripeSecretKey || (typeof process !== 'undefined' ? process.env.STRIPE_SECRET_KEY : undefined);
// this.isMock = forceMock || !key || ...
// So if we don't pass key, it enters mock mode.

(async () => {
    try {
        const result = await invoicer.createUsageInvoiceRun(saasId);
        console.log(JSON.stringify(result, null, 2));
    } catch (e: any) {
        console.error('Failed:', e);
        process.exit(1);
    }
})();
