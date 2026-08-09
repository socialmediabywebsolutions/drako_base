// Vive en su propio archivo, separado de ReelsAgent.ts, a propósito: StaticSlideRenderer.ts
// lo importa como valor real (no type) desde el bundle del cliente (preview de carrusel
// estático vía AiCarouselCreator.tsx), mientras que ReelsAgent.ts tiene imports
// server-only (D1, NicheIntelligenceService) que rompen ese bundle si comparten archivo
// — ver incidente deploy #725 ("Module not found: Can't resolve 'fs'", Fix 3 de la
// auditoría 2026-08-09). seededRandom no tiene ninguna dependencia, así que puede vivir
// en un módulo hoja que ambos lados (servidor y cliente) importan sin arrastrar nada más.

// Hash simple (djb2-like) de un string → entero 32-bit, usado para sembrar mulberry32.
function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (Math.imul(31, hash) + seed.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

// PRNG mulberry32 — determinista dado un seed, buena distribución para nuestro caso
// (elegir entre 2-4 opciones repetidamente), sin dependencias externas. Mismo seed
// (ej. la URL de la imagen) siempre produce la misma secuencia de números: mismo Reel
// siempre sale igual (efectos + tipografía), distinto entre imágenes distintas.
export function seededRandom(seed: string): () => number {
  let state = hashSeed(seed);
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
