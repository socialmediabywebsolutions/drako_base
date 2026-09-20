// "El motor de SocialCors" — diagrama con el logo REAL en el centro (LOGO_URL, el mismo del
// nav/footer/favicon) y las capacidades conectadas alrededor.
//
// Ilustrativo: NO contiene ninguna cifra ni métrica. Los nodos de "Interacciones", "Métricas" y
// "Evolución" solo muestran el tipo de señal (icono), nunca resultados.
//
// Animación (todo CSS, ver landing.css `.sc-e*`):
//  - un pulso de luz recorre cada conexión (stroke-dashoffset) en cadena, una vez cada 14 s;
//  - cada nodo reacciona cuando le llega el pulso; el logo emite un halo al recibir las entradas;
//  - solo corre bajo `.sc-live` (LiveZone: en pantalla y sin prefers-reduced-motion). Sin esa
//    clase el diagrama queda estático y completo.
import type { CSSProperties } from "react";
import {
  BookOpen,
  Camera,
  CalendarDays,
  ChartColumn,
  FileText,
  Hash,
  Heart,
  ScanSearch,
  Send,
  Share2,
  TrendingUp,
  Type,
  type LucideIcon,
} from "lucide-react";
import LiveZone from "./live-zone";
import Reveal from "./reveal";
import { LOGO_URL } from "./landing-config";
import { INTERACTION_ICON, INTERACTION_LABEL, type InteractionKind } from "./product-ui";

// El ciclo total es de 14 s (definido en landing.css como --cycle) y un pulso tarda el 16 % en
// recorrer una conexión: 14 s × 0,16 = 2,24 s. Los retrasos de abajo se derivan de ahí.
const TRAVEL = 2.24;

const W = 1000;
const H = 700;

type NodeId =
  | "foto" | "analisis" | "conocimiento" | "core" | "contenido" | "texto" | "hashtags"
  | "redes" | "publicacion" | "calendario" | "interacciones" | "metricas" | "evolucion";

type NodeDef = {
  id: Exclude<NodeId, "core">;
  label: string;
  sub?: string;
  icon: LucideIcon;
  x: number;
  y: number;
  small?: boolean;
  // Retraso (s) del "latido" del nodo: cuándo le llega el pulso (o cuándo sale, en los orígenes).
  nd: number;
};

const NODES: NodeDef[] = [
  { id: "foto", label: "Foto / vídeo", sub: "Tú aportas el contenido", icon: Camera, x: 500, y: 46, nd: 0 },
  { id: "analisis", label: "Análisis", sub: "Personas, lugar, producto", icon: ScanSearch, x: 500, y: 146, nd: 0 + TRAVEL },
  { id: "conocimiento", label: "Conocimiento del negocio", sub: "Perfil y Base de conocimiento", icon: BookOpen, x: 120, y: 300, nd: 1.2 },
  { id: "contenido", label: "Contenido", sub: "Adaptado a tu negocio", icon: FileText, x: 840, y: 300, nd: 3.6 + TRAVEL },
  { id: "texto", label: "Texto", icon: Type, x: 928, y: 186, small: true, nd: 4.8 + TRAVEL },
  { id: "hashtags", label: "Hashtags", icon: Hash, x: 928, y: 414, small: true, nd: 4.8 + TRAVEL },
  { id: "redes", label: "Redes sociales", sub: "Instagram · LinkedIn", icon: Share2, x: 500, y: 470, nd: 3.6 + TRAVEL },
  { id: "publicacion", label: "Publicación", sub: "Revisas y apruebas", icon: Send, x: 320, y: 558, nd: 4.8 + TRAVEL },
  { id: "calendario", label: "Calendario", sub: "Hora propuesta", icon: CalendarDays, x: 680, y: 558, nd: 4.8 + TRAVEL },
  { id: "interacciones", label: "Interacciones", sub: "Me gusta, comentarios y vistas", icon: Heart, x: 500, y: 648, nd: 6.2 + TRAVEL },
  { id: "metricas", label: "Métricas", sub: "De tus publicaciones", icon: ChartColumn, x: 735, y: 648, nd: 7.8 + TRAVEL },
  { id: "evolucion", label: "Evolución", sub: "De tu cuenta", icon: TrendingUp, x: 915, y: 648, small: true, nd: 9.0 + TRAVEL },
];

const CORE = { x: 500, y: 300 };

const pt = (id: NodeId) => (id === "core" ? CORE : NODES.find((n) => n.id === id)!);

// Conexiones en el sentido del flujo. `fd` = retraso (s) con que arranca su pulso.
const EDGES: { from: NodeId; to: NodeId; fd: number }[] = [
  { from: "foto", to: "analisis", fd: 0 },
  { from: "analisis", to: "core", fd: 1.2 },
  { from: "conocimiento", to: "core", fd: 1.2 },
  { from: "core", to: "contenido", fd: 3.6 },
  { from: "contenido", to: "texto", fd: 4.8 },
  { from: "contenido", to: "hashtags", fd: 4.8 },
  { from: "core", to: "redes", fd: 3.6 },
  { from: "redes", to: "publicacion", fd: 4.8 },
  { from: "redes", to: "calendario", fd: 4.8 },
  { from: "publicacion", to: "interacciones", fd: 6.2 },
  { from: "calendario", to: "interacciones", fd: 6.2 },
  { from: "interacciones", to: "metricas", fd: 7.8 },
  { from: "metricas", to: "evolucion", fd: 9.0 },
];

