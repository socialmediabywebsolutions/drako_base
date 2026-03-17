import type { Metadata } from 'next';
import { headers } from 'next/headers';
import ClientShell from '@/components/layouts/client-shell';
import { env } from '@/lib/cf';
import type { StrategicDossier } from '@/lib/orchestrator/types';
import {
    buildDemoSocialFlowInstance,
    isSocialFlowInstanceSlug,
    resolveClientTenantIdFromHeaders,
    shouldUseLocalDemoInstance,
} from '@/lib/socialflow-local';
import { getCurrentTenant } from '@/lib/auth/server';

export const metadata: Metadata = {
    title: 'Drako Tenant Workspace',
    description: 'Shared tenant workspace for factory-produced SaaS operators',
    robots: {
        index: false,
        follow: false,
    },
};

async function getDossier(tenantId: string): Promise<StrategicDossier | null> {
    const bindings = env();
    if (!bindings?.DRACO_DB) return null;

    try {
        const row = await bindings.DRACO_DB.prepare(
            `SELECT * FROM tenant_strategic_dossiers WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1`
        ).bind(tenantId).first<any>();

        if (!row) return null;

        return {
            ...row,
            form_data: JSON.parse(row.form_data as string),
            analysis_data: row.analysis_data ? JSON.parse(row.analysis_data as string) : undefined,
            plan_data: row.plan_data ? JSON.parse(row.plan_data as string) : undefined,
        };
    } catch {
        return null;
    }
}

async function getSaaSInstance(tenantId: string, allowLocalDemo: boolean) {
    const bindings = env();
    if (!bindings?.DRACO_DB) return allowLocalDemo ? buildDemoSocialFlowInstance(tenantId) : null;
    try {
        const instance = await bindings.DRACO_DB.prepare(
            `SELECT * FROM saas_instances WHERE tenant_id = ? AND status IN ('active', 'trial_active') ORDER BY updated_at DESC LIMIT 1`
        ).bind(tenantId).first<any>();
        if (instance) return instance;
        return allowLocalDemo ? buildDemoSocialFlowInstance(tenantId) : null;
    } catch {
        return allowLocalDemo ? buildDemoSocialFlowInstance(tenantId) : null;
    }
}

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
    const headersList = await headers();
    const currentTenant = await getCurrentTenant();
    const tenantId = currentTenant?.tenant.id ?? resolveClientTenantIdFromHeaders(headersList);
    const dossier = tenantId ? await getDossier(tenantId) : null;
    const entryMode = headersList.get("x-drako-client-entry-mode") ?? "product_operator";
    const allowLocalDemo = shouldUseLocalDemoInstance(headersList);
    const instance = tenantId ? await getSaaSInstance(tenantId, allowLocalDemo) : null;
    const workspaceKind = headersList.get("x-drako-client-workspace-kind") ?? "owned_saas";
    const contentWidth =
        entryMode === "holding_operator" || (instance?.slug && isSocialFlowInstanceSlug(instance.slug))
            ? "wide"
            : "standard";

    return (
        <ClientShell
            dossier={dossier || undefined}
            instance={instance || undefined}
            entryMode={entryMode}
            workspaceKind={workspaceKind}
            contentWidth={contentWidth}
            workspaceSummary={currentTenant ? {
                tenantName: currentTenant.tenant.name,
                tenantSlug: currentTenant.tenant.slug,
                plan: currentTenant.billing?.plan ?? "STARTER",
                billingStatus: currentTenant.billing?.status ?? "inactive",
                onboardingProgress: currentTenant.onboardingSummary.progress,
                onboardingNextStep: currentTenant.onboardingSummary.nextStep,
                currentUserRole: currentTenant.membership.role,
                connectedProducts: currentTenant.connectedProducts.map((product) => ({
                    id: product.id,
                    slug: product.slug,
                    name: product.name,
                    status: product.status,
                })),
            } : undefined}
        >
            {children}
        </ClientShell>
    );
}
