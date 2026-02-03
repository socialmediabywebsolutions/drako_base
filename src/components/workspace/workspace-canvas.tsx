"use client";

export function WorkspaceCanvas() {
    const phases = [
        { id: 1, name: "Diagnóstico", status: "completed", color: "emerald" },
        { id: 2, name: "Blueprint", status: "active", color: "sky" },
        { id: 3, name: "Design", status: "pending", color: "slate" },
        { id: 4, name: "Deploy", status: "pending", color: "slate" }
    ];

    return (
        <main className="h-screen bg-slate-50 overflow-auto">
            {/* Toolbar */}
            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-900">Workspace</h1>
                    <p className="text-sm text-slate-500 font-medium">Visualiza y gestiona tu proyecto</p>
                </div>
                <div className="flex gap-2">
                    <button className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        Zoom -
                    </button>
                    <button className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        Reset
                    </button>
                    <button className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        Zoom +
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="p-8 space-y-8">
                {/* Timeline */}
                <section className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
                    <h2 className="text-lg font-black text-slate-900 mb-6">Project Timeline</h2>
                    <div className="relative">
                        {/* Progress Line */}
                        <div className="absolute top-6 left-0 w-full h-1 bg-slate-200" />
                        <div className="absolute top-6 left-0 w-1/2 h-1 bg-sky-500 transition-all duration-500" />

                        <div className="relative flex justify-between">
                            {phases.map((phase, idx) => (
                                <div key={phase.id} className="flex flex-col items-center">
                                    <div className={`
                    w-12 h-12 rounded-full flex items-center justify-center font-black text-sm z-10 transition-all
                    ${phase.status === 'completed' ? 'bg-emerald-500 text-white' : ''}
                    ${phase.status === 'active' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30 scale-110' : ''}
                    ${phase.status === 'pending' ? 'bg-white border-2 border-slate-200 text-slate-400' : ''}
                  `}>
                                        {phase.status === 'completed' ? '✓' : idx + 1}
                                    </div>
                                    <p className={`mt-3 text-sm font-bold ${phase.status === 'active' ? 'text-slate-900' : 'text-slate-500'}`}>
                                        {phase.name}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Blueprint Visualization */}
                <section className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
                    <h2 className="text-lg font-black text-slate-900 mb-6">Blueprint Architecture</h2>
                    <div className="bg-slate-50 rounded-xl p-8 border-2 border-dashed border-slate-300 min-h-[400px] flex items-center justify-center">
                        <div className="text-center space-y-4">
                            <svg className="w-16 h-16 mx-auto text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <div>
                                <h3 className="font-black text-slate-700">Blueprint Preview</h3>
                                <p className="text-sm text-slate-500 font-medium mt-1">El diagrama se generará después de la entrevista</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Cost Breakdown */}
                <section className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
                    <h2 className="text-lg font-black text-slate-900 mb-6">Cost Breakdown</h2>
                    <div className="grid md:grid-cols-3 gap-6">
                        <div className="p-6 bg-sky-50 rounded-xl border border-sky-200">
                            <div className="text-xs font-black text-sky-600 uppercase tracking-wider mb-2">Setup Fee</div>
                            <div className="text-3xl font-black text-slate-900">€500</div>
                            <div className="text-xs text-slate-500 font-medium mt-1">One-time payment</div>
                        </div>
                        <div className="p-6 bg-sky-50 rounded-xl border border-sky-200">
                            <div className="text-xs font-black text-sky-600 uppercase tracking-wider mb-2">Per Company</div>
                            <div className="text-3xl font-black text-slate-900">€300</div>
                            <div className="text-xs text-slate-500 font-medium mt-1">× 3 companies = €900</div>
                        </div>
                        <div className="p-6 bg-emerald-50 rounded-xl border border-emerald-200">
                            <div className="text-xs font-black text-emerald-600 uppercase tracking-wider mb-2">Total Cost</div>
                            <div className="text-3xl font-black text-emerald-600">€1,400</div>
                            <div className="text-xs text-slate-500 font-medium mt-1">+ €150/month maintenance</div>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}
