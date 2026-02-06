'use client';

import React from 'react';
import Card from '@/components/ui/card';
import { secureSaaS } from '@/app/client/actions';

interface DomainSettingsProps {
    instance: any;
}

export default function DomainSettings({ instance }: DomainSettingsProps) {
    if (!instance) return null;

    const isLocked = instance.status === 'trial' || instance.status === 'trial_active';
    const subDomain = `${instance.slug}.drako.systems`;

    const handleUnlock = async () => {
        await secureSaaS(instance.id);
        alert("Iniciando Upgrade para desbloquear dominio...");
    };

    return (
        <Card tone="glass">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-800">Dominios</h3>
                {isLocked && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded font-mono">🔒 LOCKED</span>}
            </div>

            <div className="space-y-4">
                {/* Default Subdomain */}
                <div>
                    <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Subdominio Drako (Gratis)</label>
                    <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded text-xs font-mono text-slate-600">
                            https://{subDomain}
                        </div>
                        <span className="text-xs text-green-500 font-bold">Activo</span>
                    </div>
                </div>

                {/* Custom Domain (Locked) */}
                <div className={`relative ${isLocked ? 'opacity-60 grayscale' : ''}`}>
                    <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Dominio Personalizado</label>
                    <div className="flex items-center gap-2 mt-1">
                        <input
                            disabled={isLocked}
                            placeholder="tudominio.com"
                            className="flex-1 p-2 bg-white border border-slate-200 rounded text-xs outline-none focus:ring-2 focus:ring-sky-500"
                        />
                        <button
                            disabled={isLocked}
                            className="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded"
                        >
                            Conectar
                        </button>
                    </div>

                    {/* Lock Overlay */}
                    {isLocked && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-[1px]">
                            <button
                                onClick={handleUnlock}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 shadow-lg rounded-full text-xs font-bold text-slate-800 hover:text-green-600 hover:border-green-200 transition-all"
                            >
                                🔒 Desbloquear (Upgrade)
                            </button>
                        </div>
                    )}
                </div>

                {isLocked && (
                    <p className="text-[10px] text-slate-400 text-center">
                        El dominio propio es una feature exclusiva de planes Activos.
                    </p>
                )}
            </div>
        </Card>
    );
}