// Radio del disco del logo en unidades del viewBox (23cqw de ancho / 2 = 115). Las conexiones
// que tocan el núcleo arrancan/terminan en su borde, para que el pulso entre y salga a la vista
// en lugar de recorrer la mitad del camino oculto bajo el logo.
const CORE_R = 116;

function endpoint(id: NodeId, toward: NodeId) {
  const p = pt(id);
  if (id !== "core") return p;
  const q = pt(toward);
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: p.x + (dx / len) * CORE_R, y: p.y + (dy / len) * CORE_R };
}

function pathFor(from: NodeId, to: NodeId) {
  const a = endpoint(from, to);
  const b = endpoint(to, from);
  if (a.x === b.x || a.y === b.y) return `M${a.x} ${a.y} L${b.x} ${b.y}`;
  const my = (a.y + b.y) / 2;
  return `M${a.x} ${a.y} C${a.x} ${my} ${b.x} ${my} ${b.x} ${b.y}`;
}

// Señales de interacción que entran en el nodo "Interacciones" (exterior del diagrama).
const BADGES: { kind: InteractionKind; x: number }[] = [
  { kind: "heart", x: 196 },
  { kind: "comment", x: 252 },
  { kind: "eye", x: 308 },
];
const BADGE_Y = 648;
const ARRIVE_INTERACTIONS = 6.2 + TRAVEL;

