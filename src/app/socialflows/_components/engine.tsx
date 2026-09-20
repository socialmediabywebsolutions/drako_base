// "El motor de SocialCors" — el gran diagrama del producto. El logo REAL (LOGO_URL) es el núcleo y
// el flujo se lee de arriba abajo:
//   Entrada       Foto / vídeo
//   Inteligencia  Análisis IA + Conocimiento del negocio  →  SocialCors
//   Generación    Contenido → Texto · Hashtags · Formato
//   Distribución  Instagram · LinkedIn   (ida: el contenido sale; vuelta: la actividad regresa)
//   Resultado     Publicación → Interacciones → Métricas → Evolución
//
// Ilustrativo: NO contiene cifras. Las de la tarjeta de red solo aparecen si `NETWORK_STATS`
// (landing-config.ts) trae datos reales con fuente y fecha. La sparkline de "Evolución" y las barras
// de "Métricas" son formas de ejemplo (llevan la etiqueta "Vista de ejemplo"), no datos.
//
// Estado de las redes (verificado en producción el 2026-09-20, ver landing-config.ts): Instagram
// activa y funcionando; LinkedIn conectable pero sin ninguna publicación completada todavía, por lo
// que su tarjeta dice "Próximamente" (sin pulsos ni actividad) y NO "Activa".
//
// Animación (todo CSS, ver landing.css `.sc-e*` / `.sc-n*`):
//  - un pulso índigo recorre cada conexión (contenido que sale) en cadena, una vez cada 14 s;
//  - un pulso rosado vuelve de cada red al núcleo (actividad que regresa a SocialCors);
//  - cada nodo reacciona cuando le llega el pulso; el logo emite un halo al recibir las entradas y
//    otro al recibir la actividad;
//  - solo corre bajo `.sc-live` (LiveZone: en pantalla y sin prefers-reduced-motion). Sin esa clase
//    el diagrama queda estático y completo.
import type { CSSProperties } from "react";
import {
  BookOpen,
  Camera,
  ChartColumn,
  FileText,
  Hash,
  Heart,
  Instagram,
  LayoutTemplate,
  Linkedin,
  MessageCircle,
  Eye,
  ScanSearch,
  Send,
  TrendingUp,
  Type,
  Users,
  type LucideIcon,
} from "lucide-react";
import LiveZone from "./live-zone";
import Reveal from "./reveal";
import { SysHead, Sparkline } from "./flow";
import {
  AVAILABLE_NETWORKS,
  EXAMPLE_LABEL,
  LOGO_URL,
  NETWORK_STATS,
  SOON_LABEL,
  SOON_NETWORKS,
  VERIFIED_ACTIVE_NETWORKS,
  type NetworkStats,
} from "./landing-config";

// El ciclo total es de 14 s (definido en landing.css como --cycle) y un pulso tarda el 16 % en
// recorrer una conexión: 14 s × 0,16 = 2,24 s. Los retrasos de abajo se derivan de ahí.
const TRAVEL = 2.24;

const W = 1000;
const H = 850; // ¡debe coincidir con `aspect-ratio: 1000 / 850` y `.sc-core { top }` en landing.css!

type NodeKind = "std" | "interactions" | "metrics" | "evolution";
type NodeId =
  | "foto" | "analisis" | "conocimiento" | "core" | "contenido" | "texto" | "hashtags" | "formato"
  | "ig" | "li" | "publicacion" | "interacciones" | "metricas" | "evolucion";

type NodeDef = {
  id: Exclude<NodeId, "core" | "ig" | "li">;
  label: string;
  sub?: string;
  icon: LucideIcon;
  x: number;
  y: number;
  small?: boolean;
  kind?: NodeKind;
  nd: number; // retraso (s) del "latido" del nodo
};

// Calendario de pulsos (s): el contenido avanza en cadena; la actividad vuelve al final del ciclo.
const T = {
  fotoOut: 0,
  inputsToCore: 1.0,
  coreOut: 2.6,
  fanOut: 3.8,
  toInteractions: 5.2,
  toMetrics: 6.4,
  toEvolution: 7.6,
  activityOut: 9.6, // Instagram devuelve actividad al núcleo (LinkedIn, medio segundo después)
};
const ARRIVE_CORE = T.inputsToCore + TRAVEL;
const ARRIVE_ACTIVITY_CORE = T.activityOut + TRAVEL;
const ARRIVE_INTERACTIONS = T.toInteractions + TRAVEL;

