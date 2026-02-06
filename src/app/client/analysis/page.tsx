'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { startAutoAnalysis } from '../actions';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';

export default function AnalysisPage() {
    const router = useRouter();
    const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
    const [log, setLog] = useState<string[]>([]);

    useEffect(() => {
        if (status === 'idle') {
            run();
        }
    }, []);

    async function run() {
        setStatus('running');
        setLog(prev => [...prev, "Iniciando Motor de Análisis Drako..."]);

        // Simulate steps for UX
        setTimeout(() => setLog(prev => [...prev, "Escaneando Huella Digital..."]), 1000);
        setTimeout(() => setLog(prev => [...prev, "Consultando Google Maps (Geo-Agent)..."]), 2000);
        setTimeout(() => setLog(prev => [...prev, "Analizando Competencia (Llama-3)..."]), 3500);

        const res = await startAutoAnalysis();

        if (res?.error) {
            setLog(prev => [...prev, `ERROR: ${res.error}`]);
            setStatus('error');
        } else {
            setLog(prev => [...prev, "✅ Análisis Completado. Generando Dossier..."]);
            setStatus('success');
            setTimeout(() => {
                router.push('/client'); // Redirect to Dashboard HUB
            }, 1500);
        }
    }

    return (
        <div className="py-12 px-6 max-w-4xl mx-auto">
            <Card title="Análisis Estratégico en Curso" tone="brand" icon={<span className="text-2xl">⚡️</span>}>
                <div className="py-8 text-center space-y-6">

                    <div className="space-y-2">
                        <h2 className="text-xl font-bold animate-pulse">
                            {status === 'running' ? 'Procesando Información...' : status === 'success' ? '¡Análisis Listo!' : 'Error en Análisis'}
                        </h2>
                        <p className="text-muted-foreground">Estamos construyendo tu Dossier Estratégico.</p>
                    </div>

                    <div className="max-w-md mx-auto bg-slate-950 text-green-400 font-mono text-xs p-4 rounded-lg text-left h-48 overflow-y-auto border border-slate-800 shadow-inner">
                        {log.map((l, i) => (
                            <div key={i} className="mb-1">{l}</div>
                        ))}
                        {status === 'running' && <span className="animate-pulse">_</span>}
                    </div>

                    {status === 'error' && (
                        <Button onClick={() => window.location.reload()} variant="primary">
                            Reintentar
                        </Button>
                    )}

                </div>
            </Card>
        </div>
    );
}
