// Réplicas visuales (estáticas, decorativas) de la interfaz real de SocialCors.
// Usan las etiquetas que ya existen en el workspace (Editar, Aprobar, Post/Reel/Historia,
// "Nombre de marca", "Tono de comunicación"…). NO son funcionales y van con aria-hidden:
// el contenido de texto equivalente está siempre en la página, fuera de las maquetas.
// El caption/hashtags/hora son un EJEMPLO ilustrativo, no datos de ningún cliente.
import type { ReactNode } from "react";

export const SAMPLE = {
  caption: "Cada pieza sale del taller con el mismo cuidado. Pásate esta semana y compruébalo en persona.",
  hashtags: ["#hechoamano", "#negociolocal", "#artesania"],
  slot: "Jue · 19:30",
};

function IcoCamera() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.83 6.18A2.31 2.31 0 0 1 5.19 7.23c-.38.05-.76.11-1.13.18C3 7.58 2.25 8.51 2.25 9.57V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.57c0-1.07-.75-1.99-1.8-2.17-.38-.07-.76-.13-1.14-.18a2.31 2.31 0 0 1-1.64-1.05l-.82-1.32a2.19 2.19 0 0 0-1.74-1.04 48.8 48.8 0 0 0-5.23 0 2.19 2.19 0 0 0-1.74 1.04l-.82 1.32Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
    </svg>
  );
}

function IcoCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-2.5 w-2.5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  );
}

export function AppWindow({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`sc-app ${className}`} aria-hidden="true">
      <div className="sc-app-bar">
        <i />
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

export function PhotoTile({ className = "" }: { className?: string }) {
  return (
    <div className={`sc-photo ${className}`}>
      <IcoCamera />
    </div>
  );
}

export function FormatChips({ active = "Post" }: { active?: "Post" | "Reel" | "Historia" }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(["Post", "Reel", "Historia"] as const).map((f) => (
        <span key={f} className="sc-app-chip" data-on={f === active}>
          {f}
        </span>
      ))}
    </div>
  );
}

export function HashtagChips() {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SAMPLE.hashtags.map((h) => (
        <span key={h} className="sc-app-chip">
          {h}
        </span>
      ))}
    </div>
  );
}

// Tarjeta de pieza generada: foto + caption + hashtags + formato + hora + Editar/Aprobar.
export function GeneratedPost({ compact = false }: { compact?: boolean }) {
  return (
    <div className="sc-app-card flex flex-col gap-2.5 p-3">
      <PhotoTile className={compact ? "h-16" : "h-24"} />
      <p className="text-[0.6875rem] leading-relaxed" style={{ color: "var(--sc-app-text)" }}>
        {SAMPLE.caption}
      </p>
      <HashtagChips />
      <FormatChips />
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <span className="sc-app-label">{SAMPLE.slot}</span>
        <div className="flex gap-1.5">
          <span className="sc-app-btn" data-quiet="true">Editar</span>
          <span className="sc-app-btn">
            <IcoCheck /> Aprobar
          </span>
        </div>
      </div>
    </div>
  );
}

const DAYS = ["L", "M", "X", "J", "V", "S", "D"];

export function MiniCalendar({ animated = false }: { animated?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="sc-cal">
        {DAYS.map((d) => (
          <span key={d} className="sc-cal-day">{d}</span>
        ))}
      </div>
      <div className="sc-cal">
        {DAYS.map((d, i) => {
          const slot = i === 3;
          return (
            <span key={d} className="sc-cal-cell" data-slot={slot}>
              {slot && (
                <span
                  className={`sc-cal-pill ${animated ? "sc-pop" : ""}`}
                  style={animated ? ({ "--d": "2.4s" } as React.CSSProperties) : undefined}
                />
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function StageLabel({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span
        className="flex h-4 w-4 items-center justify-center rounded-full text-[0.5625rem] font-black text-white"
        style={{ background: "var(--sc-accent-soft)" }}
      >
        {n}
      </span>
      <span className="sc-app-label">{children}</span>
    </div>
  );
}

export function FormField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="sc-app-label">{label}</span>
      <span className="sc-app-field">{value ?? ""}</span>
    </div>
  );
}

export { IcoCamera, IcoCheck };
