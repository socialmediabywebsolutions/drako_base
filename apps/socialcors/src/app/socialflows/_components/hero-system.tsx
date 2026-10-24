// Hero: el sistema visible. El logo REAL es el núcleo; de él salen los cables hacia los cinco
// pasos (Foto / vídeo → Análisis IA → Contenido → Redes → Métricas) y un recorrido inferior los
// une de izquierda a derecha con un pulso de luz.
//
// Es una demostración VISUAL (aria-hidden), no una interfaz funcional. El caption/hashtags/hora
// son un ejemplo ilustrativo (SAMPLE); no hay cifras. Escritorio (≥1024 px): composición radial.
// Debajo: el mismo recorrido en vertical.
import { Camera, ChartColumn, FileText, Heart, Instagram, Linkedin, MessageCircle, Eye, ScanSearch, Share2, type LucideIcon } from "lucide-react";
import LiveZone from "./live-zone";
import { CoreDisc, Sparkline, Wires, curve, vars, type WirePath } from "./flow";
import { SOON_LABEL } from "./landing-config";
import { HashtagChips, IcoCheck, PhotoTile, SAMPLE } from "./product-ui";

const W = 1000;
const H = 520; // = aspect-ratio del canvas en landing.css (.sy-hero-canvas)
const TRAVEL = 2.24;

type Station = { id: string; n: number; label: string; icon: LucideIcon; x: number };
const STATIONS: Station[] = [
  { id: "foto", n: 1, label: "Foto / vídeo", icon: Camera, x: 100 },
  { id: "analisis", n: 2, label: "Análisis IA", icon: ScanSearch, x: 300 },
  { id: "contenido", n: 3, label: "Contenido", icon: FileText, x: 500 },
  { id: "redes", n: 4, label: "Redes", icon: Share2, x: 700 },
  { id: "metricas", n: 5, label: "Métricas", icon: ChartColumn, x: 900 },
];

const CORE = { x: 500, y: 78, r: 66 };
const PORT_Y = 205; // borde superior de las estaciones
const STEM_Y = 445; // borde inferior de las estaciones (alto fijo: 24cqw)
const TRACK_Y = 487;

// Retrasos (s) de los pulsos: primero el abanico del núcleo, después el recorrido.
const FAN_FD = [0.2, 0.6, 1.0, 1.4, 1.8];
const TRACK_FD = [2.6, 3.6, 4.6, 5.6];

const fan: WirePath[] = STATIONS.map((s, i) => ({
  d: curve({ x: CORE.x + (s.x - CORE.x) * 0.12, y: CORE.y + CORE.r }, { x: s.x, y: PORT_Y }),
  fd: FAN_FD[i],
  draw: 0.1 + i * 0.12,
}));
const stems: WirePath[] = STATIONS.map((s, i) => ({ d: `M${s.x} ${STEM_Y} L${s.x} ${TRACK_Y}`, draw: 0.6 + i * 0.1 }));
const track: WirePath[] = STATIONS.slice(0, -1).map((s, i) => ({
  d: `M${s.x} ${TRACK_Y} L${STATIONS[i + 1].x} ${TRACK_Y}`,
  fd: TRACK_FD[i],
  draw: 0.9 + i * 0.15,
}));
const PATHS = [...fan, ...stems, ...track];

