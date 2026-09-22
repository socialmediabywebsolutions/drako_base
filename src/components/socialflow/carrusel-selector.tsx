"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import PublishCarrusel from "./publish-carrusel";
import AiCarouselCreator from "./AiCarouselCreator";

// Selector de modo para /socialflow/carrusel — mismo patrón que PublicarSelector
// (src/components/socialflow/publicar-selector.tsx): tarjetas → vuelve al elegir.
type CarruselMode = "subir" | "ia";

const MODE_CARDS: { id: CarruselMode; icon: string; title: string; description: string }[] = [
  { id: "subir", icon: "📸", title: "Subir imágenes", description: "Sube tus fotos y la IA genera el texto de cada slide." },
  { id: "ia", icon: "✨", title: "Crear con IA", description: "La IA genera texto e imagen — sin necesidad de subir fotos." },
];

export default function CarruselSelector({ saasId, maxSlides }: { saasId: string; maxSlides: number }) {
  // ?topic=... llega desde el handoff del chat "¿Qué creo hoy?" (ver ai/chat/route.ts
  // acción "handoff_carousel") — cuando viene, salta directo al modo IA con el tema
  // precargado en vez de mostrar el selector.
  const searchParams = useSearchParams();
  const topicFromChat = searchParams.get("topic");
  const [selected, setSelected] = useState<CarruselMode | null>(topicFromChat ? "ia" : null);

  if (selected === "subir") {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-500 transition hover:text-gray-900"
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
          className="flex items-center gap-1.5 text-sm font-medium text-gray-500 transition hover:text-gray-900"
        >
          <span aria-hidden>←</span> Volver
        </button>
        <AiCarouselCreator saasId={saasId} maxSlides={maxSlides} initialTopic={topicFromChat ?? undefined} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-blue-600">
          Socialcors · Carrusel
        </div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-900">
          ¿Cómo quieres crear tu carrusel?
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
          Elige el modo y Socialcors hace el resto.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {MODE_CARDS.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => setSelected(card.id)}
            className="group flex flex-col items-start gap-3 rounded-2xl border border-gray-200 bg-white p-6 text-left shadow-sm transition-all hover:border-blue-400 hover:bg-blue-50"
          >
            <span className="text-4xl">{card.icon}</span>
            <span className="flex items-center gap-2 text-lg font-black text-gray-900">
              {card.title}
            </span>
            <span className="text-sm text-gray-500">{card.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
