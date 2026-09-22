"use client";

import { useState } from "react";
import UploadToPost from "./upload-to-post";
import PublishReel from "./publish-reel";

// Reemplaza las 4 rutas separadas que existían bajo /publicar/ (index, post, reel,
// historia) por un único selector: 3 de los 4 formatos ya montaban el mismo
// UploadToPost con distinto contentType, y Reel montaba PublishReel — ahora todo vive
// en esta página con un selector de tarjetas en vez de 4 Server Components casi
// idénticos. Carrusel se movió a su propia sección /socialflow/carrusel.
type PublishFormat = "post" | "reel" | "historia";

const FORMAT_CARDS: { id: PublishFormat; icon: string; title: string; description: string }[] = [
  { id: "post", icon: "📸", title: "Post", description: "Varias fotos según tu plan y el mes · Caption e hashtags generados por IA" },
  { id: "reel", icon: "🎬", title: "Reel", description: "Varias fotos según tu plan y el mes · Video animado con música automática · 15-30s" },
  { id: "historia", icon: "⭕", title: "Historia", description: "Varias fotos según tu plan y el mes · Visible 24h en Instagram · Caption optimizado" },
];

export default function PublicarSelector({
  saasId,
  maxImages,
}: {
  saasId: string;
  maxImages: number;
}) {
  const [selected, setSelected] = useState<PublishFormat | null>(null);

  if (selected) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-500 transition hover:text-gray-900"
        >
          <span aria-hidden>←</span> Volver
        </button>

        {selected === "post" && <UploadToPost saasId={saasId} maxImages={maxImages} contentType="FEED" />}
        {selected === "reel" && <PublishReel saasId={saasId} maxImages={maxImages} />}
        {selected === "historia" && <UploadToPost saasId={saasId} maxImages={maxImages} contentType="STORY" />}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-blue-600">
          Socialcors · Crear contenido
        </div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-900">
          ¿Qué quieres crear hoy?
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
          Elige el formato y sube tu contenido. Socialcors hace el resto.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FORMAT_CARDS.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => setSelected(card.id)}
            className="group flex flex-col items-start gap-3 rounded-2xl border border-gray-200 bg-white p-6 text-left transition-all hover:border-blue-400 hover:bg-blue-50 hover:shadow-[0_0_30px_-8px_rgba(59,130,246,0.35)]"
          >
            <span className="text-4xl">{card.icon}</span>
            <span className="text-lg font-black text-gray-900">{card.title}</span>
            <span className="text-sm text-gray-500">{card.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
