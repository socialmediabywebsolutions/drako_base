'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { generateBlueprint } from '../actions';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';

export default function PlanPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Note: Real implementation would fetch plan server-side and pass as prop or hydration.
    // For this flow, we trigger generation client-side if missing.
    // Ideally, Page checks if plan exists. If not, shows "Generate" button.

    async function handleGenerate() {
        setLoading(true);
        setError('');

        // Simulate thinking for UX
        await new Promise(r => setTimeout(r, 1000));

        const res = await generateBlueprint();
        if (res?.error) {
            setError(res.error);
            setLoading(false);
        } else {
            // Refresh to show Generated Plan
            router.refresh();
            setLoading(false);
        }
    }

    return (
        <div className="py-12 px-6 max-w-5xl mx-auto space-y-8">

            <div className="text-center space-y-4">
                <h1 className="text-3xl font-bold text-slate-900">Blueprint de Materialización</h1>
                <p className="text-slate-500 max-w-2xl mx-auto">
                    Basado en tu estrategia, aquí está la arquitectura técnica y de negocio para tu SaaS.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                {/* ARCHITECTURE */}
                <Card title="Arquitectura del Sistema" tone="brand">
                    <div className="p-4 flex flex-col items-center justify-center text-center space-y-4 min-h-[200px]">
                        {loading ? (
                            <div className="animate-pulse">Diseñando Arquitectura...</div>
                        ) : (
                            <>
                                <div className="text-5xl">🏗️</div>
                                <p className="text-sm text-slate-500">
                                    Haz clic para generar tu Blueprint personalizado.
                                </p>
                                <Button
                                    onClick={handleGenerate}
                                    disabled={loading}
                                    variant="primary"
                                >
                                    {loading ? 'Generando...' : 'Generar Blueprint SaaS'}
                                </Button>
                            </>
                        )}
                        {error && <p className="text-red-500 text-xs">{error}</p>}
                    </div>
                </Card>

                {/* MOCK PREVIEW (Until Generated) */}
                <Card title="Stack Tecnológico" tone="glass">
                    <div className="p-4 space-y-4 opacity-50 blur-[1px]">
                        <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                        <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                        <div className="h-4 bg-slate-200 rounded w-full"></div>
                    </div>
                </Card>

            </div>
        </div>
    );
}
