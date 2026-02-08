import { run, queryAll } from "@/lib/db";
import { env } from "@/lib/cf"; // Assuming this helper exists or we access env directly
import { createHash } from "crypto";

// Types
export type DomainStatus =
    | 'none'
    | 'locked'
    | 'pending'
    | 'verifying'
    | 'verified'
    | 'active'
    | 'failed'
    | 'pending_manual';

export type DomainCheckResult = {
    valid: boolean;
    message?: string;
    status: DomainStatus;
};

// Config
const getEnv = (key: string) => {
    // In Edge runtimes we might need to access process.env or specific binding
    // For now assuming standard process.env or injected global for simplicity in this file scope, 
    // but in Worker context we should pass env.
    return process.env[key] ?? "";
}

const BASE_DOMAIN = getEnv("DRAKO_BASE_DOMAIN") || "drako.systems";
const VERIFY_PREFIX = getEnv("DOMAIN_VERIFY_PREFIX") || "drako-verify";
const VERIFY_SALT = getEnv("DOMAIN_VERIFY_SALT") || "salt";
const CF_ACCOUNT_ID = getEnv("CLOUDFLARE_ACCOUNT_ID") || getEnv("CF_ACCOUNT_ID");
const CF_API_TOKEN = getEnv("CLOUDFLARE_API_TOKEN");
const CF_PROJECT_NAME = getEnv("CLOUDFLARE_PAGES_PROJECT") || "drako-base-3";

// Helper to record events
async function logDomainEvent(
    tenantId: string,
    saasId: string,
    type: string,
    metadata: Record<string, any> = {}
) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await run(
        "INSERT INTO domain_events (id, saas_instance_id, tenant_id, type, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        id, saasId, tenantId, type, JSON.stringify(metadata), now
    );
}

// 1. Get Trial Domain
export function getTrialDomain(slug: string): string {
    return `${slug}.${BASE_DOMAIN}`;
}

// 2. Request Custom Domain
export async function requestCustomDomain(
    tenantId: string,
    saasId: string,
    domainInput: string,
    isPlanActive: boolean // passed from caller to avoid circular dependency
): Promise<{ ok: boolean; error?: string; token?: string; status?: string }> {

    // Validation
    const domain = domainInput.toLowerCase().trim();
    if (!domain || domain.includes("/") || domain.includes("http")) {
        return { ok: false, error: "Invalid domain format. Use hostname only (e.g. app.client.com)." };
    }

    if (!isPlanActive) {
        return { ok: false, error: "Plan requires upgrade for custom domains.", status: 'locked' };
    }

    // Check availability
    const existing = await queryAll<{ id: string }>("SELECT id FROM saas_instances WHERE custom_domain = ? AND id != ?", domain, saasId);
    if (existing.length > 0) {
        return { ok: false, error: "Domain already claimed by another instance." };
    }

    // Generate Token (deterministic)
    // sha256(saasId + domain + salt) -> hex -> take first 32 chars
    const raw = `${saasId}:${domain}:${VERIFY_SALT}`;
    // In Edge/Worker, crypto might be subtle. Using simple node crypto for now (compat flag enabled).
    // Or simple random for MVP if deterministic not strictly required, but deterministic is better for UX re-requests.
    // Let's use simple random for simplicity in this implementation unless deterministic is critical.
    // User spec: "determinista con SALT + tenant + saas + domain"
    // Implementing simplified deterministic hash:
    const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const token = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);

    // Update DB
    const now = new Date().toISOString();
    await run(
        `UPDATE saas_instances 
     SET custom_domain = ?, domain_verify_token = ?, domain_status = 'pending', domain_last_checked_at = ? 
     WHERE id = ? AND tenant_id = ?`,
        domain, token, now, saasId, tenantId
    );

    await logDomainEvent(tenantId, saasId, "DOMAIN_REQUESTED", { domain, token });

    return { ok: true, token, status: 'pending' };
}

// 3. DNS Verification logic
async function resolveTxtRecord(domain: string, host: string): Promise<string[]> {
    // Use Cloudflare DNS over HTTPS for reliability
    const query = `${host}.${domain}`;
    const url = `https://cloudflare-dns.com/dns-query?name=${query}&type=TXT`;

    try {
        const res = await fetch(url, { headers: { 'Accept': 'application/dns-json' } });
        const json = await res.json();
        if (json.Answer) {
            return json.Answer.map((a: any) => a.data.replace(/^"|"$/g, ''));
        }
        return [];
    } catch (e) {
        console.error("DNS_CHECK_ERROR", e);
        return [];
    }
}

