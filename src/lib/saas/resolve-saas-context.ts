
import { env } from "@/lib/cf";
import { type NextRequest } from "next/server";

export type SaasContext = {
    slug: string;
    source: "domain" | "header" | "path" | "env";
};

// Known mappings for dev/test - In prod, this should come from DB/KV
const SAAS_DOMAIN_MAP: Record<string, string> = {
    "drako.systems": "drako",
    "mentoria.education": "mentoria",
    "base.drako.systems": "campamento-base",
    // Dev localhost map
    "drako.localhost": "drako",
    "mentoria.localhost": "mentoria"
};

export function resolveSaasContext(req: NextRequest): SaasContext | null {
    const host = req.headers.get("host") || "";

    // 1. Check Explicit Header (Internal/Dev usage)
    const headerSlug = req.headers.get("x-saas-slug");
    if (headerSlug) {
        return { slug: headerSlug, source: "header" };
    }

    // 2. Check Domain Mapping
    for (const [domain, slug] of Object.entries(SAAS_DOMAIN_MAP)) {
        if (host === domain || host.endsWith(`.${domain}`)) {
            return { slug, source: "domain" };
        }
    }

    // 3. Fallback for Localhost/Preview without subdomains
    // If we are on localhost:3000 and no specific subdomain, maybe use ENV default?
    // Or check path prefix? e.g. /api/mentoria/...

    // For now, FAIL CLOSED if not resolvable.
    // Exception: If we are in 'campamento-base' context (root admin), 
    // maybe we default to 'campamento-base'?

    // Implicit rule: If no match, return null.
    return null;
}

export function requireSaasSlug(req: NextRequest): string {
    const ctx = resolveSaasContext(req);
    if (!ctx) {
        throw new Error("SAAS_CONTEXT_UNRESOLVABLE");
    }
    return ctx.slug;
}
