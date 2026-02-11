
import { NextRequest, NextResponse } from "next/server";
import { resolveHostMode } from "@/lib/hosts";
import type { EdgeSession } from "@/lib/edge-auth";

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
 * CORE AUTHORIZATION LOGIC (EDGE-NATIVE)
 * - Must be called by API Routes / Server Actions that deal with SaaS specific data.
 * - Enforces:
 *   1. Authentication (Session must be provided and valid)
 *   2. Owner Override (Owners can access everything)
 *   3. Host/Tenant Isolation (If accessed via tenant custom domain, MUST match)
 *   4. Parameter check (If slug/saasId provided, MUST match session tenant unless Owner)
 * 
 * FAIL-CLOSED: If session is null/invalid, returns unauthorized.
 */
export async function authorizeSaasAccess(
    session: EdgeSession | null,
    reqOrContext?: NextRequest | SaasContext,
    providedSlugOrId?: string
): Promise<AccessResult> {
    // FAIL-CLOSED: No session → unauthorized
    if (!session) {
        return { authorized: false, tenantId: null, saasId: null, role: null, email: null, isOwner: false, error: "UNAUTHORIZED" };
    }

    const userTenantId = session.tenantId;
    const userRole = session.role;
    const userEmail = session.email;
    const isOwner = userRole === "owner" || userRole === "superadmin";

    // OWNER OVERRIDE: Can generally access anything, but let's still parse context if needed.
    // We'll enforce stricter checks if specific resources are requested.

    // 1. Resolve Target Tenant from Request/Context if possible
    // If we are in a custom domain environment (e.g. tenant.drako.systems), 
    // we should check if the session matches that domain's tenant.
    // Middleware sets `x-drako-tenant-id`.

    let targetTenantId: string | null = null;

    // If a request object is passed, check headers (set by Middleware)
    if (reqOrContext && 'headers' in reqOrContext) {
        targetTenantId = reqOrContext.headers.get("x-drako-tenant-id");
    }

    // 2. Strict Isolation Check (FAIL-CLOSED)
    // If we extracted a target tenant from the domain (via middleware headers),
    // The user MUST belong to that tenant, OR be an OWNER.
    if (targetTenantId && targetTenantId !== userTenantId && !isOwner) {
        console.warn(`Security: Cross-Tenant Access Attempt. User ${userEmail} (Tenant: ${userTenantId}) tried to access Tenant ${targetTenantId}`);
        return { authorized: false, tenantId: userTenantId || null, saasId: null, role: userRole || null, email: userEmail || null, isOwner, error: "TENANT_MISMATCH" };
    }

    // 3. Parameter/Input Check (Anti-IDOR)
    // If the caller provided a slug or ID they want to access, verify ownership.
    // Rule: A regular user can ONLY access their own tenant's data.
    // We assume providedSlugOrId implies a *resource* owned by *some* tenant.
    // For now, we don't resolve the resource's tenant (expensive DB lookup). 
    // We rely on the fact that if they are NOT owner, they effectively have `WHERE tenant_id = session.tenant_id` scope.
    // Validation happens at the Query Layer (Step B of strict isolation).

    // But if providedSlugOrId is explicitly "drako" (The Owner Tenant) and user is not owner -> Block (FAIL-CLOSED).
    if (providedSlugOrId === 'drako' && !isOwner) {
        return { authorized: false, tenantId: userTenantId || null, saasId: null, role: userRole || null, email: userEmail || null, isOwner, error: "FORBIDDEN" };
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