const NODES: NodeDef[] = [
  { id: "foto", label: "Foto / vídeo", sub: "Tú aportas el contenido", icon: Camera, x: 500, y: 46, nd: T.fotoOut },
  { id: "analisis", label: "Análisis IA", sub: "Personas, lugar, producto", icon: ScanSearch, x: 500, y: 146, nd: T.fotoOut + TRAVEL },
  { id: "conocimiento", label: "Conocimiento del negocio", sub: "Perfil y Base de conocimiento", icon: BookOpen, x: 120, y: 300, nd: T.inputsToCore },
  { id: "contenido", label: "Contenido", sub: "Adaptado a tu negocio", icon: FileText, x: 790, y: 300, nd: T.coreOut + TRAVEL },
  { id: "texto", label: "Texto", icon: Type, x: 940, y: 190, small: true, nd: T.fanOut + TRAVEL },
  { id: "hashtags", label: "Hashtags", icon: Hash, x: 940, y: 300, small: true, nd: T.fanOut + TRAVEL },
  { id: "formato", label: "Formato", icon: LayoutTemplate, x: 940, y: 410, small: true, nd: T.fanOut + TRAVEL },
  { id: "publicacion", label: "Publicación", sub: "Revisas y apruebas", icon: Send, x: 500, y: 655, nd: T.fanOut + 2 * TRAVEL - 0.6 },
  { id: "interacciones", label: "Interacciones", icon: Heart, x: 330, y: 770, kind: "interactions", nd: ARRIVE_INTERACTIONS + 0.4 },
  { id: "metricas", label: "Métricas", sub: "De tus publicaciones", icon: ChartColumn, x: 570, y: 770, kind: "metrics", nd: T.toMetrics + TRAVEL + 0.4 },
  { id: "evolucion", label: "Evolución", sub: "De tu cuenta", icon: TrendingUp, x: 810, y: 770, kind: "evolution", nd: T.toEvolution + TRAVEL + 0.4 },
];

const CORE = { x: 500, y: 300 };
// Tarjetas de las redes (sustituyen al nodo genérico "Redes sociales").
const NET_Y = 528;
const NET_HALF_H = 56;
const NET_DEFS = [
  { key: "instagram" as const, x: 340, Mark: Instagram, bg: "linear-gradient(135deg,#F58529,#DD2A7B 60%,#8134AF)", act: T.activityOut },
  { key: "linkedin" as const, x: 660, Mark: Linkedin, bg: "#0A66C2", act: T.activityOut + 0.5 },
];

type Pt = { x: number; y: number };
const nodePt = (id: NodeDef["id"]): Pt => NODES.find((n) => n.id === id)!;

// Radio del disco del logo en unidades del viewBox (23cqw de ancho / 2 = 115).
const CORE_R = 116;
const LANE = 9;

type Edge = { d: string; fd: number; activity?: boolean; soon?: boolean };

function curveV(a: Pt, b: Pt) {
  if (a.x === b.x || a.y === b.y) return `M${a.x} ${a.y} L${b.x} ${b.y}`;
  const my = (a.y + b.y) / 2;
  return `M${a.x} ${a.y} C${a.x} ${my} ${b.x} ${my} ${b.x} ${b.y}`;
}

function coreEdgeToward(target: Pt): Pt {
  const dx = target.x - CORE.x;
  const dy = target.y - CORE.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: CORE.x + (dx / len) * CORE_R, y: CORE.y + (dy / len) * CORE_R };
}

// Dos carriles núcleo ↔ tarjeta (ida y vuelta), desplazados en perpendicular.
function lanes(cardX: number, actFd: number, soon: boolean): Edge[] {
  const top: Pt = { x: cardX, y: NET_Y - NET_HALF_H };
  const e = coreEdgeToward(top);
  const dx = top.x - e.x;
  const dy = top.y - e.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = (-dy / len) * LANE;
  const py = (dx / len) * LANE;
  const out = { a: { x: e.x - px, y: e.y - py }, b: { x: top.x - px, y: top.y - py } };
  const back = { a: { x: top.x + px, y: top.y + py }, b: { x: e.x + px, y: e.y + py } };
  return [
    { d: curveV(out.a, out.b), fd: T.coreOut, soon },
    { d: curveV(back.a, back.b), fd: actFd, activity: true, soon },
  ];
}

