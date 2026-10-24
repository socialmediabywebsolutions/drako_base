"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type BillingGateProps = {
    children: React.ReactNode;
    saas: {
        id: string;
        slug: string;
        lifecycle_status: string; // 'active' | 'past_due' | 'paused' | 'archived'
        past_due_since?: string | null;
        paused_at?: string | null;
    };
    gateType?: "full" | "banner" | "partial"; // partial blocks expensive actions but allows view
};

export function BillingGate({ children, saas, gateType = "full" }: BillingGateProps) {
    const router = useRouter();

    const isPastDue = saas.lifecycle_status === 'past_due';
    const isPaused = saas.lifecycle_status === 'paused' || saas.lifecycle_status === 'archived';

    const daysPastDue = useMemo(() => {
        if (!saas.past_due_since) return 0;
        const start = new Date(saas.past_due_since);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - start.getTime());
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }, [saas.past_due_since]);

    const handleReactivate = () => {
        // Redirect to billing portal API which handles Stripe session creation
        window.location.href = `/api/billing/portal?saasId=${saas.id}`;
    };

    // 1. PAUSED / ARCHIVED -> Full Block (Blur)
    if (isPaused) {
        return (
            <div className="relative w-full h-full min-h-[500px]">
                {/* Check if user wants to see partial content even if paused? Usually no. */}
                <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center text-center p-8">
                    <div className="max-w-md space-y-6">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900">
                            Servicio Pausado
                        </h2>
                        <p className="text-slate-500">
                            Esta instancia ha sido pausada debido a falta de pago o acción administrativa.
                            Para restaurar el acceso completo y reactivar sus agentes, por favor actualice su método de pago.
                        </p>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleReactivate}
                                className="w-full py-3 px-4 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-colors shadow-lg"
                            >
                                Reactivar Servicio
                            </button>
                            <Link href="/site/support" className="text-sm text-slate-500 hover:text-slate-800 underline">
                                Contactar Soporte
                            </Link>
                        </div>

                        {saas.paused_at && (
                            <p className="text-xs text-slate-400 mt-4">
                                Pausado el: {new Date(saas.paused_at).toLocaleDateString()}
                            </p>
                        )}
                    </div>
                </div>
                {/* Render children blurred behind */}
                <div className="filter blur-sm pointer-events-none select-none opacity-50" aria-hidden="true">
                    {children}
                </div>
            </div>
        );
    }

    // 2. PAST DUE -> Persistent Banner
    if (isPastDue) {
        // Calculate days remaining in grace period (assuming 7 days grace)
        const graceDaysTotal = 7;
        const daysRemaining = Math.max(0, graceDaysTotal - daysPastDue);

        return (
            <div className="flex flex-col h-full w-full">
                <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center justify-between sticky top-0 z-40">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-amber-100 rounded-full text-amber-700">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-sm font-bold text-amber-900">
                                Pago Requerido
                            </p>
                            <p className="text-xs text-amber-700">
                                Tienes <b>{daysRemaining} días</b> para regularizar antes de la pausa automática.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleReactivate}
                        className="px-4 py-1.5 bg-amber-600 text-white text-xs font-bold rounded hover:bg-amber-700 transition-colors shadow-sm whitespace-nowrap"
                    >
                        Pagar Ahora
                    </button>
                </div>
                {children}
            </div>
        );
    }

    // 3. ACTIVE -> Normal Render
    return <>{children}</>;
}
