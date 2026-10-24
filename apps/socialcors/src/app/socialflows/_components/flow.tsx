// Lenguaje visual compartido del Home: "conexiones de producto".
//  - Wires: cables finos con curvas suaves (nada de trazos en ángulo recto tipo circuito) que se
//    dibujan al entrar en pantalla y, bajo `.sc-live` (LiveZone), llevan un pulso de luz ocasional.
//  - Spine: el hilo que une una sección con la siguiente.
//  - SysHead: cabecera de sección con su nodo de entrada al sistema.
//  - CoreDisc: el logo REAL (LOGO_URL) sobre su disco, reutilizable a distintos tamaños.
//  - Sparkline: forma de crecimiento ILUSTRATIVA (no son datos).
// Todo es CSS/SVG en línea; sin librerías. Las animaciones respetan prefers-reduced-motion
// (ver landing.css: los estados por defecto son estáticos y completos).
import type { CSSProperties, ReactNode } from "react";
import Reveal from "./reveal";
import { LOGO_URL } from "./landing-config";

export const vars = (v: Record<string, string>) => v as unknown as CSSProperties;

export type WirePath = {
  d: string;
  /** Retraso (s) del pulso. Si no se indica, el cable es solo estático. */
  fd?: number;
  /** "act" = actividad que vuelve (rosado); por defecto, contenido que sale (índigo). */
  kind?: "out" | "act";
  /** Retraso (s) del trazado inicial al entrar en pantalla. */
  draw?: number;
  /** Conexión "próximamente": punteada y siempre sin pulso. */
  soon?: boolean;
};

export function Wires({
  w,
  h,
  paths,
  tone = "light",
  className = "",
}: {
  w: number;
  h: number;
  paths: WirePath[];
  tone?: "light" | "dark";
  className?: string;
}) {
  const pulsed = paths.filter((p) => p.fd !== undefined);
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={`sy-wires sy-${tone} ${className}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <g className="sy-base">
        {paths.map((p, i) => (
          <path
            key={i}
            d={p.d}
            pathLength={100}
            className={[p.kind === "act" ? "sy-act" : "", p.soon ? "sy-soon" : ""].filter(Boolean).join(" ") || undefined}
            style={p.draw !== undefined ? vars({ "--dd": `${p.draw}s` }) : undefined}
          />
        ))}
      </g>
      <g className="sy-pulses">
        {(["glow", "core"] as const).flatMap((layer) =>
          pulsed.map((p, i) => (
            <path
              key={`${layer}-${i}`}
              d={p.d}
              pathLength={100}
              className={`sy-pulse sy-pulse--${layer}${p.kind === "act" ? " sy-act" : ""}`}
              style={vars({ "--fd": `${p.fd}s` })}
            />
          )),
        )}
      </g>
    </svg>
  );
}

/** Curva suave entre dos puntos (control vertical u horizontal). */
export function curve(a: { x: number; y: number }, b: { x: number; y: number }, axis: "v" | "h" = "v") {
  if (a.x === b.x || a.y === b.y) return `M${a.x} ${a.y} L${b.x} ${b.y}`;
  if (axis === "h") {
    const mx = (a.x + b.x) / 2;
    return `M${a.x} ${a.y} C${mx} ${a.y} ${mx} ${b.y} ${b.x} ${b.y}`;
  }
  const my = (a.y + b.y) / 2;
  return `M${a.x} ${a.y} C${a.x} ${my} ${b.x} ${my} ${b.x} ${b.y}`;
}

/** Hilo entre secciones: se dibuja hacia abajo y enciende el nodo de la siguiente. */
export function Spine({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <Reveal className={`sy-spine sy-${tone}`}>
      <span className="sy-spine-line" aria-hidden="true" />
      <span className="sy-spine-dot" aria-hidden="true" />
      <span className="sy-spine-node" aria-hidden="true" />
    </Reveal>
  );
}

/** Cabecera de sección: nodo + eyebrow + título (+ texto). */
export function SysHead({
  eyebrow,
  title,
  titleId,
  children,
  align = "center",
  dark = false,
}: {
  eyebrow?: string;
  title: ReactNode;
  titleId?: string;
  children?: ReactNode;
  align?: "center" | "left";
  dark?: boolean;
}) {
  return (
    <div className={`sy-head ${align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-xl"} ${dark ? "sy-head--dark" : ""}`}>
      {eyebrow && (
        <p className={`sy-eyebrow ${align === "center" ? "justify-center" : ""}`}>
          <i aria-hidden="true" />
          {eyebrow}
        </p>
      )}
      <h2 id={titleId} className="sy-title">{title}</h2>
      {children && <p className="sy-lead">{children}</p>}
    </div>
  );
}

/** El logo REAL de SocialCors sobre su disco. El tamaño y la posición los pone la clase. */
export function CoreDisc({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <div className={`sy-core ${className}`} style={style}>
      <span className="sy-core-halo" aria-hidden="true" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO_URL} alt="SocialCors" width={230} height={230} loading="lazy" decoding="async" className="sy-core-img" />
    </div>
  );
}

/** Forma de crecimiento ILUSTRATIVA. Nunca representa datos reales. */
export function Sparkline({ values, className = "" }: { values: number[]; className?: string }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * 100, 30 - ((v - min) / span) * 26] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L100 34 L0 34 Z`;
  return (
    <svg viewBox="0 0 100 34" preserveAspectRatio="none" className={`sy-spark ${className}`} aria-hidden="true" focusable="false">
      <path d={area} className="sy-spark-area" />
      <path d={line} className="sy-spark-line" pathLength={100} />
    </svg>
  );
}
