import Link from "next/link";
import Card from "@/components/ui/card";
import { EliteInterview } from "@/components/onboarding/elite-interview";

export default function SiteLandingPage() {
  return (
    <div className="space-y-24 pb-20">
      {/* Hero Section */}
      <section className="text-center space-y-8 pt-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 border border-cyan-100 text-cyan-600 text-[10px] font-black uppercase tracking-[0.2em]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
          </span>
          SaaS Factory v2.0 Live
        </div>

        <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tight leading-none">
          Convierte tu idea en un <br />
          <span className="text-cyan-500">Proyecto Llave en Mano</span>
        </h1>

        <p className="max-w-2xl mx-auto text-lg text-slate-500 font-medium italic">
          "De la servilleta al mercado en 24 horas."
        </p>

        <p className="max-w-xl mx-auto text-base text-slate-400">
          Analizamos tus costos reales, auditamos tus redes sociales y
          construimos un ecosistema automatizado de ventas con IA.
        </p>
      </section>

      {/* Elite Interview Component (The Foundry) */}
      <section id="interview" className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-50/20 to-transparent -z-10" />
        <EliteInterview />
      </section>

      {/* Strategy / Features Grid */}
      <section className="grid gap-8 md:grid-cols-3">
        <Card
          tone="glass"
          title="Embudo de Ventas"
          subtitle="Social Audit"
          icon={<span className="text-xl">📊</span>}
        >
          <p className="text-sm text-slate-500 leading-relaxed">
            Analizamos tus perfiles de FB, IG y LinkedIn para detectar fallos en tu embudo
            y mejorar tu conversión automáticamente.
          </p>
        </Card>
        <Card
          tone="glass"
          title="Optimización ROI"
          subtitle="Real-Time Data"
          icon={<span className="text-xl">💰</span>}
        >
          <p className="text-sm text-slate-500 leading-relaxed">
            Calculamos cuánto dinero recuperas al sustituir procesos manuales por
            agentes autónomos de Drako. Resultados inmediatos.
          </p>
        </Card>
        <Card
          tone="glass"
          title="Despliegue Full-Stack"
          subtitle="Cloudflare + Stripe"
          icon={<span className="text-xl">⚡</span>}
        >
          <p className="text-sm text-slate-500 leading-relaxed">
            Al terminar tu entrevista, tendrás un presupuesto llave en mano y
            una vista previa de tu proyecto funcional al momento.
          </p>
        </Card>
      </section>

      {/* Trust Section */}
      <section className="bg-slate-900 rounded-[3rem] p-12 text-center text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 blur-[100px] rounded-full" />
        <h2 className="text-3xl font-black mb-6">El Estándar Drako</h2>
        <p className="max-w-2xl mx-auto text-slate-400 mb-8 font-medium">
          Drako no es una plataforma genérica. Es una consultoría de élite digitalizada
          que entrega proyectos listos para facturar con marca y dominio propios.
        </p>
        <div className="flex justify-center gap-4 flex-wrap">
          <span className="inline-flex px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-cyan-300 text-[10px] font-bold uppercase tracking-widest">Fintech Ready</span>
          <span className="inline-flex px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-cyan-300 text-[10px] font-bold uppercase tracking-widest">AI Orchestrated</span>
          <span className="inline-flex px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-cyan-300 text-[10px] font-bold uppercase tracking-widest">Edge Optimized</span>
        </div>
      </section>
    </div>
  );
}
