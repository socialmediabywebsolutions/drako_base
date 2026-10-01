// Fondos decorativos de "red neuronal" de la home de drako.systems. SVG estático +
// animaciones CSS de globals.css (drako-drift-*, drako-node); sin JS ni librerías.
// Ambos son aria-hidden y pointer-events-none: nunca tapan ni capturan el contenido.

type Point = [number, number];
type Cluster = { className: string; nodes: Point[]; edges: [number, number][] };

// 12 nodos en 3 clusters de 4; cada cluster deriva con su propio keyframe, así las
// líneas internas siguen unidas a sus nodos mientras se mueven.
const HERO_CLUSTERS: Cluster[] = [
  { className: "drako-drift-a", nodes: [[140, 150], [300, 90], [260, 250], [430, 190]], edges: [[0, 1], [0, 2], [1, 3], [2, 3], [1, 2]] },
  { className: "drako-drift-b", nodes: [[770, 110], [910, 210], [1060, 120], [990, 310]], edges: [[0, 1], [1, 2], [1, 3], [2, 3]] },
  { className: "drako-drift-c", nodes: [[520, 390], [690, 340], [610, 510], [830, 460]], edges: [[0, 1], [0, 2], [1, 3], [2, 3], [1, 2]] },
];

export function HeroNetwork() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1200 600"
      preserveAspectRatio="xMidYMid slice"
    >
      {HERO_CLUSTERS.map((cluster, ci) => (
        <g key={ci} className={cluster.className}>
          {cluster.edges.map(([a, b]) => (
            <line
              key={`${a}-${b}`}
              x1={cluster.nodes[a][0]}
              y1={cluster.nodes[a][1]}
              x2={cluster.nodes[b][0]}
              y2={cluster.nodes[b][1]}
              stroke="#3b82f6"
              strokeOpacity={0.15}
              strokeWidth={1}
            />
          ))}
          {cluster.nodes.map(([x, y], ni) => (
            <circle
              key={ni}
              cx={x}
              cy={y}
              r={3.5}
              fill="#3b82f6"
              className="drako-node"
              style={{ animationDelay: `${(ci * 4 + ni) * 0.35}s` }}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}

// Detrás del grid de SaaS: un nodo por columna (lg:grid-cols-4) y todas las parejas
// enlazadas con arcos. viewBox 0-100 estirado al contenedor; el trazo no escala.
const ECOSYSTEM_NODES: Point[] = [[12.5, 50], [37.5, 50], [62.5, 50], [87.5, 50]];

export function EcosystemNetwork() {
  const arcs: string[] = [];
  ECOSYSTEM_NODES.forEach(([x1, y1], i) => {
    ECOSYSTEM_NODES.slice(i + 1).forEach(([x2, y2], j) => {
      const span = x2 - x1;
      const lift = (i + j) % 2 === 0 ? -span * 0.9 : span * 0.9;
      arcs.push(`M ${x1} ${y1} Q ${(x1 + x2) / 2} ${y1 + lift} ${x2} ${y2}`);
    });
  });

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <g stroke="#3b82f6" strokeOpacity={0.08} fill="none" strokeWidth={1.5}>
        {arcs.map((d) => (
          <path key={d} d={d} vectorEffect="non-scaling-stroke" />
        ))}
        <line x1={0} y1={50} x2={100} y2={50} vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  );
}
