"use client";

import { useState } from "react";
import { Download, ShieldCheck, AlertTriangle } from "lucide-react";

export default function SocialFlowOwnershipPage() {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const link = document.createElement("a");
      link.href = "/api/socialflow/exports/current";
      link.download = "socialflow-export.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error(error);
      alert("Error al iniciar la descarga.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="animate-in fade-in space-y-8 duration-500">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-400">Propiedad &amp; Activos</div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Propiedad &amp; Activos</h1>
        <p className="mt-2 text-sm text-white/50">Gestiona la propiedad legal, exportaciones y derechos de propiedad intelectual.</p>
      </div>

      {/* Exportación */}
      <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/4 p-6">
        <div className="pointer-events-none absolute right-0 top-0 p-4 opacity-[0.04]">
          <Download className="h-24 w-24 text-white" />
        </div>

        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          Mis activos
        </h2>

        <div className="mb-6 space-y-3 text-sm leading-6 text-white/50">
          <p>
            Drako Infrastructure garantiza que tú eres dueño de tus datos y arquitectura.
            Puedes descargar un paquete de cumplimiento completo en cualquier momento. Este paquete incluye:
          </p>
          <ul className="mt-2 space-y-1.5 pl-4">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-violet-400">•</span>
              <span><strong className="text-white/80">Dossier estratégico:</strong> El ADN de tu negocio y su análisis.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-violet-400">•</span>
              <span><strong className="text-white/80">Blueprint de ingeniería:</strong> El mapa arquitectónico de tu software.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-violet-400">•</span>
              <span><strong className="text-white/80">Logs de ejecución:</strong> Prueba de trabajo de todos los agentes IA.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-violet-400">•</span>
              <span><strong className="text-white/80">Financiero:</strong> Eventos económicos y desglose de costes.</span>
            </li>
          </ul>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/4 p-4">
          <div>
            <div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/35">Exportación completa</div>
            <div className="text-sm font-medium text-white/80">Paquete de salida estándar (.zip)</div>
          </div>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-bold text-white shadow-md shadow-violet-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {downloading ? (
              <>
                <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                Comprimiendo...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Descargar copia de seguridad
              </>
            )}
          </button>
        </div>
      </section>

      {/* Transferencia de propiedad */}
      <section className="rounded-2xl border border-white/10 bg-white/4 p-6 opacity-75">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          Transferir propiedad
        </h2>
        <p className="mb-4 text-sm text-white/45">
          Transferir la propiedad de esta infraestructura SaaS requiere validación legal y un nuevo contrato de facturación.
          Este proceso es irreversible.
        </p>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 p-4 text-xs text-amber-300">
          <strong>Aviso:</strong> La transferencia automática de propiedad está desactivada por razones de seguridad.
          Contacta con Soporte Enterprise para iniciar una transferencia de titularidad.
        </div>
      </section>
    </div>
  );
}
