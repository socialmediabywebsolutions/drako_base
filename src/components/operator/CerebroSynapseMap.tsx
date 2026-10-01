"use client";

import { useState } from "react";
import Card from "@/components/ui/card";

// Mapa de sinapsis del Cerebro Socialcors: el Orquestador en el centro y los agentes
// principales en anillo. Estados y pings mock hasta conectar con el centro de control.

type NodeStatus = "active" | "error";

type SynapseNode = {
  id: string;
  name: string;
  emoji: string;
  status: NodeStatus;
  lastPing: string;
};

const RING_NODES: SynapseNode[] = [
  { id: "recolector", name: "Recolector Web", emoji: "🕸️", status: "active", lastPing: "hace 2 min" },
  { id: "analisis", name: "Análisis IA", emoji: "🧠", status: "active", lastPing: "hace 2 min" },
  { id: "generador", name: "Generador Contenido", emoji: "✍️", status: "active", lastPing: "hace 2 min" },
  { id: "publicador", name: "Publicador", emoji: "🚀", status: "active", lastPing: "hace 2 min" },
  { id: "monitor", name: "Monitor", emoji: "📡", status: "error", lastPing: "hace 2 min" },
  { id: "crm", name: "CRM Agent", emoji: "💬", status: "active", lastPing: "hace 2 min" },
  { id: "scheduler", name: "Scheduler", emoji: "⏱️", status: "active", lastPing: "hace 2 min" },
];

// Pipeline de contenido: cada tramo lleva un punto de luz viajando.
const FLOW: [string, string][] = [
  ["recolector", "analisis"],
  ["analisis", "generador"],
  ["generador", "publicador"],
];

const WIDTH = 640;
const HEIGHT = 480;
const CX = WIDTH / 2;
const CY = HEIGHT / 2;
const RING_RADIUS = 175;
const NODE_RADIUS = 30;
const CENTER_RADIUS = 44;

const STATUS_COLOR: Record<NodeStatus, string> = { active: "#22c55e", error: "#ef4444" };

const positions = new Map(
  RING_NODES.map((node, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / RING_NODES.length;
    return [node.id, { x: CX + RING_RADIUS * Math.cos(angle), y: CY + RING_RADIUS * Math.sin(angle) }];
  }),
);

// Segmento entre dos nodos recortado al borde de cada círculo, para que la flecha no
// quede tapada.
function edgePath(fromId: string, toId: string): string {
  const a = positions.get(fromId)!;
  const b = positions.get(toId)!;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const pad = NODE_RADIUS + 6;
  return `M ${a.x + ux * pad} ${a.y + uy * pad} L ${b.x - ux * pad} ${b.y - uy * pad}`;
}