const vars = (v: Record<string, string>) => v as unknown as CSSProperties;
const pos = (x: number, y: number): CSSProperties => ({ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` });

// ── Lógica común: el flujo en texto (lectores de pantalla) ──────────────────
const FLOW_TEXT = [
  "Tú aportas una foto o un vídeo.",
  "SocialCors analiza el contenido (personas, lugar, producto).",
  "Lo cruza con el conocimiento de tu negocio: perfil y Base de conocimiento.",
  "Genera el contenido: texto y hashtags adaptados a tu negocio.",
  "Lo prepara para tus redes sociales (Instagram y LinkedIn).",
  "Lo propones a tu calendario; tú revisas y apruebas la publicación.",
  "Una vez publicado, pueden llegar interacciones: me gusta, comentarios y visualizaciones.",
  "Las métricas de tus publicaciones te permiten ver la evolución de tu cuenta.",
];

const PILLARS = ["Tu negocio", "Tu contenido", "El conocimiento del negocio", "Las redes sociales", "La automatización"];

function CoreLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`sc-core ${className}`}>
      <span className="sc-halo" aria-hidden="true" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO_URL} alt="SocialCors" width={230} height={230} loading="lazy" decoding="async" className="sc-core-img" />
    </div>
  );
}

function ENode({ n }: { n: NodeDef }) {
  const Icon = n.icon;
  return (
    <div
      className="sc-enode"
      data-small={n.small ? "true" : undefined}
      style={{ ...pos(n.x, n.y), ...vars({ "--nd": `${n.nd}s` }) }}
    >
      <Icon className="sc-eicon" strokeWidth={2} aria-hidden="true" />
      <div className="min-w-0">
        <p className="sc-etitle">{n.label}</p>
        {n.sub && <p className="sc-esub">{n.sub}</p>}
      </div>
    </div>
  );
}

// ── Versión escritorio / tablet: composición radial ─────────────────────────
function DesktopEngine() {
  return (
    <div className="sc-ecanvas" aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} className="sc-esvg" preserveAspectRatio="none" focusable="false">
        <g className="sc-elines">
          {EDGES.map((e) => (
            <path key={`${e.from}-${e.to}`} d={pathFor(e.from, e.to)} pathLength={100} />
          ))}
          {/* señales → Interacciones (tramo corto) */}
          {BADGES.map((b) => (
            <path key={b.kind} d={`M${b.x} ${BADGE_Y} L${pt("interacciones").x} ${BADGE_Y}`} pathLength={100} />
          ))}
        </g>
        <g className="sc-eflows">
          {/* resplandor (trazo ancho translúcido; evita filter, que repinta todo el SVG) + pulso */}
          {(["sc-flow sc-flow--glow", "sc-flow"] as const).flatMap((cls) =>
            EDGES.map((e) => (
              <path
                key={`${cls}-${e.from}-${e.to}`}
                d={pathFor(e.from, e.to)}
                pathLength={100}
                className={cls}
                style={vars({ "--fd": `${e.fd}s` })}
              />
            )),
          )}
        </g>
      </svg>

      <CoreLogo />
      {NODES.map((n) => (
        <ENode key={n.id} n={n} />
      ))}

      {BADGES.map((b, i) => {
        const Icon = INTERACTION_ICON[b.kind];
        return (
          <span
            key={b.kind}
            className="sc-ebadge"
            data-k={b.kind}
            style={{ ...pos(b.x, BADGE_Y), ...vars({ "--bd": `${ARRIVE_INTERACTIONS + i * 0.22}s` }) }}
          >
            <Icon strokeWidth={2.2} />
          </span>
        );
      })}
    </div>
  );
}

// ── Versión móvil: flujo vertical, mismo orden y mismos nodos ───────────────
function MNode({ id }: { id: Exclude<NodeId, "core"> }) {
  const n = NODES.find((x) => x.id === id)!;
  const Icon = n.icon;
  return (
    <div className="sc-enode sc-enode--m" style={vars({ "--nd": `${n.nd}s` })}>
      <Icon className="sc-eicon" strokeWidth={2} aria-hidden="true" />
      <div className="min-w-0">
        <p className="sc-etitle">{n.label}</p>
        {n.sub && <p className="sc-esub">{n.sub}</p>}
      </div>
    </div>
  );
}

function MSeg({ fd }: { fd: number }) {
  return <span className="sc-vseg" style={vars({ "--fd": `${fd}s` })} />;
}

function MobileEngine() {
  return (
    <div className="sc-mflow" aria-hidden="true">
      <div className="sc-mrow">
        <MNode id="foto" />
        <MNode id="conocimiento" />
      </div>
      <MSeg fd={0} />
      <MNode id="analisis" />
      <MSeg fd={1.2} />
      <CoreLogo className="sc-core--m" />
      <MSeg fd={3.6} />
      <MNode id="contenido" />
      <div className="sc-mrow sc-mrow--tight">
        <MNode id="texto" />
        <MNode id="hashtags" />
      </div>
      <MSeg fd={3.6} />
      <MNode id="redes" />
      <MSeg fd={4.8} />
      <div className="sc-mrow">
        <MNode id="publicacion" />
        <MNode id="calendario" />
      </div>
      <MSeg fd={6.2} />
      <MNode id="interacciones" />
      <div className="sc-mbadges">
        {BADGES.map((b, i) => {
          const Icon = INTERACTION_ICON[b.kind];
          return (
            <span
              key={b.kind}
              className="sc-ebadge sc-ebadge--m"
              data-k={b.kind}
              style={vars({ "--bd": `${ARRIVE_INTERACTIONS + i * 0.22}s` })}
            >
              <Icon strokeWidth={2.2} />
            </span>
          );
        })}
      </div>
      <MSeg fd={7.8} />
      <div className="sc-mrow">
        <MNode id="metricas" />
        <MNode id="evolucion" />
      </div>
    </div>
  );
}

export function Engine() {
  return (
    <section id="motor" aria-labelledby="engine-title" className="px-4 py-12 sm:px-6 md:py-16">
      <Reveal className="mx-auto max-w-6xl">
        <div className="sc-engine rounded-3xl px-4 py-12 sm:px-8 md:px-10 md:py-16">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]" style={{ color: "#a5b4fc" }}>
              El motor de SocialCors
            </p>
            <h2
              id="engine-title"
              className="mt-3 text-3xl font-black leading-[1.1] tracking-tight text-white md:text-4xl"
            >
              Todo conectado en un solo flujo.
            </h2>
            <p className="mt-4 text-base leading-relaxed md:text-lg" style={{ color: "rgba(255,255,255,0.72)" }}>
              SocialCors entiende tu negocio, analiza lo que publicas y convierte tus fotos y vídeos en contenido
              preparado para tus redes.
            </p>
          </div>

          {/* Qué une el motor */}
          <ul
            aria-label="Lo que conecta SocialCors"
            className="mx-auto mt-8 flex max-w-4xl flex-wrap items-center justify-center gap-x-2 gap-y-2"
          >
            {PILLARS.map((p, i) => (
              <li key={p} className="flex items-center gap-2">
                <span className="sc-epillar">{p}</span>
                {i < PILLARS.length - 1 && (
                  <span aria-hidden="true" className="text-sm font-black" style={{ color: "#818cf8" }}>+</span>
                )}
              </li>
            ))}
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="text-sm font-black" style={{ color: "#818cf8" }}>=</span>
              <span className="sc-epillar" data-strong="true">Un flujo único</span>
            </li>
          </ul>

          <LiveZone className="sc-elive mx-auto mt-10 max-w-5xl">
            <DesktopEngine />
            <MobileEngine />
          </LiveZone>

          <ol className="sr-only">
            {FLOW_TEXT.map((step) => (
              <li key={step}>{step}</li>
            ))}
            {(["heart", "comment", "eye", "trend"] as InteractionKind[]).map((k) => (
              <li key={k}>{INTERACTION_LABEL[k]}</li>
            ))}
          </ol>

          <p className="mx-auto mt-8 max-w-2xl text-center text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
            Diagrama ilustrativo del flujo de SocialCors. Las interacciones y la evolución de tu cuenta dependen de
            tu audiencia; no son resultados garantizados.
          </p>
        </div>
      </Reveal>
    </section>
  );
}
