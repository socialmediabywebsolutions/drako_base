// Redes conectadas al núcleo: dos mini interfaces (Instagram y LinkedIn) unidas al logo real.
//
// SIN cifras: los paneles muestran la estructura (qué se medirá) con "—" y, debajo, el mensaje de que
// las métricas reales llegarán más adelante. No hay ningún dato inventado. Instagram es la red activa
// verificada en producción (ida y vuelta de actividad); LinkedIn está "Próximamente": cable punteado,
// sin pulsos y panel atenuado (ver SOON_NETWORKS en landing-config.ts).
import { Instagram, Linkedin, type LucideIcon } from "lucide-react";
import LiveZone from "./live-zone";
import Reveal from "./reveal";
import { CoreDisc, SysHead, Wires, vars, type WirePath } from "./flow";
import {
  AVAILABLE_NETWORKS,
  EXAMPLE_LABEL,
  EXAMPLE_PANELS,
  METRICS_SOON_MESSAGE,
  SOON_LABEL,
  SOON_NETWORKS,
} from "./landing-config";

type PanelDef = {
  key: (typeof AVAILABLE_NETWORKS)[number]["key"];
  Mark: LucideIcon;
  bg: string;
  side: "left" | "right";
  labels: string[];
};
const PANELS: PanelDef[] = [
  {
    key: "instagram",
    Mark: Instagram,
    bg: "linear-gradient(135deg,#F58529,#DD2A7B 60%,#8134AF)",
    side: "left",
    labels: ["Seguidores", "Visualizaciones", "Me gusta", "Comentarios"],
  },
  {
    key: "linkedin",
    Mark: Linkedin,
    bg: "#0A66C2",
    side: "right",
    labels: ["Seguidores", "Impresiones", "Reacciones", "Comentarios"],
  },
];

const W = 1000;
const H = 330;
const CY = 165;
const CORE_R = 72;
const LANE = 16;
const PANEL_EDGE = { left: 315, right: 685 } as const;
const PANEL_X = { left: 165, right: 835 } as const;

const wires: WirePath[] = PANELS.flatMap((p, i) => {
  const dir = p.side === "left" ? -1 : 1;
  const coreEdge = 500 + dir * (CORE_R - 2);
  const panelEdge = PANEL_EDGE[p.side];
  const soon = SOON_NETWORKS.includes(p.key);
  return [
    { d: `M${coreEdge} ${CY - LANE} L${panelEdge} ${CY - LANE}`, fd: soon ? undefined : 0.6 + i * 0.6, soon, draw: 0.2 + i * 0.1 },
    { d: `M${panelEdge} ${CY + LANE} L${coreEdge} ${CY + LANE}`, fd: soon ? undefined : 6.4 + i * 0.6, kind: "act" as const, soon, draw: 0.35 + i * 0.1 },
  ];
});

function Panel({ def }: { def: PanelDef }) {
  const net = AVAILABLE_NETWORKS.find((n) => n.key === def.key)!;
  const data = EXAMPLE_PANELS[def.key];
  const soon = SOON_NETWORKS.includes(def.key);
  const { Mark } = def;
  return (
    <div className="sy-np" data-soon={soon ? "true" : undefined}>
      <div className="sy-np-head">
        <span className="sy-np-brand" style={{ background: def.bg }}><Mark strokeWidth={2.2} aria-hidden="true" /></span>
        <div className="min-w-0">
          <p className="sy-np-name">{net.name}</p>
          <p className="sy-np-handle">{data.handle}</p>
        </div>
        <span className="sy-np-tag">{soon ? SOON_LABEL : EXAMPLE_LABEL}</span>
      </div>
      <p className="sy-np-detail">{net.detail}</p>
      <dl className="sy-np-stats">
        {def.labels.map((label) => (
          <div key={label}>
            <dd>—</dd>
            <dt>{label}</dt>
          </div>
        ))}
      </dl>
      <div className="sy-np-evo">
        <span className="sy-np-evo-l">Evolución</span>
        <span className="sy-np-flat" aria-hidden="true" />
      </div>
    </div>
  );
}

export function Networks() {
  return (
    <section id="redes" aria-labelledby="networks-title" className="px-4 py-12 sm:px-6 md:py-16">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <SysHead eyebrow="Redes" titleId="networks-title" title="Publica en las redes que ya usas.">
            Instagram, activo hoy. LinkedIn, próximamente.
          </SysHead>
        </Reveal>

        <LiveZone className="sy-net mt-12">
          {/* Escritorio: panel — núcleo — panel */}
          <Reveal className="sy-net-canvas">
            <Wires w={W} h={H} paths={wires} tone="light" />
            <CoreDisc className="sy-core--net" style={vars({ "--ha": "3s" })} />
            {PANELS.map((p) => (
              <div
                key={p.key}
                className="sy-net-slot"
                style={{ left: `${(PANEL_X[p.side] / W) * 100}%`, top: `${(CY / H) * 100}%` }}
              >
                <Panel def={p} />
              </div>
            ))}
          </Reveal>

          {/* Móvil / tablet: núcleo arriba y los paneles conectados por carriles verticales */}
          <Reveal className="sy-net-stack">
            <CoreDisc className="sy-core--stack" />
            {PANELS.map((p) => (
              <div key={p.key} className="sy-net-item">
                <span className="sy-vpair" aria-hidden="true"><i data-soon={SOON_NETWORKS.includes(p.key) ? "true" : undefined} /><i data-act="true" data-soon={SOON_NETWORKS.includes(p.key) ? "true" : undefined} /></span>
                <Panel def={p} />
              </div>
            ))}
          </Reveal>
        </LiveZone>

        {/* Indicador discreto + mensaje: aún no hay métricas reales publicables */}
        <div className="sy-net-soon">
          <span className="sy-net-soon-pill"><i aria-hidden="true" />Métricas en preparación</span>
          <p>{METRICS_SOON_MESSAGE}</p>
        </div>
      </div>
    </section>
  );
}
