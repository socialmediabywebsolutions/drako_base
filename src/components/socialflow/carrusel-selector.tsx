"use client";

import { useState } from "react";
import PublishCarrusel from "./publish-carrusel";

// Selector de modo para /socialflow/carrusel — mismo patrón que PublicarSelector
// (src/components/socialflow/publicar-selector.tsx): tarjetas → vuelve al elegir.
type CarruselMode = "subir" | "ia";

const MODE_CARDS: { id: CarruselMode; icon: string; title: string; description: string; comingSoon?: boolean }[] = [
  { id: "subir", icon: "📸", title: "Subir imágenes", description: "Sube tus fotos y la IA genera el texto de cada slide." },
  { id: "ia", icon: "✨", title: "Crear con IA", description: "La IA genera texto e imagen — sin necesidad de subir fotos.", comingSoon: true },
];

export default function CarruselSelector({ saasId, maxSlides }: { saasId: string; maxSlides: number }) {
  const [selected, setSelected] = useState<CarruselMode | null>(null);

  if (selected === "subir") {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="flex items-center gap-1.5 text-sm font-medium text-white/50 transition hover:text-white"
        >
          <span aria-hidden>←</span> Volver
        </button>
        <PublishCarrusel saasId={saasId} maxSlides={maxSlides} />
      </div>
    );
  }

  if (selected === "ia") {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="flex items-center gap-1.5 text-sm font-medium text-white/50 transition hover:text-white"
        >
          <span aria-hidden>←</span> Volver
        </button>
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-white/15 bg-white/3 px-6 py-20 text-center">
          <span className="text-4xl">✨</span>
          <p className="text-lg font-black text-white">Próximamente</p>
          <p className="max-w-sm text-sm text-white/50">
            La generación de carruseles 100% con IA (sin subir fotos) está en desarrollo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-400">
          Socialcors · Carrusel
        </div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
          ¿Cómo quieres crear tu carrusel?
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
          Elige el modo y Socialcors hace el resto.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {MODE_CARDS.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => setSelected(card.id)}
            className="group flex flex-col items-start gap-3 rounded-2xl border border-white/10 bg-white/3 p-6 text-left transition-all hover:border-violet-500/40 hover:bg-violet-500/5 hover:shadow-[0_0_30px_-8px_rgba(168,85,247,0.55)]"
          >
            <span className="text-4xl">{card.icon}</span>
            <span className="flex items-center gap-2 text-lg font-black text-white">
              {card.title}
              {card.comingSoon && (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/40">
                  Próximamente
                </span>
              )}
            </span>
            <span className="text-sm text-white/50">{card.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
