"use client";

import { useEffect, useState } from "react";

const PURPLE = "#6c47ff";

const STEPS = [
  "🔍 Analizando tu web...",
  "📊 Generando auditoría de presencia social...",
  "🧠 El Cerebro está procesando tu información...",
  "✅ Todo listo. Preparando tu checklist...",
] as const;

const STEP_INTERVAL_MS = 1500;

// Reemplaza el spinner genérico de "Cargando checklist..." — mensajes que van
// apareciendo uno a uno cada 1.5s con fade-in. Los anteriores se quedan visibles
// (atenuados) para que se lea como progreso real, no como un mensaje que parpadea.
// Se queda en el último paso si la carga real tarda más de los 4×1.5s.
export default function ChecklistLoadingSequence() {
  const [visibleCount, setVisibleCount] = useState(1);

  useEffect(() => {
    if (visibleCount >= STEPS.length) return;
    const timer = setTimeout(() => {
      setVisibleCount((count) => Math.min(count + 1, STEPS.length));
    }, STEP_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [visibleCount]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/4 p-6">
      <div className="space-y-3">
        {STEPS.slice(0, visibleCount).map((text, index) => {
          const isActive = index === visibleCount - 1;
          return (
            <div key={text} className="sf-fade-in flex items-center gap-3">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{
                  background: PURPLE,
                  opacity: isActive ? 1 : 0.4,
                  boxShadow: isActive ? `0 0 8px ${PURPLE}` : "none",
                }}
              />
              <p className={`text-sm ${isActive ? "text-white/85" : "text-white/35"}`}>{text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
