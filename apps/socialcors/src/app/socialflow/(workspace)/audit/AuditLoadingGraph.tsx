"use client";

import { useEffect, useState } from "react";

const PURPLE = "#3b82f6";

const MESSAGES = [
  "Escaneando tu presencia en Instagram...",
  "Analizando a tus competidores...",
  "Calculando tu score de presencia...",
  "Generando recomendaciones personalizadas...",
  "Construyendo tu perfil de audiencia...",
] as const;

const MESSAGE_INTERVAL_MS = 2000;

// Hub central + 5 satélites en pentágono, con el aro conectando los satélites
// entre sí — se lee como una red real, no como una estrella. viewBox 0-200.
const CENTER = { x: 100, y: 100 };
const SATELLITES = [
  { x: 100, y: 30 },
  { x: 166.6, y: 78.4 },
  { x: 141.1, y: 156.6 },
  { x: 58.9, y: 156.6 },
  { x: 33.4, y: 78.4 },
];

// Reemplaza el spinner genérico de "Analizando tu presencia social con IA..."
// por un grafo SVG animado (nodos pulsando en morado + aristas "fluyendo") con
// mensajes rotativos que describen lo que la IA está haciendo de verdad.
export default function AuditLoadingGraph() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setMessageIndex((index) => (index + 1) % MESSAGES.length);
    }, MESSAGE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-6">
      <svg viewBox="0 0 200 200" className="h-40 w-40" fill="none" aria-hidden="true">
        {/* Aro — satélite a satélite */}
        {SATELLITES.map((node, i) => {
          const next = SATELLITES[(i + 1) % SATELLITES.length];
          return (
            <line
              key={`ring-${i}`}
              x1={node.x}
              y1={node.y}
              x2={next.x}
              y2={next.y}
              stroke={PURPLE}
              strokeOpacity={0.25}
              strokeWidth={1.5}
            />
          );
        })}
        {/* Radios — centro a cada satélite, con flujo animado */}
        {SATELLITES.map((node, i) => (
          <line
            key={`spoke-${i}`}
            x1={CENTER.x}
            y1={CENTER.y}
            x2={node.x}
            y2={node.y}
            stroke={PURPLE}
            strokeOpacity={0.4}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            className="sf-edge-flow"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
        {/* Nodo central */}
        <circle cx={CENTER.x} cy={CENTER.y} r={7} fill={PURPLE} className="sf-node-pulse" />
        {/* Nodos satélite */}
        {SATELLITES.map((node, i) => (
          <circle
            key={`node-${i}`}
            cx={node.x}
            cy={node.y}
            r={5}
            fill={PURPLE}
            className="sf-node-pulse"
            style={{ animationDelay: `${i * 0.3}s` }}
          />
        ))}
      </svg>
      <p key={messageIndex} className="sf-fade-in text-sm text-gray-500">
        {MESSAGES[messageIndex]}
      </p>
    </div>
  );
}
