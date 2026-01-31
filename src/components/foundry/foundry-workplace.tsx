"use client";

import React, { useState } from "react";
import { FoundryLayout } from "@/components/layouts/foundry-layout";
import { motion } from "framer-motion";

import { type BlueprintResponse, type ChatMessage } from "@/lib/campamento-base/ai-blueprint-v2/prompts";
import { EliteContract } from "./elite-contract";
import { StripeWizard } from "./stripe-wizard";
import { EdgeProvisioningWizard } from "./edge-provisioning-wizard";
import { NeuralForgeWizard } from "./neural-forge-wizard";
import { BrandingForgeWizard } from "./branding-forge-wizard";
import { GDPRForgeWizard } from "./gdpr-forge-wizard";
import { ModuleForgeWizard } from "./module-forge-wizard";
import { SalesForgeWizard } from "./sales-forge-wizard";

interface ProjectContract {
    id: string;
    content_markdown: string;
    status: string;
}

interface FoundryWorkplaceProps {
    blueprint: BlueprintResponse | null;
}

export function FoundryWorkplace({ blueprint }: FoundryWorkplaceProps) {
    const [contract, setContract] = useState<ProjectContract | null>(null);
    const [showDashboard, setShowDashboard] = useState(false);
    const [showStripeWizard, setShowStripeWizard] = useState(false);
    const [fintechStatus, setFintechStatus] = useState<"WAITING" | "IN_PROGRESS" | "COMPLETE">("WAITING");
    const [showEdgeWizard, setShowEdgeWizard] = useState(false);
    const [edgeStatus, setEdgeStatus] = useState<"WAITING" | "IN_PROGRESS" | "COMPLETE">("WAITING");
    const [showNeuralWizard, setShowNeuralWizard] = useState(false);
    const [neuralStatus, setNeuralStatus] = useState<"WAITING" | "IN_PROGRESS" | "COMPLETE">("WAITING");
    const [showBrandingWizard, setShowBrandingWizard] = useState(false);
    const [brandingStatus, setBrandingStatus] = useState<"WAITING" | "IN_PROGRESS" | "COMPLETE">("WAITING");
    const [showGdprWizard, setShowGdprWizard] = useState(false);
    const [gdprStatus, setGdprStatus] = useState<"WAITING" | "IN_PROGRESS" | "COMPLETE">("WAITING");
    const [showModuleWizard, setShowModuleWizard] = useState(false);
    const [moduleStatus, setModuleStatus] = useState<"WAITING" | "IN_PROGRESS" | "COMPLETE">("WAITING");
    const [showSalesWizard, setShowSalesWizard] = useState(false);
    const [salesStatus, setSalesStatus] = useState<"WAITING" | "IN_PROGRESS" | "COMPLETE">("WAITING");

    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: "assistant", content: `¡Hola de nuevo! Ya he cargado toda la inteligencia de tu negocio (**${blueprint?.understanding || 'SaaS'}**) en la Foundry.\n\nEstamos en la **Fase de Construcción**. El blueprint inicial está listo. ¿Quieres que ajustemos algún módulo o empezamos con el provisionamiento de Stripe?` }
    ]);

    // Initialize Contract
    React.useEffect(() => {
        const initContract = async () => {
            if (!blueprint) return;
            try {
                const res = await fetch("/api/campamento-base/contracts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        projectId: blueprint.detectedKnowledge?.identity?.name ?
                            (blueprint.detectedKnowledge.identity.name as string).toLowerCase().replace(/\s+/g, '-') :
                            crypto.randomUUID(),
                        projectName: (blueprint.detectedKnowledge?.identity as Record<string, unknown>)?.name as string,
                        blueprint
                    })
                });
                const data = (await res.json()) as { contract?: ProjectContract };
                if (data.contract) {
                    setContract(data.contract);
                    setShowDashboard(data.contract.status === "SIGNED");
                }
            } catch (err) {
                console.error("Error al inicializar contrato:", err);
            }
        };
        void initContract();
    }, [blueprint]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);

    const handleSendMessage = async () => {
        if (!input.trim() || isTyping) return;
        const userMsg: ChatMessage = { role: "user", content: input };
        setMessages(prev => [...prev, userMsg]);
        const currentInput = input;
        setInput("");
        setIsTyping(true);

        try {
            const response = await fetch("/api/campamento-base/saas-factory/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: currentInput,
                    history: messages,
                    blueprint: blueprint
                })
            });
            const data = (await response.json()) as { reply?: string };
            if (data.reply) {
                const assistantMsg: ChatMessage = { role: "assistant", content: data.reply };
                setMessages(prev => [...prev, assistantMsg]);
            }
        } catch (e) {
            console.error(e);
            const errorMsg: ChatMessage = { role: "assistant", content: "Lo siento, ha habido un error en la conexión con la fábrica. Por favor, reintenta." };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleReset = () => {
        if (confirm("¿Estás seguro de que desea BORRAR todo este proyecto y volver a la consultoría inicial? Esta acción no se puede deshacer.")) {
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = "/site";
        }
    };

    return (
        <FoundryLayout
            chatInput={input}
            onChatInputChange={setInput}
            onSendMessage={handleSendMessage}
            onReset={handleReset}
            chatComponent={
                <div className="flex flex-col h-full space-y-4">
                    {messages.map((m, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`p-4 rounded-2xl text-xs leading-relaxed ${m.role === "user"
                                ? "bg-slate-100 text-slate-800 ml-8 rounded-tr-none"
                                : "bg-slate-900 text-white mr-8 rounded-tl-none shadow-lg"
                                }`}
                        >
                            {m.content.split("\n").map((line: string, idx: number) => (
                                <p key={idx} className={idx > 0 ? "mt-2" : ""}>{line}</p>
                            ))}
                        </motion.div>
                    ))}
                    {isTyping && (
                        <div className="flex gap-1 p-2">
                            <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" />
                            <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce delay-75" />
                            <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce delay-150" />
                        </div>
                    )}
                </div>
            }
        >
            <div className="space-y-12">
                {!showDashboard ? (
                    <div className="flex items-center justify-center py-20">
                        {contract ? (
                            <EliteContract
                                contractId={contract.id}
                                projectId={blueprint?.detectedKnowledge?.identity?.name ?
                                    (blueprint.detectedKnowledge.identity.name as string).toLowerCase().replace(/\s+/g, '-') :
                                    'pending'}
                                projectName={(blueprint?.detectedKnowledge?.identity as Record<string, unknown>)?.name as string || 'Proyecto'}
                                content={contract.content_markdown}
                                onSigned={() => setShowDashboard(true)}
                            />
                        ) : (
                            <div className="flex flex-col items-center gap-6">
                                <div className="w-16 h-16 rounded-full border-4 border-brand border-t-transparent animate-spin shadow-[0_0_20px_var(--brand-glow)]" />
                                <p className="text-technical text-[10px] text-brand font-black uppercase tracking-[0.6em] animate-pulse">Sincronizando Acuerdo Legal...</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Banner de Bienvenida - Proto Protocol */}
                        <header className="relative p-12 rounded-[3rem] bg-slate-900 border border-white/5 text-white overflow-hidden shadow-2xl">
                            <div className="absolute top-0 right-0 w-80 h-80 bg-brand/10 blur-[120px] rounded-full" />
                            <div className="relative z-10">
                                <h2 className="text-4xl font-black mb-3 italic uppercase tracking-tighter">
                                    Bienvenido a su Fábrica, <span className="text-brand">Partner.</span>
                                </h2>
                                <p className="text-slate-400 font-bold max-w-xl text-sm leading-relaxed tracking-wide">
                                    Protocolo de materialización iniciado. Estamos orquestando la infraestructura basada en su visión estratégica.
                                </p>
                            </div>
                        </header>

                        {/* Grid de Inteligencia (La Pizarra) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* ROI Card */}
                            <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5 border-l-brand border-l-4">
                                <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 mb-6 font-mono">Métrica de Impacto (ROI)</h4>
                                <div className="flex items-end gap-3 mb-3">
                                    <span className="text-5xl font-black text-white tracking-tighter">€{blueprint?.pricing?.monthly || 0}</span>
                                    <span className="text-[10px] font-black text-success mb-3 uppercase tracking-widest">AHORRO / MES</span>
                                </div>
                                <p className="text-xs text-slate-400 font-medium italic">Eficiencia operativa detectada por Drako Analytics.</p>
                            </div>

                            {/* Social Score Card */}
                            <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5 border-l-cyan-500 border-l-4">
                                <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 mb-6 font-mono">Visibility Score (Audit)</h4>
                                <div className="flex items-end gap-3 mb-3">
                                    <span className="text-5xl font-black text-white tracking-tighter">{blueprint?.detectedKnowledge?.digitalAudit?.webScore ?? 85}%</span>
                                    <span className="text-[10px] font-black text-cyan-400 mb-3 uppercase tracking-widest">SALUD DIGITAL</span>
                                </div>
                                <p className="text-xs text-slate-400 font-medium italic">Puntuación de optimización en su ecosistema web.</p>
                            </div>
                        </div>

                        {/* Tech Stack / Pipeline */}
                        <div className="bg-slate-900/50 backdrop-blur-xl p-10 rounded-[3rem] border border-white/5 shadow-inner">
                            <h3 className="font-black text-xl mb-10 flex items-center gap-3 uppercase tracking-widest text-white italic">
                                <span className="w-2 h-8 bg-brand rounded-full shadow-[0_0_15px_var(--brand-glow)]" />
                                Pipeline de Construcción Live
                            </h3>
                            <div className="space-y-6">
                                {[
                                    { name: "SaaS Blueprinting", status: "COMPLETE", progress: 100 },
                                    {
                                        name: "Identidad Visual",
                                        status: brandingStatus,
                                        progress: brandingStatus === 'COMPLETE' ? 100 : 0,
                                        action: () => {
                                            if (brandingStatus === 'WAITING' || brandingStatus === 'IN_PROGRESS') setShowBrandingWizard(true);
                                        }
                                    },
                                    {
                                        name: "Gobernanza & GDPR",
                                        status: gdprStatus,
                                        progress: gdprStatus === 'COMPLETE' ? 100 : 0,
                                        action: () => {
                                            if (gdprStatus === 'WAITING' || gdprStatus === 'IN_PROGRESS') setShowGdprWizard(true);
                                        }
                                    },
                                    {
                                        name: "Capacidades Funcionales",
                                        status: moduleStatus,
                                        progress: moduleStatus === 'COMPLETE' ? 100 : 0,
                                        action: () => {
                                            if (moduleStatus === 'WAITING' || moduleStatus === 'IN_PROGRESS') setShowModuleWizard(true);
                                        }
                                    },
                                    {
                                        name: "Crecimiento & Ventas",
                                        status: salesStatus,
                                        progress: salesStatus === 'COMPLETE' ? 100 : 0,
                                        action: () => {
                                            if (salesStatus === 'WAITING' || salesStatus === 'IN_PROGRESS') setShowSalesWizard(true);
                                        }
                                    },
                                    {
                                        name: "Provisionamiento Edge",
                                        status: edgeStatus,
                                        progress: edgeStatus === 'COMPLETE' ? 100 : 35,
                                        action: () => {
                                            if (edgeStatus === 'WAITING' || edgeStatus === 'IN_PROGRESS') setShowEdgeWizard(true);
                                        }
                                    },
                                    {
                                        name: "Integración Fintech",
                                        status: fintechStatus,
                                        progress: fintechStatus === 'COMPLETE' ? 100 : 0,
                                        action: () => {
                                            if (fintechStatus === 'WAITING') setShowStripeWizard(true);
                                        }
                                    },
                                    {
                                        name: "Arquitectura Neural",
                                        status: neuralStatus,
                                        progress: neuralStatus === 'COMPLETE' ? 100 : 0,
                                        action: () => {
                                            if (neuralStatus === 'WAITING' || neuralStatus === 'IN_PROGRESS') setShowNeuralWizard(true);
                                        }
                                    }
                                ].map((step, i) => (
                                    <div
                                        key={i}
                                        onClick={step.action}
                                        className={`space-y-2 ${step.action ? 'cursor-pointer hover:bg-white/5 p-2 -m-2 rounded-xl transition-colors' : ''}`}
                                    >
                                        <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.2em]">
                                            <span className="text-slate-400">{step.name}</span>
                                            <span className={step.status === 'COMPLETE' ? 'text-success' : 'text-slate-500'}>{step.status}</span>
                                        </div>
                                        <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${step.progress}%` }}
                                                transition={{ duration: 1.5, delay: i * 0.3 }}
                                                className={`h-full ${step.status === 'COMPLETE' ? 'bg-success shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-brand shadow-[0_0_15px_var(--brand-glow)]'}`}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {showStripeWizard && blueprint && (
                            <StripeWizard
                                saasId={blueprint.detectedKnowledge?.identity?.name ?
                                    (blueprint.detectedKnowledge.identity.name as string).toLowerCase().replace(/\s+/g, '-') :
                                    'draft'}
                                saasName={(blueprint.detectedKnowledge?.identity as Record<string, unknown>)?.name as string || 'New SaaS'}
                                suggestedPricing={{
                                    monthly: blueprint.pricing?.monthly || 49,
                                    yearly: blueprint.pricing?.yearly || 490,
                                    rationale: blueprint.pricing?.rationale
                                }}
                                onComplete={() => {
                                    setFintechStatus("COMPLETE");
                                    setShowStripeWizard(false);
                                }}
                                onCancel={() => setShowStripeWizard(false)}
                            />
                        )}

                        {showEdgeWizard && blueprint && (
                            <EdgeProvisioningWizard
                                saasId={blueprint.detectedKnowledge?.identity?.name ?
                                    (blueprint.detectedKnowledge.identity.name as string).toLowerCase().replace(/\s+/g, '-') :
                                    'draft'}
                                projectName={(blueprint.detectedKnowledge?.identity as Record<string, unknown>)?.name as string || 'New SaaS'}
                                subdomain={blueprint.detectedKnowledge?.identity?.name ?
                                    (blueprint.detectedKnowledge.identity.name as string).toLowerCase().replace(/\s+/g, '-') :
                                    'draft'}
                                customDomain={null} // TODO: Extract from blueprint if available
                                onComplete={() => {
                                    setEdgeStatus("COMPLETE");
                                    setShowEdgeWizard(false);
                                }}
                                onCancel={() => setShowEdgeWizard(false)}
                            />
                        )}

                        {showNeuralWizard && blueprint && (
                            <NeuralForgeWizard
                                saasId={blueprint.detectedKnowledge?.identity?.name ?
                                    (blueprint.detectedKnowledge.identity.name as string).toLowerCase().replace(/\s+/g, '-') :
                                    'draft'}
                                projectName={(blueprint.detectedKnowledge?.identity as Record<string, unknown>)?.name as string || 'New SaaS'}
                                packs={{
                                    marketing: "FULL",
                                    support: "BASIC"
                                }} // TODO: Extract actual selected packs from blueprint
                                onComplete={() => {
                                    setNeuralStatus("COMPLETE");
                                    setShowNeuralWizard(false);
                                }}
                                onCancel={() => setShowNeuralWizard(false)}
                            />
                        )}

                        {showBrandingWizard && blueprint && (
                            <BrandingForgeWizard
                                saasId={blueprint.detectedKnowledge?.identity?.name ?
                                    (blueprint.detectedKnowledge.identity.name as string).toLowerCase().replace(/\s+/g, '-') :
                                    'draft'}
                                projectName={(blueprint.detectedKnowledge?.identity as Record<string, unknown>)?.name as string || 'New SaaS'}
                                onComplete={() => {
                                    setBrandingStatus("COMPLETE");
                                    setShowBrandingWizard(false);
                                }}
                                onCancel={() => setShowBrandingWizard(false)}
                            />
                        )}

                        {showGdprWizard && blueprint && (
                            <GDPRForgeWizard
                                saasId={blueprint.detectedKnowledge?.identity?.name ?
                                    (blueprint.detectedKnowledge.identity.name as string).toLowerCase().replace(/\s+/g, '-') :
                                    'draft'}
                                projectName={(blueprint.detectedKnowledge?.identity as Record<string, unknown>)?.name as string || 'New SaaS'}
                                vertical={(blueprint.detectedKnowledge?.identity as Record<string, unknown>)?.niche as string | undefined}
                                businessVision={blueprint.understanding}
                                onComplete={() => {
                                    setGdprStatus("COMPLETE");
                                    setShowGdprWizard(false);
                                }}
                                onCancel={() => setShowGdprWizard(false)}
                            />
                        )}

                        {showModuleWizard && blueprint && (
                            <ModuleForgeWizard
                                saasId={blueprint.detectedKnowledge?.identity?.name ?
                                    (blueprint.detectedKnowledge.identity.name as string).toLowerCase().replace(/\s+/g, '-') :
                                    'draft'}
                                projectName={(blueprint.detectedKnowledge?.identity as Record<string, unknown>)?.name as string || 'New SaaS'}
                                onComplete={() => {
                                    setModuleStatus("COMPLETE");
                                    setShowModuleWizard(false);
                                }}
                                onCancel={() => setShowModuleWizard(false)}
                            />
                        )}

                        {showSalesWizard && blueprint && (
                            <SalesForgeWizard
                                saasId={blueprint.detectedKnowledge?.identity?.name ?
                                    (blueprint.detectedKnowledge.identity.name as string).toLowerCase().replace(/\s+/g, '-') :
                                    'draft'}
                                projectName={(blueprint.detectedKnowledge?.identity as Record<string, unknown>)?.name as string || 'New SaaS'}
                                vertical={(blueprint.detectedKnowledge?.identity as Record<string, unknown>)?.niche as string | undefined}
                                businessVision={blueprint.understanding}
                                onComplete={() => {
                                    setSalesStatus("COMPLETE");
                                    setShowSalesWizard(false);
                                }}
                                onCancel={() => setShowSalesWizard(false)}
                            />
                        )}

                        {/* Knowledge Insights */}
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[3rem] p-10">
                            <h3 className="font-black text-xl mb-6 uppercase tracking-widest text-white italic">Knowledge Base Insights</h3>
                            <div className="grid gap-6">
                                {blueprint?.detectedKnowledge?.digitalAudit?.insights?.map((insight: string, i: number) => (
                                    <div key={i} className="flex gap-6 p-6 rounded-[2rem] bg-slate-900/50 border border-white/5 hover:border-brand/40 transition-all cursor-default group">
                                        <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-sm shadow-xl group-hover:bg-brand transition-colors group-hover:text-slate-950">💡</div>
                                        <p className="text-sm text-slate-300 font-bold leading-relaxed">{insight}</p>
                                    </div>
                                ))}
                                {(!blueprint?.detectedKnowledge?.digitalAudit?.insights || blueprint.detectedKnowledge.digitalAudit.insights.length === 0) && (
                                    <div className="flex flex-col items-center justify-center py-12 space-y-4 opacity-50">
                                        <div className="w-12 h-12 rounded-full border-2 border-dashed border-white/20 animate-spin" />
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Analizando datos del onboarding...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </FoundryLayout>
    );
}

