// "SocialCors conoce tu negocio" como sistema: las fuentes (Mi Perfil y Base de conocimiento)
// alimentan un núcleo, "Conocimiento del negocio", y de él sale el contenido con contexto.
// Cada fuente existe hoy en el producto (Mi Perfil / Base de conocimiento). Ilustrativo, sin cifras.
import { BookOpen, Crosshair, FileText, Globe, MessageSquareQuote, Package, Store, Users, type LucideIcon } from "lucide-react";
import LiveZone from "./live-zone";
import Reveal from "./reveal";
import { SysHead, Wires, curve, vars, type WirePath } from "./flow";

type Source = { title: string; text: string; icon: LucideIcon };

const PROFILE: Source[] = [
  { title: "Tu negocio", text: "Nombre de marca, descripción, misión y propuesta de valor.", icon: Store },
  { title: "Tono de comunicación", text: "Cómo hablas y qué personalidad tiene tu marca.", icon: MessageSquareQuote },
  { title: "Tu público", text: "Rango de edad, mercados objetivo y estilo visual.", icon: Users },
];
const KB: Source[] = [
  { title: "Tu web", text: "Añade una URL y SocialCors lee su contenido.", icon: Globe },
  { title: "Documentación", text: "Sube PDFs con información relevante de tu negocio.", icon: FileText },
  { title: "Productos y servicios", text: "Catálogo en CSV o Excel (cuentas de empresa).", icon: Package },
  { title: "Competidores", text: "Analiza a los competidores que tú indiques.", icon: Crosshair },
];

const W = 1000;
const H = 560;
const CORE = { x: 500, y: 250, r: 78 };
const OUT = { x: 500, y: 488 };
const LEFT_X = 165;
const RIGHT_X = 835;
const NODE_HALF_W = 135;
const L_YS = [130, 250, 370];
const R_YS = [90, 200, 310, 420];

const wires: WirePath[] = [
  ...L_YS.map((y, i) => ({
    d: curve({ x: LEFT_X + NODE_HALF_W, y }, { x: CORE.x - CORE.r + 4, y: CORE.y + (y - CORE.y) * 0.35 }, "h"),
    fd: 0.4 + i * 0.5,
    draw: 0.15 + i * 0.1,
  })),
  ...R_YS.map((y, i) => ({
    d: curve({ x: RIGHT_X - NODE_HALF_W, y }, { x: CORE.x + CORE.r - 4, y: CORE.y + (y - CORE.y) * 0.35 }, "h"),
    fd: 0.6 + i * 0.5,
    draw: 0.3 + i * 0.1,
  })),
  { d: `M${CORE.x} ${CORE.y + CORE.r} L${OUT.x} ${OUT.y - 22}`, fd: 3.4, draw: 0.9 },
];

function SourceNode({ s, x, y, i }: { s: Source; x: number; y: number; i: number }) {
  const Icon = s.icon;
  return (
    <div
      className="sy-src"
      style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, ...vars({ "--nd": `${0.4 + i * 0.5 + 2.24}s` }) }}
    >
      <span className="sy-src-ico"><Icon strokeWidth={2} aria-hidden="true" /></span>
      <div className="min-w-0">
        <h3 className="sy-src-t">{s.title}</h3>
        <p className="sy-src-p">{s.text}</p>
      </div>
    </div>
  );
}

function CoreNode() {
  return (
    <div className="sy-kcore" style={vars({ "--ha": "3.2s" })}>
      <span className="sy-core-halo" aria-hidden="true" />
      <BookOpen className="sy-kcore-ico" strokeWidth={1.8} aria-hidden="true" />
      <p className="sy-kcore-t">Conocimiento del negocio</p>
    </div>
  );
}

export function KnowsYourBusiness() {
  return (
    <section id="conocimiento" aria-labelledby="knowledge-title" className="px-4 py-12 sm:px-6 md:py-16">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <SysHead
            eyebrow="SocialCors conoce tu negocio"
            titleId="knowledge-title"
            title="Cuanto más conoce tu negocio, mejor puede ayudarte."
          >
            Tú aportas la información que quieras. SocialCors la usa como contexto al crear cada pieza.
          </SysHead>
        </Reveal>

        <LiveZone className="sy-kn mt-12">
          {/* Escritorio */}
          <Reveal className="sy-kn-canvas">
            <Wires w={W} h={H} paths={wires} tone="light" />
            <span className="sy-group" style={{ left: `${(LEFT_X / W) * 100}%`, top: `${(52 / H) * 100}%` }}>Mi Perfil</span>
            <span className="sy-group" style={{ left: `${(RIGHT_X / W) * 100}%`, top: `${(30 / H) * 100}%` }}>Base de conocimiento</span>
            {PROFILE.map((s, i) => <SourceNode key={s.title} s={s} x={LEFT_X} y={L_YS[i]} i={i} />)}
            {KB.map((s, i) => <SourceNode key={s.title} s={s} x={RIGHT_X} y={R_YS[i]} i={i + 1} />)}
            <div className="sy-kcore-wrap" style={{ left: `${(CORE.x / W) * 100}%`, top: `${(CORE.y / H) * 100}%` }}>
              <CoreNode />
            </div>
            <div className="sy-kout" style={{ left: `${(OUT.x / W) * 100}%`, top: `${(OUT.y / H) * 100}%` }}>
              <span>Contenido que tiene contexto</span>
            </div>
          </Reveal>

          {/* Móvil / tablet: las mismas fuentes en vertical, convergiendo en el núcleo */}
          <Reveal className="sy-kn-stack">
            <div className="sy-kn-list">
              <span className="sy-group sy-group--m">Mi Perfil</span>
              {PROFILE.map((s, i) => (
                <div key={s.title} className="sy-src sy-src--m" style={vars({ "--nd": `${0.4 + i * 0.5 + 2.24}s` })}>
                  <span className="sy-src-ico"><s.icon strokeWidth={2} aria-hidden="true" /></span>
                  <div className="min-w-0"><h3 className="sy-src-t">{s.title}</h3><p className="sy-src-p">{s.text}</p></div>
                </div>
              ))}
              <span className="sy-group sy-group--m">Base de conocimiento</span>
              {KB.map((s, i) => (
                <div key={s.title} className="sy-src sy-src--m" style={vars({ "--nd": `${0.4 + (i + 3) * 0.5 + 2.24}s` })}>
                  <span className="sy-src-ico"><s.icon strokeWidth={2} aria-hidden="true" /></span>
                  <div className="min-w-0"><h3 className="sy-src-t">{s.title}</h3><p className="sy-src-p">{s.text}</p></div>
                </div>
              ))}
            </div>
            <span className="sy-vlink" aria-hidden="true" />
            <CoreNode />
            <span className="sy-vlink" aria-hidden="true" />
            <div className="sy-kout sy-kout--m"><span>Contenido que tiene contexto</span></div>
          </Reveal>
        </LiveZone>
      </div>
    </section>
  );
}