const EDGES: Edge[] = [
  { d: curveV(nodePt("foto"), nodePt("analisis")), fd: T.fotoOut },
  { d: curveV(nodePt("analisis"), coreEdgeToward(nodePt("analisis"))), fd: T.inputsToCore },
  { d: curveV(nodePt("conocimiento"), coreEdgeToward(nodePt("conocimiento"))), fd: T.inputsToCore },
  { d: curveV(coreEdgeToward(nodePt("contenido")), nodePt("contenido")), fd: T.coreOut },
  { d: curveV(nodePt("contenido"), nodePt("texto")), fd: T.fanOut },
  { d: curveV(nodePt("contenido"), nodePt("hashtags")), fd: T.fanOut },
  { d: curveV(nodePt("contenido"), nodePt("formato")), fd: T.fanOut },
  ...NET_DEFS.flatMap((n) => lanes(n.x, n.act, SOON_NETWORKS.includes(n.key))),
  ...NET_DEFS.map((n) => ({ d: curveV({ x: n.x, y: NET_Y + NET_HALF_H }, { x: 500, y: 655 - 24 }), fd: T.fanOut, soon: SOON_NETWORKS.includes(n.key) })),
  { d: curveV({ x: 500, y: 655 + 24 }, { x: 330, y: 770 - 40 }), fd: T.toInteractions },
  { d: `M${330 + 105} 770 L${570 - 76} 770`, fd: T.toMetrics },
  { d: `M${570 + 76} 770 L${810 - 88} 770`, fd: T.toEvolution },
];