function InsideStation({ id }: { id: string }) {
  switch (id) {
    case "foto":
      return (
        <>
          <PhotoTile className="h-[6.4rem]" />
          <div>
            <div className="mb-1 flex items-center justify-between text-[0.625rem]" style={{ color: "var(--sc-app-muted)" }}>
              <span>Foto subida</span>
              <span>100%</span>
            </div>
            <div className="sc-bar-track"><div className="sc-bar-fill" /></div>
          </div>
          <p className="sy-stn-note">Tú aportas el contenido</p>
        </>
      );
    case "analisis":
      return (
        <>
          <ul className="flex flex-col gap-2 pt-0.5">
            {["Personas", "Lugar", "Producto"].map((t) => (
              <li key={t} className="flex items-center gap-2 text-[0.6875rem]" style={{ color: "var(--sc-app-text)" }}>
                <span className="flex h-4 w-4 items-center justify-center rounded-full text-white" style={{ background: "var(--sc-accent-soft)" }}>
                  <IcoCheck />
                </span>
                {t}
              </li>
            ))}
          </ul>
          <p className="sy-stn-note">Lo cruza con tu perfil y tu Base de conocimiento</p>
        </>
      );
    case "contenido":
      return (
        <>
          <p className="text-[0.6875rem] leading-relaxed" style={{ color: "var(--sc-app-text)" }}>{SAMPLE.caption}</p>
          <HashtagChips />
          <div className="flex gap-1.5">
            <span className="sc-app-chip" data-on="true">Post</span>
            <span className="sc-app-chip">Reel</span>
            <span className="sc-app-chip">Historia</span>
          </div>
        </>
      );
    case "redes":
      return (
        <>
          <ul className="flex flex-col gap-2">
            {[
              { name: "Instagram", Mark: Instagram, bg: "linear-gradient(135deg,#F58529,#DD2A7B 60%,#8134AF)", soon: false },
              { name: "LinkedIn", Mark: Linkedin, bg: "#0A66C2", soon: true },
            ].map(({ name, Mark, bg, soon }) => (
              <li key={name} className="flex items-center gap-2 text-[0.75rem] font-bold" style={{ color: "#fff", opacity: soon ? 0.7 : 1 }}>
                <span className="flex h-6 w-6 items-center justify-center rounded-md text-white" style={{ background: bg }}>
                  <Mark className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
                </span>
                {name}
                {soon && <span className="sy-soon-tag">{SOON_LABEL}</span>}
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="sc-app-label">{SAMPLE.slot}</span>
            <span className="sc-app-btn"><IcoCheck /> Aprobar</span>
          </div>
        </>
      );
    default:
      return (
        <>
          <div className="flex items-center gap-1.5">
            {([["heart", Heart], ["comment", MessageCircle], ["eye", Eye]] as const).map(([k, Icon]) => (
              <span key={k} className="sc-app-pill" data-k={k}>
                <Icon strokeWidth={2.2} aria-hidden="true" />
              </span>
            ))}
          </div>
          <Sparkline values={[12, 14, 13, 17, 16, 21, 24, 23, 29, 33]} className="sy-spark--lg" />
          <p className="sy-stn-note">Evolución de tu cuenta</p>
        </>
      );
  }
}

function StationCard({ s, i }: { s: Station; i: number }) {
  const Icon = s.icon;
  return (
    <div className="sy-stn sc-rise" style={vars({ "--d": `${0.15 + i * 0.16}s`, "--nd": `${FAN_FD[i] + TRAVEL}s` })}>
      <div className="sy-stn-head">
        <span className="sy-stn-n">{s.n}</span>
        <span className="sc-app-label">{s.label}</span>
        <Icon className="sy-stn-ico" strokeWidth={2} aria-hidden="true" />
      </div>
      <div className="sy-stn-body">
        <InsideStation id={s.id} />
      </div>
    </div>
  );
}

export function HeroSystem() {
  return (
    <LiveZone className="sy-hero mx-auto mt-12 max-w-6xl md:mt-14">
      {/* Escritorio: núcleo + abanico + recorrido */}
      <div className="sy-hero-canvas" aria-hidden="true">
        <Wires w={W} h={H} paths={PATHS} tone="light" />
        <CoreDisc className="sy-core--hero" style={vars({ "--ha": "0.6s" })} />
        {STATIONS.map((s, i) => (
          <div key={s.id} className="sy-slot" style={{ left: `${(s.x / W) * 100}%`, top: `${(PORT_Y / H) * 100}%` }}>
            <span className="sy-port" />
            <StationCard s={s} i={i} />
          </div>
        ))}
        {STATIONS.map((s, i) => (
          <span
            key={`t-${s.id}`}
            className="sy-track-node"
            style={{ left: `${(s.x / W) * 100}%`, top: `${(TRACK_Y / H) * 100}%`, ...vars({ "--nd": `${TRACK_FD[Math.max(i - 1, 0)] + (i ? TRAVEL : 0)}s` }) }}
          />
        ))}
      </div>

      {/* Móvil / tablet: el mismo recorrido en vertical */}
      <div className="sy-hero-stack" aria-hidden="true">
        <CoreDisc className="sy-core--stack" />
        <ol className="sy-rail">
          {STATIONS.map((s, i) => (
            <li key={s.id} className="sy-rail-item">
              <span className="sy-rail-node" />
              <StationCard s={s} i={i} />
            </li>
          ))}
        </ol>
      </div>

      <p className="sc-muted mt-6 text-center text-xs">
        Ejemplo ilustrativo del sistema de SocialCors: foto → análisis → contenido → redes → métricas.
      </p>
    </LiveZone>
  );
}
