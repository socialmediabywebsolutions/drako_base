"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Marca con .sc-live el bloque SOLO mientras está en pantalla. Las animaciones largas del
// motor y de las señales de interacción cuelgan de esa clase, así que fuera de vista no
// consumen nada. Con prefers-reduced-motion (o sin JS / sin IntersectionObserver) la clase
// no se añade nunca y el bloque queda en su estado estático, completo y legible.
export default function LiveZone({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          el.classList.toggle("sc-live", entry.isIntersecting);
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
