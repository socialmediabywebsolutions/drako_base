import type { Metadata } from 'next';
import { headers } from 'next/headers';
import ClientShell from '@/components/layouts/client-shell';
import { env } from '@/lib/cf';
import type { StrategicDossier } from '@/lib/orchestrator/types';

export const metadata: Metadata = {
    title: 'Drako Client Profile',
    description: 'Secure Client Environment',
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

async function getSaaSInstance(tenantId: string) {
    const bindings = env();
    if (!bindings?.DRACO_DB) return null;
    try {
        return await bindings.DRACO_DB.prepare(
            `SELECT * FROM saas_instances WHERE tenant_id = ? AND status = 'trial_active'`
        ).bind(tenantId).first<any>();
    } catch {
        return null;
    }
}

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
    const headersList = await headers();
    const tenantId = headersList.get('x-drako-tenant-id') || headersList.get('x-tenant-id');
    const dossier = tenantId ? await getDossier(tenantId) : null;
    const instance = tenantId ? await getSaaSInstance(tenantId) : null;

    return (
        <ClientShell dossier={dossier || undefined} instance={instance || undefined}>
            {children}
        </ClientShell>
    );
}