// 4. Check & Activate
export async function verifyAndActivate(
    tenantId: string,
    saasId: string,
    force: boolean = false
): Promise<{ prevStatus: string; newStatus: string; message: string }> {

    const rows = await queryAll<{ custom_domain: string; domain_verify_token: string; domain_status: string; domain_provider: string }>(
        "SELECT custom_domain, domain_verify_token, domain_status, domain_provider FROM saas_instances WHERE id = ? AND tenant_id = ?",
        saasId, tenantId
    );

    if (rows.length === 0) return { prevStatus: 'none', newStatus: 'none', message: 'Instance not found' };
    const { custom_domain, domain_verify_token, domain_status } = rows[0];

    if (!custom_domain || !domain_verify_token) return { prevStatus: domain_status, newStatus: domain_status, message: 'No custom domain pending.' };
    if (domain_status === 'active' && !force) return { prevStatus: 'active', newStatus: 'active', message: 'Already active.' };

    // Check DNS
    const txtRecords = await resolveTxtRecord(custom_domain, VERIFY_PREFIX);
    const isVerified = txtRecords.includes(domain_verify_token);

    if (!isVerified) {
        // If we can't find specific record, maybe they put it on root? (Flexible)
        const rootTxt = await resolveTxtRecord(custom_domain, "@"); // @ isn't valid in DoH name usually, generally just domain
        // Actually standard DoH just query domain
        // TODO: stricter check.

        // Log failure
        await run("UPDATE saas_instances SET domain_last_checked_at = ?, domain_error = 'TXT record not found' WHERE id = ?", new Date().toISOString(), saasId);
        return { prevStatus: domain_status, newStatus: domain_status, message: 'DNS verification failed. TXT record not found.' };
    }

    // Verified!
    await logDomainEvent(tenantId, saasId, "DOMAIN_VERIFIED", { domain: custom_domain });
    await run("UPDATE saas_instances SET domain_status = 'verified' WHERE id = ?", saasId);

    // Activate via Cloudflare API
    // If no token, set pending_manual
    if (!CF_API_TOKEN) {
        await run("UPDATE saas_instances SET domain_status = 'pending_manual', domain_error = 'Missing CF Token' WHERE id = ?", saasId);
        await logDomainEvent(tenantId, saasId, "DOMAIN_MANUAL_REQUIRED", { reason: "Missing CF_API_TOKEN" });
        return { prevStatus: domain_status, newStatus: 'pending_manual', message: 'Verified but manual activation required (Missing API Token).' };
    }

    try {
        // Call Cloudflare API to add domain to Pages project
        const cfRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/pages/projects/${CF_PROJECT_NAME}/domains`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${CF_API_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ name: custom_domain })
        });

        const cfData = await cfRes.json();
        if (!cfRes.ok) {
            throw new Error(cfData.errors?.[0]?.message || "Cloudflare API Error");
        }

        // Success
        await run("UPDATE saas_instances SET domain_status = 'active', domain_error = NULL, domain_last_checked_at = ? WHERE id = ?", new Date().toISOString(), saasId);
        await logDomainEvent(tenantId, saasId, "DOMAIN_ACTIVATED", { domain: custom_domain, cf_response: cfData });

        return { prevStatus: domain_status, newStatus: 'active', message: 'Domain activated successfully.' };

    } catch (error: any) {
        console.error("CF_ACTIVATE_ERROR", error);
        await run("UPDATE saas_instances SET domain_error = ? WHERE id = ?", error.message, saasId);
        await logDomainEvent(tenantId, saasId, "DOMAIN_FAILED", { error: error.message });
        return { prevStatus: domain_status, newStatus: 'failed', message: `Cloudflare activation failed: ${error.message}` };
    }
}

// 5. Get Status
export async function getDomainStatus(tenantId: string, saasId: string) {
    const rows = await queryAll<{
        custom_domain: string;
        trial_domain: string;
        domain_status: string;
        domain_verify_token: string;
        domain_last_checked_at: string;
        domain_error: string;
        slug: string;
    }>(
        "SELECT custom_domain, trial_domain, domain_status, domain_verify_token, domain_last_checked_at, domain_error, slug FROM saas_instances WHERE id = ? AND tenant_id = ?",
        saasId, tenantId
    );
    if (rows.length === 0) return null;
    const row = rows[0];

    return {
        trial_domain: row.trial_domain || getTrialDomain(row.slug),
        custom_domain: row.custom_domain,
        status: row.domain_status,
        verification: {
            token: row.domain_verify_token,
            prefix: VERIFY_PREFIX,
            instruction: `Add a TXT record for ${VERIFY_PREFIX}.${row.custom_domain} with value: ${row.domain_verify_token}`
        },
        last_checked: row.domain_last_checked_at,
        error: row.domain_error
    };
}