export default function CerebroSynapseMap() {
  const [hovered, setHovered] = useState<string | null>(null);
  const hoveredNode = RING_NODES.find((n) => n.id === hovered) ?? null;
  const hoveredPos = hovered ? positions.get(hovered) : null;
  const activeCount = RING_NODES.filter((n) => n.status === "active").length;

  return (
    <Card
      tone="default"
      title="Mapa de Sinapsis — Cerebro IA"
      subtitle={`Orquestador y agentes principales · ${activeCount} de ${RING_NODES.length} activos`}
    >
      <div className="overflow-hidden rounded-2xl bg-[#0f172a] p-4">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="mx-auto h-auto w-full max-w-3xl" role="img" aria-label="Mapa de sinapsis del Cerebro IA">
          <defs>
            <marker id="synapse-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#06b6d4" />
            </marker>
            <radialGradient id="synapse-core" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#1e3a8a" />
            </radialGradient>
            <filter id="synapse-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Conexiones orquestador ↔ agentes */}
          {RING_NODES.map((node) => {
            const p = positions.get(node.id)!;
            return (
              <line
                key={`spoke-${node.id}`}
                x1={CX}
                y1={CY}
                x2={p.x}
                y2={p.y}
                stroke={node.status === "error" ? "#7f1d1d" : "#1e40af"}
                strokeWidth={1.5}
                strokeDasharray="4 6"
                opacity={0.7}
              />
            );
          })}

          {/* Pipeline con punto de luz viajando */}
          {FLOW.map(([from, to], i) => {
            const d = edgePath(from, to);
            return (
              <g key={`flow-${from}-${to}`}>
                <path d={d} stroke="#06b6d4" strokeWidth={2.5} fill="none" markerEnd="url(#synapse-arrow)" opacity={0.85} />
                <circle r={4.5} fill="#e0f2fe" filter="url(#synapse-glow)">
                  <animateMotion dur="1.8s" repeatCount="indefinite" begin={`${i * 0.6}s`} path={d} />
                </circle>
              </g>
            );
          })}

          {/* Orquestador */}
          <g>
            <circle cx={CX} cy={CY} r={CENTER_RADIUS + 10} fill="#3b82f6" opacity={0.15}>
              <animate attributeName="r" values={`${CENTER_RADIUS + 4};${CENTER_RADIUS + 14};${CENTER_RADIUS + 4}`} dur="3s" repeatCount="indefinite" />
            </circle>
            <circle cx={CX} cy={CY} r={CENTER_RADIUS} fill="url(#synapse-core)" stroke="#60a5fa" strokeWidth={2} />
            <text x={CX} y={CY - 4} textAnchor="middle" fontSize="22">🎛️</text>
            <text x={CX} y={CY + 20} textAnchor="middle" fontSize="11" fontWeight={700} fill="#e2e8f0">Orquestador</text>
          </g>

          {/* Agentes */}
          {RING_NODES.map((node) => {
            const p = positions.get(node.id)!;
            const isHovered = hovered === node.id;
            return (
              <g
                key={node.id}
                onMouseEnter={() => setHovered(node.id)}
                onMouseLeave={() => setHovered((prev) => (prev === node.id ? null : prev))}
                onFocus={() => setHovered(node.id)}
                onBlur={() => setHovered(null)}
                tabIndex={0}
                className="cursor-pointer outline-none"
                aria-label={`${node.name}: ${node.status === "active" ? "activo" : "error"}`}
              >
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={NODE_RADIUS}
                  fill="#1e293b"
                  stroke={node.status === "error" ? "#ef4444" : isHovered ? "#06b6d4" : "#3b82f6"}
                  strokeWidth={isHovered ? 3 : 2}
                />
                <text x={p.x} y={p.y + 7} textAnchor="middle" fontSize="20">{node.emoji}</text>
                <circle cx={p.x + NODE_RADIUS * 0.72} cy={p.y - NODE_RADIUS * 0.72} r={6} fill={STATUS_COLOR[node.status]} stroke="#0f172a" strokeWidth={2}>
                  {node.status === "error" ? (
                    <animate attributeName="opacity" values="1;0.35;1" dur="1.2s" repeatCount="indefinite" />
                  ) : null}
                </circle>
                <text x={p.x} y={p.y + NODE_RADIUS + 16} textAnchor="middle" fontSize="11" fontWeight={600} fill="#cbd5e1">
                  {node.name}
                </text>
              </g>
            );
          })}

          {/* Tooltip */}
          {hoveredNode && hoveredPos ? (
            <g pointerEvents="none">
              <rect
                x={Math.min(Math.max(hoveredPos.x - 80, 8), WIDTH - 168)}
                y={hoveredPos.y - NODE_RADIUS - 52}
                width={160}
                height={42}
                rx={8}
                fill="#f8fafc"
                opacity={0.97}
              />
              <text
                x={Math.min(Math.max(hoveredPos.x, 88), WIDTH - 88)}
                y={hoveredPos.y - NODE_RADIUS - 34}
                textAnchor="middle"
                fontSize="11"
                fontWeight={700}
                fill="#0f172a"
              >
                {hoveredNode.status === "active" ? "🟢" : "🔴"} {hoveredNode.name}
              </text>
              <text
                x={Math.min(Math.max(hoveredPos.x, 88), WIDTH - 88)}
                y={hoveredPos.y - NODE_RADIUS - 18}
                textAnchor="middle"
                fontSize="10"
                fill="#475569"
              >
                Último ping: {hoveredNode.lastPing}
              </text>
            </g>
          ) : null}
        </svg>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#22c55e]" /> Activo</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#ef4444]" /> Error</span>
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-[#06b6d4]" /> Pipeline de contenido</span>
        </div>
      </div>
    </Card>
  );
}