const vars = (v: Record<string, string>) => v as unknown as CSSProperties;
const pos = (x: number, y: number): CSSProperties => ({ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` });

// ── Redes: tarjetas ─────────────────────────────────────────────────────────
type Indicator = { key: "likes" | "comments" | "views" | "followers"; kind: "heart" | "comment" | "eye" | "users"; label: string };
const INDICATORS: Record<"instagram" | "linkedin", Indicator[]> = {
  instagram: [
    { key: "likes", kind: "heart", label: "Me gusta" },
    { key: "comments", kind: "comment", label: "Comentarios" },
    { key: "views", kind: "eye", label: "Vistas" },
    { key: "followers", kind: "users", label: "Seguidores" },
  ],
  linkedin: [
    { key: "likes", kind: "heart", label: "Reacciones" },
    { key: "comments", kind: "comment", label: "Comentarios" },
    { key: "views", kind: "eye", label: "Impresiones" },
    { key: "followers", kind: "users", label: "Seguidores" },
  ],
};

const compact = new Intl.NumberFormat("es-ES", { notation: "compact", maximumFractionDigits: 1 });
const ICON_OF = { heart: Heart, comment: MessageCircle, eye: Eye, users: Users } as const;

function IndicatorIcon({ kind }: { kind: keyof typeof ICON_OF }) {
  const Icon = ICON_OF[kind];
  return <Icon strokeWidth={2.2} aria-hidden="true" />;
}

function NetCard({
  def,
  stats,
  className = "",
  style,
}: {
  def: (typeof NET_DEFS)[number];
  stats: NetworkStats | null;
  className?: string;
  style?: CSSProperties;
}) {
  const network = AVAILABLE_NETWORKS.find((n) => n.key === def.key)!;
  // Solo se llama "Activa" a lo verificado en producción; el resto, "Próximamente".
  const verified = VERIFIED_ACTIVE_NETWORKS.some((v) => v.key === def.key);
  const soon = SOON_NETWORKS.includes(def.key);
  const { Mark } = def;
  return (
    <div
      className={`sc-ncard ${className}`}
      data-data={stats ? "true" : undefined}
      data-soon={soon ? "true" : undefined}
      style={{ ...style, ...vars({ "--nd": `${T.coreOut + TRAVEL}s` }) }}
    >
      <div className="sc-nhead">
        <span className="sc-nbrand" style={{ background: def.bg }} aria-hidden="true"><Mark strokeWidth={2.2} /></span>
        <div className="min-w-0">
          <p className="sc-ntitle">{network.name}</p>
          <p className="sc-nstatus" data-on={verified ? "true" : undefined}>
            <i aria-hidden="true" />
            {verified ? "Activa en SocialCors" : SOON_LABEL}
          </p>
        </div>
      </div>
      <ul className="sc-ninds">
        {INDICATORS[def.key].map((ind, i) => {
          const value = stats?.[ind.key];
          return (
            <li key={ind.key} className="sc-nind" data-k={ind.kind} style={vars({ "--id": `${def.act - 0.6 + i * 0.25}s` })}>
              <IndicatorIcon kind={ind.kind} />
              <span className="sc-nlabel">
                {typeof value === "number" && <b>{compact.format(value)} </b>}
                {ind.label}
              </span>
            </li>
          );
        })}
      </ul>
      {stats && <p className="sc-nsrc">Datos reales · {stats.source} · {stats.asOf}</p>}
      {/* Actividad ocasional: un icono sube y se desvanece (solo con .sc-live) */}
      {!soon && (["heart", "comment", "eye"] as const).map((kind, i) => (
        <span key={kind} className="sc-nfloat" data-k={kind} style={vars({ "--nf": `${def.act - 0.4 + i * 0.7}s` })} aria-hidden="true">
          <IndicatorIcon kind={kind} />
        </span>
      ))}
    </div>
  );
}

// ── Lógica común: el flujo en texto (lectores de pantalla) ──────────────────
const FLOW_TEXT = [
  "Tú aportas una foto o un vídeo.",
  "SocialCors analiza el contenido (personas, lugar, producto).",
  "Lo cruza con el conocimiento de tu negocio: perfil y Base de conocimiento.",
  "Genera el contenido: texto, hashtags y formato adaptados a tu negocio.",
  "Lo prepara para Instagram, la red social activa hoy. LinkedIn llegará próximamente.",
  "Tú revisas y apruebas la publicación.",
  "Instagram devuelve actividad a SocialCors: me gusta, comentarios y visualizaciones.",
  "Las métricas de tus publicaciones te permiten ver la evolución de tu cuenta.",
];

const PILLARS = ["Tu negocio", "Tu contenido", "El conocimiento del negocio", "Las redes sociales", "La automatización"];

function CoreLogo({ className = "" }: { className?: string }) {
  return (
    <div
      className={`sc-core ${className}`}
      style={vars({ "--ha": `${ARRIVE_CORE}s`, "--hb": `${ARRIVE_ACTIVITY_CORE}s` })}
    >
      <span className="sc-halo" aria-hidden="true" />
      <span className="sc-halo sc-halo--act" aria-hidden="true" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO_URL} alt="SocialCors" width={230} height={230} loading="lazy" decoding="async" className="sc-core-img" />
    </div>
  );
}

// Lo que significa cada resultado, mostrado como interfaz.
function InteractionRows() {
  return (
    <ul className="sc-irows">
      {(
        [
          ["heart", "Me gusta"],
          ["comment", "Comentarios"],
          ["eye", "Visualizaciones"],
        ] as const
      ).map(([kind, label], i) => (
        <li key={kind} className="sc-irow" data-k={kind} style={vars({ "--id": `${ARRIVE_INTERACTIONS + 0.5 + i * 0.3}s` })}>
          <IndicatorIcon kind={kind} />
          <span>{label}</span>
        </li>
      ))}
    </ul>
  );
}

function MetricBars() {
  return (
    <div className="sc-mbars2" aria-hidden="true">
      {[38, 52, 44, 70, 62, 88].map((h, i) => (
        <i key={i} style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

function ENode({ n, mobile = false }: { n: NodeDef; mobile?: boolean }) {
  const Icon = n.icon;
  const panel = n.kind && n.kind !== "std";
  const style = mobile ? vars({ "--nd": `${n.nd}s` }) : { ...pos(n.x, n.y), ...vars({ "--nd": `${n.nd}s` }) };
  return (
    <div
      className={`sc-enode${mobile ? " sc-enode--m" : ""}`}
      data-small={n.small ? "true" : undefined}
      data-panel={panel ? n.kind : undefined}
      style={style}
    >
      <div className="sc-ehead">
        <Icon className="sc-eicon" strokeWidth={2} aria-hidden="true" />
        <div className="min-w-0">
          <p className="sc-etitle">{n.label}</p>
          {n.sub && <p className="sc-esub">{n.sub}</p>}
        </div>
      </div>
      {n.kind === "interactions" && <InteractionRows />}
      {n.kind === "metrics" && <MetricBars />}
      {n.kind === "evolution" && (
        <div className="sc-espark">
          <Sparkline values={[12, 14, 13, 17, 16, 21, 24, 23, 29, 33]} />
          <span className="sc-etag">{EXAMPLE_LABEL}</span>
        </div>
      )}
    </div>
  );
}

// ── Versión escritorio / tablet: composición radial ─────────────────────────
function DesktopEngine() {
  return (
    <div className="sc-ecanvas" aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} className="sc-esvg" preserveAspectRatio="none" focusable="false">
        <g className="sc-elines">
          {EDGES.map((e, i) => (
            <path key={i} d={e.d} pathLength={100} className={[e.activity ? "sc-line--act" : "", e.soon ? "sc-line--soon" : ""].filter(Boolean).join(" ") || undefined} />
          ))}
        </g>
        <g className="sc-eflows">
          {/* resplandor (trazo ancho translúcido; evita filter, que repinta todo el SVG) + pulso */}
          {(["sc-flow sc-flow--glow", "sc-flow"] as const).flatMap((cls) =>
            EDGES.filter((e) => !e.soon).map((e, i) => (
              <path
                key={`${cls}-${i}`}
                d={e.d}
                pathLength={100}
                className={e.activity ? `${cls} sc-flow--act` : cls}
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
      {NET_DEFS.map((def) => (
        <NetCard key={def.key} def={def} stats={NETWORK_STATS[def.key as keyof typeof NETWORK_STATS] ?? null} style={pos(def.x, NET_Y)} />
      ))}
    </div>
  );
}

// ── Versión móvil: flujo vertical, mismo orden y mismos nodos ───────────────
function MNode({ id }: { id: NodeDef["id"] }) {
  return <ENode n={NODES.find((x) => x.id === id)!} mobile />;
}

function MSeg({ fd }: { fd: number }) {
  return <span className="sc-vseg" style={vars({ "--fd": `${fd}s` })} />;
}

// Dos carriles: el contenido baja hacia las redes y la actividad sube de vuelta.
function MSegPair({ down, up }: { down: number; up: number }) {
  return (
    <div className="sc-vpair">
      <span className="sc-vseg" style={vars({ "--fd": `${down}s` })} />
      <span className="sc-vseg sc-vseg--act" style={vars({ "--fd": `${up}s` })} />
    </div>
  );
}

function MobileEngine() {
  return (
    <div className="sc-mflow" aria-hidden="true">
      <div className="sc-mrow">
        <MNode id="foto" />
        <MNode id="conocimiento" />
      </div>
      <MSeg fd={T.fotoOut} />
      <MNode id="analisis" />
      <MSeg fd={T.inputsToCore} />
      <CoreLogo className="sc-core--m" />
      <MSeg fd={T.coreOut} />
      <MNode id="contenido" />
      <div className="sc-mrow sc-mrow--tight sc-mrow--3">
        <MNode id="texto" />
        <MNode id="hashtags" />
        <MNode id="formato" />
      </div>
      <MSegPair down={T.coreOut} up={T.activityOut} />
      <div className="sc-mrow sc-mrow--cards">
        {NET_DEFS.map((def) => (
          <NetCard key={def.key} def={def} stats={NETWORK_STATS[def.key as keyof typeof NETWORK_STATS] ?? null} className="sc-ncard--m sc-ncard--mini" />
        ))}
      </div>
      <MSeg fd={T.fanOut} />
      <MNode id="publicacion" />
      <MSeg fd={T.toInteractions} />
      <MNode id="interacciones" />
      <MSeg fd={T.toMetrics} />
      <div className="sc-mrow">
        <MNode id="metricas" />
        <MNode id="evolucion" />
      </div>
    </div>
  );
}

export function Engine() {
  return (
    <section id="motor" aria-labelledby="engine-title" className="px-4 py-6 sm:px-6 md:py-8">
      <Reveal className="mx-auto max-w-6xl">
        <div className="sc-engine rounded-3xl px-4 py-12 sm:px-8 md:px-10 md:py-16">
          <SysHead dark eyebrow="El motor de SocialCors" titleId="engine-title" title="Todo conectado en un solo flujo.">
            SocialCors entiende tu negocio, analiza lo que publicas y convierte tus fotos y vídeos en contenido
            preparado para tus redes.
          </SysHead>

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

          {/* Leyenda de los dos flujos */}
          <p className="sc-elegend mt-6" aria-hidden="true">
            <span><i data-k="out" />Contenido que sale hacia la red</span>
            <span><i data-k="in" />Actividad que vuelve a SocialCors</span>
          </p>

          <ol className="sr-only">
            {FLOW_TEXT.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>

          <p className="mx-auto mt-4 max-w-2xl text-center text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
            Diagrama ilustrativo del flujo de SocialCors. Las interacciones y la evolución de tu cuenta dependen de
            tu audiencia; no son resultados garantizados.
          </p>
        </div>
      </Reveal>
    </section>
  );
}
