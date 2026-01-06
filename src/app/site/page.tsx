import Link from "next/link";
import Card from "@/components/ui/card";

export default function SiteLandingPage() {
  return (
    <div className="space-y-12 text-white">
      <section className="grid gap-10 text-center md:grid-cols-2 md:text-left">
        <div className="space-y-6">
          <p className="text-xs uppercase tracking-[0.4em] text-cyan-200">DRĀKO SYSTEMS</p>
          <h1 className="text-4xl font-semibold leading-tight md:text-5xl">Crea tu propio SaaS en minutos</h1>
          <p className="text-base text-slate-200">
            Conecta tus ideas al Campamento Base de DRĀKO y lanza tu producto con facturación, soporte y orquestación incluidos.
          </p>
          <div className="flex flex-col gap-3 md:flex-row">
            <Link
              href="/site/onboarding/company"
              className="inline-flex items-center justify-center rounded-2xl bg-[var(--brand,#4cc9f0)] px-6 py-3 text-base font-semibold text-black shadow-[0_12px_30px_rgba(76,201,240,0.35)] transition hover:-translate-y-0.5"
            >
              Comenzar
            </Link>
            <Link
              href="/site/support"
              className="inline-flex items-center justify-center rounded-2xl border border-white/30 px-6 py-3 text-base font-semibold text-white transition hover:border-white/60"
            >
              Habla con soporte
            </Link>
          </div>
        </div>
        <div className="rounded-3xl border border-white/15 bg-white/5 p-8 text-left shadow-[0_25px_80px_rgba(3,5,11,0.6)]">
          <p className="text-sm uppercase tracking-[0.6em] text-slate-300">Resumen</p>
          <h2 className="mt-3 text-2xl font-semibold">Base operativa completa</h2>
          <ul className="mt-6 space-y-4 text-sm text-slate-200">
            <li>• Owner / Cliente listo para facturar</li>
            <li>• SaaS aprovisionado con agentes y monitoreo</li>
            <li>• Panel &quot;Mi SaaS&quot; conectado a DRĀKO BASE</li>
            <li>• Tickets y soporte centralizado</li>
          </ul>
        </div>
      </section>
      <section className="grid gap-6 md:grid-cols-3">
        {["Onboarding guiado", "Panel unificado", "Soporte central"].map((title, index) => (
          <Card
            key={title}
            tone="glass"
            title={title}
            subtitle={
              index === 0
                ? "Setup express"
                : index === 1
                  ? "Control continuo"
                  : "Atención dedicada"
            }
          >
            <p className="text-sm text-slate-200">
              {index === 0 && "Completa los datos de tu empresa y SaaS en tres pasos."}
              {index === 1 && "Revisa el estado del SaaS y accede al Admin en un clic."}
              {index === 2 && "Gestiona tickets vinculados a tu cliente directamente desde DRĀKO."}
            </p>
          </Card>
        ))}
      </section>
    </div>
  );
}
