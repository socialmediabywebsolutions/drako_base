"use client";

import { useState } from "react";
import { LeadModal } from "./LeadModal";

/** Botón del nav "Hablar con Drako" que abre el modal de captación de leads */
export function NavLeadButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="nb"
        onClick={() => setOpen(true)}
        style={{ cursor: "pointer", border: "none", fontFamily: "inherit" }}
      >
        Hablar con Drako →
      </button>
      <LeadModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** Botón CTA primario "Construye con nosotros →" para la sección hero */
export function HeroLeadButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="ha ha-p"
        onClick={() => setOpen(true)}
        style={{ cursor: "pointer", border: "none", fontFamily: "inherit" }}
      >
        Construye con nosotros →
      </button>
      <LeadModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** Botón CTA secundario de la sección final */
export function CtaLeadButton({ className }: { className: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className={className}
        onClick={() => setOpen(true)}
        style={{ cursor: "pointer", border: "none", fontFamily: "inherit" }}
      >
        Cuéntanos tu proyecto →
      </button>
      <LeadModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
