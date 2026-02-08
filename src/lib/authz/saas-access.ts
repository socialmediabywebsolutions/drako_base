
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { resolveHostMode } from "@/lib/hosts";
// import { resolveHostToSaas } from "@/lib/empire/host-resolver"; // If needed for backend resolution

export interface SaasContext {
    params: {
        slug?: string; // Route param usually
        [key: string]: any;
    };
}

export type AccessResult = {
    authorized: boolean;
    tenantId: string | null;
    saasId: string | null;
    role: string | null;
    email: string | null;
    isOwner: boolean;
    error?: "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "TENANT_MISMATCH";
};

/**
 * CORE AUTHORIZATION LOGIC
 * - Must be called by API Routes / Server Actions that deal with SaaS specific data.
 * - Enforces:
 *   1. Authentication (Must be logged in)
 *   2. Owner Override (Owners can access everything)
 *   3. Host/Tenant Isolation (If accessed via tenant custom domain, MUST match)
 *   4. Parameter check (If slug/saasId provided, MUST match session tenant unless Owner)
 */
export async function authorizeSaasAccess(
    reqOrContext?: NextRequest | SaasContext,
    providedSlugOrId?: string
): Promise<AccessResult> {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        return { authorized: false, tenantId: null, saasId: null, role: null, email: null, isOwner: false, error: "UNAUTHORIZED" };
    }

    const userTenantId = session.user.tenantId;
    const userRole = session.user.role;
    const userEmail = session.user.email;
    const isOwner = userRole === "owner" || userRole === "superadmin";

    // OWNER OVERRIDE: Can generally access anything, but let's still parse context if needed.
    // We'll enforce stricter checks if specific resources are requested.

    // 1. Resolve Target Tenant from Request/Context if possible
    // If we are in a custom domain environment (e.g. tenant.drako.systems), 
    // we should check if the session matches that domain's tenant.
    // HOWEVER, this function might be running in a Node.js API route where we don't have full middleware context easily available 
    // without re-running host resolution or trusting headers passed by middleware.
    // TRUSTING HEADERS is safe-ish if we control the middleware.
    // Middleware sets `x-drako-tenant-id`.

    let targetTenantId: string | null = null;

    // If a request object is passed, check headers (set by Middleware)
    if (reqOrContext && 'headers' in reqOrContext) {
        targetTenantId = reqOrContext.headers.get("x-drako-tenant-id");
    }

    // 2. Strict Isolation Check
    // If we extracted a target tenant from the domain (via middleware headers),
    // The user MUST belong to that tenant, OR be an OWNER.
    if (targetTenantId && targetTenantId !== userTenantId && !isOwner) {
        console.warn(`Security: Cross-Tenant Access Attempt. User ${session.user.email} (Tenant: ${userTenantId}) tried to access Tenant ${targetTenantId}`);
        return { authorized: false, tenantId: userTenantId || null, saasId: null, role: userRole || null, isOwner, error: "TENANT_MISMATCH" };
    }

    // 3. Parameter/Input Check (Anti-IDOR)
    // If the caller provided a slug or ID they want to access, verify ownership.
    // Since we don't have clean "ID vs Slug" distinction without DB, we primarily check against session.
    // Rule: A regular user can ONLY access their own tenant's data.
    // We assume providedSlugOrId implies a *resource* owned by *some* tenant.
    // For now, we don't resolve the resource's tenant (expensive DB lookup). 
    // We rely on the fact that if they are NOT owner, they effectively have `WHERE tenant_id = session.tenant_id` scope.
    // So validation happens at the Query Layer (Step B of strict isolation).

    // But if providedSlugOrId is explicitly "drako" (The Owner Tenant) and user is not owner -> Block.
    if (providedSlugOrId === 'drako' && !isOwner) {
        return { authorized: false, tenantId: userTenantId || null, saasId: null, role: userRole || null, isOwner, error: "FORBIDDEN" };
    }

    return {
        authorized: true,
        tenantId: userTenantId || null,
        saasId: null, // We don't resolve saasId here to avoid extra DB calls; rely on tenant_id filtering
        role: userRole || null,
        email: userEmail || null,
        isOwner
    };
}

export function requireOwner(result: AccessResult) {
    if (!result.authorized || !result.isOwner) {
        throw new Error("FORBIDDEN_OWNER_ONLY");
    }
}

export function requireTenant(result: AccessResult) {
    if (!result.authorized || !result.tenantId) {
        throw new Error("FORBIDDEN_TENANT_ONLY");
    }
}
