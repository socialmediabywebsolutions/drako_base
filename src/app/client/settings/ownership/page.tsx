'use client';

import React, { useState } from 'react';
import { Download, ShieldCheck, AlertTriangle } from 'lucide-react';

type SaasListResponse = {
    items?: Array<{ id: string; slug: string }>;
};

export default function OwnershipPage() {
    const [downloading, setDownloading] = useState(false);

    // We get the SaaS ID from the URL or Context usually. 
    // But since this is inside /client, we are in the context of the tenant's primary SaaS usually.
    // However, the export API requires `saasId`.
    // We can fetch the primary SaaS ID or list them.
    // For simplicity in Phase 13, let's assume we can get it from a server action or we fetch it first.
    // OR we assume the API handles "current tenant's primary SaaS" if saasId is missing?
    // The requirement said: /api/saas/export?saasId=...
    // ClientLayout provides `instance` to ClientShell, but we are a page inside.
    // We can assume we have access to the instance ID via a prop if we were a component, but as a page we fetch it or use a hook if available.
    // Let's implement a simple fetch to get the current SaaS ID first, or rely on a known context.
    // Actually, `ClientLayout` fetches instance. We can pass it down? No, layouts wrap pages.
    // We should fetch the *current* instance ID for the user context. 
    // Let's assume there is an action or endpoint to get "my instance".
    // Or we just fetch /api/saas?limit=1 and take the first one.

    const handleDownload = async () => {
        try {
            setDownloading(true);

            // 1. Get SaaS ID (Quick fetch to own API to resolve "my" instance)
            const saasRes = await fetch('/api/saas');
            if (!saasRes.ok) throw new Error("Could not resolve SaaS Instance");
            const saasData = await saasRes.json() as SaasListResponse;
            const instance = saasData.items?.[0]; // Assuming single instance for now per tenant context in Client Portal

            if (!instance) {
                alert("No SaaS instance found to export.");
                return;
            }

            // 2. Trigger Download
            const exportUrl = `/api/saas/export?saasId=${instance.id}`;

            // We use standard browser download behavior
            // We can't use fetch for download efficiently if we want to show progress, 
            // but for a simple "click to download":
            const link = document.createElement('a');
            link.href = exportUrl;
            link.download = `drako-export-${instance.slug}.zip`; // The server sets Content-Disposition anyway
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (error) {
            console.error(error);
            alert("Error initiating download.");
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-2xl font-black text-slate-800">Ownership & Assets</h1>
                <p className="text-slate-500 text-sm mt-1">Manage legal ownership, exports, and intellectual property rights.</p>
            </div>

            {/* MY ASSETS */}
            <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                    <Download className="w-24 h-24" />
                </div>

                <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-green-600" />
                    My Assets
                </h2>

                <div className="prose prose-sm text-slate-600 mb-6">
                    <p>
                        Drako Infrastructure guarantees that you own your data and architecture.
                        You can download a full compliance package at any time. This package includes:
                    </p>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                        <li><strong>Strategic Dossier:</strong> Your business DNA and analysis.</li>
                        <li><strong>Engineering Blueprint:</strong> The architectural map of your software.</li>
                        <li><strong>Execution Logs:</strong> Proof of work for all AI agents.</li>
                        <li><strong>Financials:</strong> Economic events and cost breakdowns.</li>
                    </ul>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex items-center justify-between">
                    <div>
                        <div className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-1">Full Export</div>
                        <div className="text-sm font-medium text-slate-900">Standard Wipeout Package (.zip)</div>
                    </div>
                    <button
                        onClick={handleDownload}
                        disabled={downloading}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
                    >
                        {downloading ? (
                            <>
                                <span className="animate-spin">⏳</span>
                                Compressing...
                            </>
                        ) : (
                            <>
                                <Download className="w-4 h-4" />
                                Download Full Backup
                            </>
                        )}
                    </button>
                </div>
            </section>

            {/* TRANSFER OWNERSHIP (Stub) */}
            <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm opacity-75">
                <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    Transfer Ownership
                </h2>
                <p className="text-sm text-slate-500 mb-4">
                    Transferring ownership of this SaaS infrastructure requires legal validation and a new billing contract.
                    This process is irreversible.
                </p>
                <div className="bg-amber-50 border border-amber-100 p-4 rounded text-xs text-amber-800">
                    <strong>Notice:</strong> Automated ownership transfer is currently disabled for security reasons.
                    Please contact Enterprise Support to initiate a holding transfer.
                </div>
            </section>
        </div>
    );
}
