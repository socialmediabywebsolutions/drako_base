import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import type { ReelsConfig, ReelsEffect, ReelsProgressCallback, ReelsRenderer, ReelsTemplate, ReelsTextOverlay, ReelsTextRole } from "./ReelsEngine";

// Reexportado tal cual desde mp4-muxer — necesitamos el tipo concreto para pasar el
// Muxer ya construido (con pista de audio o sin ella) a encodeAudioTrack.
type Mp4Muxer = Muxer<ArrayBufferTarget>;

// Capa 2 — única implementación de ReelsRenderer hoy. Usa Canvas (OffscreenCanvas
// cuando está disponible) para dibujar cada frame y WebCodecs (VideoEncoder) para
// comprimirlo a H.264. Estas dos APIs SOLO existen en el navegador — no hay Canvas
// ni WebCodecs en el runtime de Cloudflare Workers donde corren las API routes de
// esta app, así que este renderer únicamente puede invocarse desde un componente
// cliente, nunca desde un endpoint de servidor (ver auditoría previa).
//
// VideoEncoder por sí solo produce chunks de bitstream H.264 crudo, no un .mp4
// reproducible — mp4-muxer empaqueta esos chunks en un contenedor MP4 válido.

export class ReelsRenderError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "ReelsRenderError";
    this.code = code;
  }
}

function assertBrowserEnvironment(): void {
  if (typeof document === "undefined") {
    throw new ReelsRenderError(
      "CanvasRenderer solo puede ejecutarse en el navegador (necesita document/Canvas).",
      "REELS_RENDERER_REQUIRES_BROWSER",
    );
  }
  if (typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined") {
    throw new ReelsRenderError(
      "Este navegador no soporta WebCodecs (VideoEncoder/VideoFrame).",
      "REELS_RENDERER_WEBCODECS_UNSUPPORTED",
    );
  }
}

// fallbackFontSize solo se usa cuando el overlay no trae `role` (retrocompatibilidad —
// ver TEXT_ROLE_STYLE para el tamaño por jerarquía, que es lo que usa ReelsAgent hoy).
const TEMPLATE_STYLES: Record<ReelsTemplate, { weight: number; family: string; fallbackFontSize: number }> = {
  fitness: { weight: 900, family: "system-ui, sans-serif", fallbackFontSize: 80 },
  lifestyle: { weight: 600, family: "system-ui, sans-serif", fallbackFontSize: 72 },
  motivation: { weight: 800, family: "system-ui, sans-serif", fallbackFontSize: 85 },
  education: { weight: 700, family: "system-ui, sans-serif", fallbackFontSize: 70 },
  marketing: { weight: 800, family: "system-ui, sans-serif", fallbackFontSize: 75 },
};

// Jerarquía visual de 3 capas: título arriba (grande), subtítulo centrado (medio),
// CTA abajo (pequeño). Solo se aplica cuando el overlay trae `role`.
export const TEXT_ROLE_STYLE: Record<ReelsTextRole, { fontSize: number; position: NonNullable<ReelsTextOverlay["position"]> }> = {
  title: { fontSize: 180, position: "top" },
  subtitle: { fontSize: 130, position: "center" },
  cta: { fontSize: 90, position: "bottom" },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Progreso 0-1 de un efecto/overlay en el instante t, con ease-in-out para que el
// movimiento se sienta "suave" en vez de lineal/mecánico.
function easedProgress(t: number, startAt: number, endAt: number): number {
  if (endAt <= startAt) return t >= startAt ? 1 : 0;
  const linear = clamp((t - startAt) / (endAt - startAt), 0, 1);
  return linear * linear * (3 - 2 * linear); // smoothstep
}

function easeInOut(x: number): number {
  return x < 0.5 ? 2 * x * x : -1 + (4 - 2 * x) * x;
}

const SEGMENT_FADE_SEC = 0.3;

// Envolvente 0→1→0 en los bordes de cada segmento (0.3s de entrada, 0.3s de salida) para
// que al pasar de un efecto encadenado al siguiente (no solapados) no haya un salto
// brusco en la transformación — cada segmento nace y muere en el estado "neutro".
function computeSegmentBlend(t: number, startAt: number, endAt: number): number {
  const elapsed = t - startAt;
  const remaining = endAt - t;
  const blendIn = easeInOut(clamp(elapsed / SEGMENT_FADE_SEC, 0, 1));
  const blendOut = easeInOut(clamp(remaining / SEGMENT_FADE_SEC, 0, 1));
  return Math.min(blendIn, blendOut);
}

type FrameTransform = {
  scale: number;
  translateX: number;
  translateY: number;
  rotateDeg: number;
  blurPx: number;
  /** Overscan (multiplicador uniforme sobre el cover normal) que necesita el efecto más exigente activo en este frame — ver EFFECT_OVERSCAN / drawImageCover. */
  overscan: number;
  /** 0-1 — opacidad de un destello blanco superpuesto (transición de cierre "flash", ver drawTransitionOverlay). */
  flashOpacity: number;
  /** Progreso 0-1 del barrido de una barra sólida de un borde a otro del canvas (transición de cierre "wipe"), o null si no hay wipe activo en este frame. */
  wipeProgress: number | null;
};

// Desplazamiento del centrado de drawImageCover hacia la zona con más detalle/contraste
// del eje que el "cover" recorta — calculado UNA VEZ por imagen (ver computeSaliencyOffset),
// nunca por frame. { offsetX: 0, offsetY: 0 } = centrado geométrico normal, sin cambios.
type FocalOffset = { offsetX: number; offsetY: number };
const NEUTRAL_FOCAL_OFFSET: FocalOffset = { offsetX: 0, offsetY: 0 };

// Overscan (multiplicador uniforme sobre el cover normal — drawImage no permite estirar
// ancho y alto de forma independiente sin distorsionar la imagen) piso para frames sin
// movimiento: solo margen de seguridad para bordes de redondeo/antialiasing. También es la
// base que usa computeSaliencyOffset para su clamp de seguridad (sigue siendo el overscan
// MÁS PEQUEÑO de cualquier frame, así que ese clamp no cambia). El extra por encima de este
// piso ya no es un valor único para "cualquier efecto que se mueva algo" — ver
// EFFECT_OVERSCAN, calculado caso por caso según lo que cada efecto necesita de verdad en
// el eje más exigente (el canvas 9:16 es mucho más alto que ancho, ese eje casi siempre es X).
const MIN_OVERSCAN = 1.01;

// Overscan necesario POR EFECTO (no un único valor para todos) — cada uno solo pide el
// margen que su propio movimiento máximo requiere (a la intensidad más alta que le asigna
// cualquier plantilla, ver TEMPLATE_EFFECT_PROFILE en ReelsAgent.ts), en vez de un
// MAX_OVERSCAN plano para cualquier efecto "que se mueva algo".
//
// zoom-in, zoom-out, parallax, ken-burns, drift y pulse NO aparecen aquí a propósito:
// zoom-in/zoom-out/pulse solo cambian `scale` y nunca bajan de 1.0 más que en un instante
// puntual (nunca dejan de cubrir el canvas); parallax y ken-burns traen su propio zoom
// (0.6x/0.5x la intensidad) que crece más rápido que su propio pan (0.08x) en todo su
// rango — se autocubren; drift es insignificante (0.6% del ancho como mucho). Todos caen
// al MIN_OVERSCAN por defecto (ver drawImageCover).
//
// pan-left/pan-right: hasta 6.0% del ancho a intensidad 0.5 (fitness/motivation) → 1.09,
// más generoso que el mínimo con margen (1.07) porque ReelsAgent ahora consolida
// pan-left/pan-right en una sola casilla del pool ("pan", resuelta a una dirección al azar
// — ver EffectPoolKind) en vez de dos, así que aparece la mitad de veces que antes: se
// puede permitir un poco más de zoom por aparición sin que el clip se sienta más recortado
// de media a lo largo de todo el Reel.
//
// rotate/tilt son geometría distinta: no es solo "cuánto se traslada" sino cuánto necesita
// crecer un rectángulo rotado θ para seguir cubriendo un canvas mucho más alto que ancho
// (requiredOverscan = |cosθ| + aspecto·|sinθ|, con aspecto=H/W=1.78 en X) — un canvas tan
// vertical amplifica mucho el margen que pide una rotación pequeña. rotate (hasta 3° a
// intensidad 0.5) necesita ~9.2% en X; tilt (hasta 4° + su propio pan) necesita ~15.7% en
// X. Ninguno de los dos trae zoom propio que lo autocubra (a diferencia de parallax/
// ken-burns), así que ambos necesitan su margen completo aquí.
const EFFECT_OVERSCAN: Partial<Record<ReelsEffect["kind"], number>> = {
  "pan-left": 1.09,
  "pan-right": 1.09,
  rotate: 1.1,
  tilt: 1.17,
};

// Combina todos los efectos activos en el instante t en una única transformación.
// zoom es multiplicativo (varios zooms se acumulan), pan/rotate/blur son aditivos.
function computeTransformAtTime(effects: ReelsEffect[], t: number, width: number, height: number): FrameTransform {
  const transform: FrameTransform = {
    scale: 1,
    translateX: 0,
    translateY: 0,
    rotateDeg: 0,
    blurPx: 0,
    overscan: MIN_OVERSCAN,
    flashOpacity: 0,
    wipeProgress: null,
  };

  for (const effect of effects) {
    if (t < effect.startAt || t > effect.endAt) continue;
    transform.overscan = Math.max(transform.overscan, EFFECT_OVERSCAN[effect.kind] ?? MIN_OVERSCAN);
    const progress = easedProgress(t, effect.startAt, effect.endAt);
    const blend = computeSegmentBlend(t, effect.startAt, effect.endAt);
    const intensity = (effect.intensity ?? 0.15) * blend;

    switch (effect.kind) {
      case "zoom-in":
        transform.scale *= 1 + intensity * progress;
        break;
      case "zoom-out":
        transform.scale *= 1 + intensity * (1 - progress);
        break;
      case "pan-left":
        transform.translateX -= width * 0.12 * intensity * progress;
        break;
      case "pan-right":
        transform.translateX += width * 0.12 * intensity * progress;
        break;
      case "parallax":
        transform.scale *= 1 + intensity * 0.6 * progress;
        transform.translateX += width * 0.08 * intensity * Math.sin(progress * Math.PI);
        break;
      case "rotate":
        transform.rotateDeg += intensity * 6 * Math.sin(progress * Math.PI * 2);
        break;
      case "blur":
        transform.blurPx += intensity * 16 * progress;
        break;
      case "ken-burns":
        // Zoom lento + pan diagonal constante, de esquina a esquina (nunca oscila).
        transform.scale *= 1 + intensity * 0.5 * progress;
        transform.translateX += width * 0.08 * intensity * progress;
        transform.translateY += height * 0.08 * intensity * progress;
        break;
      case "drift":
        // Movimiento lateral casi imperceptible — ReelsAgent ya acota su intensity
        // a 0.05-0.15 (EFFECT_INTENSITY_OVERRIDE), aquí solo se traduce a píxeles.
        transform.translateX += width * 0.04 * intensity * Math.sin(progress * Math.PI * 0.5);
        break;
      case "pulse":
        // Zoom rítmico: oscila entre 1.0 y 1.0+intensity, 2.5 ciclos durante el segmento.
        transform.scale *= 1 + intensity * (0.5 - 0.5 * Math.cos(progress * Math.PI * 2 * 2.5));
        break;
      case "tilt":
        // Ligera rotación (barrido 0→pico→0, sin oscilar) + pan horizontal constante.
        transform.rotateDeg += intensity * 8 * Math.sin(progress * Math.PI);
        transform.translateX += width * 0.07 * intensity * progress;
        break;
      case "flash":
        // Destello blanco corto tipo "corte" (Reels/TikTok) — sube y baja de opacidad
        // dentro de la ventana del efecto en vez de quedarse fijo. El dibujo real ocurre
        // en drawTransitionOverlay (CanvasRenderer.render), aquí solo se calcula cuánto.
        transform.flashOpacity = Math.max(transform.flashOpacity, Math.min(0.85, intensity * 1.5 * Math.sin(progress * Math.PI)));
        break;
      case "wipe":
        // Progreso 0-1 del barrido de una barra sólida de un borde a otro del canvas —
        // el dibujo real también ocurre en drawTransitionOverlay, aquí solo se guarda en
        // qué punto del barrido está este frame (no usa intensity: la barra es siempre opaca).
        transform.wipeProgress = progress;
        break;
    }
  }

  return transform;
}

// Dibuja la imagen ya cargada rellenando el canvas ("cover"). `focalOffset` (ver
// computeSaliencyOffset) desplaza el centrado base hacia la zona con más detalle del eje
// que el cover recorta — se SUMA a transform.translateX/Y, nunca lo reemplaza, así que
// los efectos de pan/zoom de ReelsAgent siguen operando igual encima de este punto de partida.
function drawImageCover(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  image: ImageBitmap,
  canvasWidth: number,
  canvasHeight: number,
  transform: FrameTransform,
  focalOffset: FocalOffset,
): void {
  const coverScale = Math.max(canvasWidth / image.width, canvasHeight / image.height) * transform.overscan;
  const drawWidth = image.width * coverScale * transform.scale;
  const drawHeight = image.height * coverScale * transform.scale;

  ctx.save();
  ctx.filter = transform.blurPx > 0.5 ? `blur(${transform.blurPx.toFixed(1)}px)` : "none";
  ctx.translate(
    canvasWidth / 2 + transform.translateX + focalOffset.offsetX,
    canvasHeight / 2 + transform.translateY + focalOffset.offsetY,
  );
  ctx.rotate((transform.rotateDeg * Math.PI) / 180);
  ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();
}

// Lado más largo del canvas auxiliar usado para calcular la energía de contraste — basta
// con una versión muy reducida de la imagen (esto se computa una sola vez por imagen, no
// por frame) para localizar dónde está "lo interesante" del eje que el cover recorta.
const SALIENCY_DOWNSCALE_MAX_DIM = 128;

// Por debajo de este overflow (en px, ya con MIN_OVERSCAN aplicado) se considera que el
// cover no recorta nada relevante en ese eje — ver PROBLEMA 1 del audit: object-fit: cover
// nunca desborda los dos ejes a la vez (coverScale = max(...) garantiza que al menos uno
// encaje exacto), así que basta comprobar si AMBOS overflow están por debajo de esto.
const SALIENCY_OVERFLOW_EPSILON_PX = 2;

function luminanceGrid(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  downWidth: number,
  downHeight: number,
): Float32Array {
  const { data } = ctx.getImageData(0, 0, downWidth, downHeight);
  const lum = new Float32Array(downWidth * downHeight);
  for (let i = 0, p = 0; p < data.length; i++, p += 4) {
    lum[i] = data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114;
  }
  return lum;
}

// Energía de contraste por columna (axis "x") o por fila (axis "y") — suma, para cada
// pixel de esa columna/fila, la diferencia de luminancia con sus 4 vecinos (arriba/abajo/
// izquierda/derecha). Un valor alto indica bordes/textura/detalle (típicamente un sujeto);
// un fondo liso da valores bajos. Deliberadamente simple (sin librería de visión) — solo
// necesita ordenar franjas por "cuánto pasa ahí", no clasificar qué es.
function computeAxisEnergy(lum: Float32Array, downWidth: number, downHeight: number, axis: "x" | "y"): Float32Array {
  const size = axis === "x" ? downWidth : downHeight;
  const energy = new Float32Array(size);

  for (let a = 0; a < size; a++) {
    let sum = 0;
    const otherSize = axis === "x" ? downHeight : downWidth;
    for (let b = 0; b < otherSize; b++) {
      const x = axis === "x" ? a : b;
      const y = axis === "x" ? b : a;
      const idx = y * downWidth + x;
      const left = x > 0 ? lum[idx - 1] : lum[idx];
      const right = x < downWidth - 1 ? lum[idx + 1] : lum[idx];
      const up = y > 0 ? lum[idx - downWidth] : lum[idx];
      const down = y < downHeight - 1 ? lum[idx + downWidth] : lum[idx];
      sum += Math.abs(lum[idx] - left) + Math.abs(lum[idx] - right) + Math.abs(lum[idx] - up) + Math.abs(lum[idx] - down);
    }
    energy[a] = sum;
  }

  return energy;
}

// Ventana deslizante: encuentra, entre todas las posiciones contiguas de tamaño
// `windowSize` dentro de `energy`, la que acumula más energía — ahí es donde "está pasando
// algo" en la franja que el cover va a recortar. Devuelve el CENTRO de esa ventana como
// fracción 0-1 a lo largo del eje analizado (0 = borde izquierdo/superior de la imagen).
function bestWindowCenterFraction(energy: Float32Array, windowSize: number): number {
  const n = energy.length;
  const w = clamp(Math.round(windowSize), 1, n);

  let sum = 0;
  for (let i = 0; i < w; i++) sum += energy[i];
  let bestSum = sum;
  let bestStart = 0;

  for (let start = 1; start <= n - w; start++) {
    sum += energy[start + w - 1] - energy[start - 1];
    if (sum > bestSum) {
      bestSum = sum;
      bestStart = start;
    }
  }

  return (bestStart + w / 2) / n;
}

// Calculado UNA VEZ por imagen (nunca por frame — ver su único call site en
// CanvasRenderer.render). Desplaza el centrado de drawImageCover hacia la zona con más
// contraste/detalle de CADA eje que tenga overflow real (ver PROBLEMA 1 del audit) — el
// cover puro (overscan=1.0) nunca desborda los dos ejes a la vez, pero en cuanto se aplica
// cualquier overscan>1.0 (que es siempre, ver EFFECT_OVERSCAN) sí puede haber overflow en
// ambos simultáneamente, así que ya no se elige un único eje "dominante": X e Y se evalúan
// de forma independiente, cada uno con su propio clamp de seguridad, en vez del centrado
// geométrico ciego de siempre. El cálculo usa MIN_OVERSCAN como base conservadora (ver
// abajo), así que el offset resultante es seguro para cualquier frame pero no aprovecha el
// margen extra que dan pan/rotate/tilt en sus propios frames — eso queda fuera de este
// cálculo estático a propósito, para no acoplar P1 al sistema de efectos por-frame.
// Fallback a NEUTRAL_FOCAL_OFFSET si no hay overflow relevante en ningún eje, si no hay
// contexto 2D disponible, o si algo falla — nunca debe romper la generación del Reel.
function computeSaliencyOffset(image: ImageBitmap, canvasWidth: number, canvasHeight: number): FocalOffset {
  try {
    // MIN_OVERSCAN (el más pequeño posible en cualquier frame, incluso tras pasar a
    // overscan por-efecto — ver EFFECT_OVERSCAN) para que el clamp de más abajo sea
    // seguro pase lo que pase: cualquier efecto con overscan propio solo da MÁS margen,
    // nunca menos.
    const coverScale = Math.max(canvasWidth / image.width, canvasHeight / image.height) * MIN_OVERSCAN;
    const drawWidth = image.width * coverScale;
    const drawHeight = image.height * coverScale;
    const overflowX = drawWidth - canvasWidth;
    const overflowY = drawHeight - canvasHeight;

    const needsX = overflowX > SALIENCY_OVERFLOW_EPSILON_PX;
    const needsY = overflowY > SALIENCY_OVERFLOW_EPSILON_PX;
    if (!needsX && !needsY) {
      return NEUTRAL_FOCAL_OFFSET;
    }

    const scale = SALIENCY_DOWNSCALE_MAX_DIM / Math.max(image.width, image.height);
    const downWidth = Math.max(1, Math.round(image.width * scale));
    const downHeight = Math.max(1, Math.round(image.height * scale));

    const downCanvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(downWidth, downHeight) : document.createElement("canvas");
    if (!(downCanvas instanceof OffscreenCanvas)) {
      downCanvas.width = downWidth;
      downCanvas.height = downHeight;
    }
    const downCtx = downCanvas.getContext("2d") as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
    if (!downCtx) return NEUTRAL_FOCAL_OFFSET;

    downCtx.drawImage(image, 0, 0, downWidth, downHeight);
    const lum = luminanceGrid(downCtx, downWidth, downHeight);

    // Cualquier overscan > 1.0 (que es siempre, salvo el cover puro sin margen) produce
    // overflow en los dos ejes a la vez — antes solo se corregía el eje dominante y el
    // otro se dejaba fijo en 0, aunque tuviera overflow real (pequeño, pero real). Ahora
    // se evalúan ambos de forma independiente, cada uno con su propia ventana deslizante
    // de energía y su propio clamp ±overflow/2 — siguen sin poder interferir entre sí.
    let offsetX = 0;
    if (needsX) {
      const energyX = computeAxisEnergy(lum, downWidth, downHeight, "x");
      const windowCols = (canvasWidth / drawWidth) * downWidth;
      const focalFractionX = bestWindowCenterFraction(energyX, windowCols);
      const maxOffsetX = overflowX / 2;
      offsetX = clamp(drawWidth * (0.5 - focalFractionX), -maxOffsetX, maxOffsetX);
    }

    let offsetY = 0;
    if (needsY) {
      const energyY = computeAxisEnergy(lum, downWidth, downHeight, "y");
      const windowRows = (canvasHeight / drawHeight) * downHeight;
      const focalFractionY = bestWindowCenterFraction(energyY, windowRows);
      const maxOffsetY = overflowY / 2;
      offsetY = clamp(drawHeight * (0.5 - focalFractionY), -maxOffsetY, maxOffsetY);
    }

    return { offsetX, offsetY };
  } catch (err) {
    console.warn("[CanvasRenderer] No se pudo calcular el offset de saliencia; se usa centrado normal.", err);
    return NEUTRAL_FOCAL_OFFSET;
  }
}

// Ancho de la barra sólida del "wipe" en proporción al canvas — suficientemente ancha
// para que el barrido se note, sin cubrir instantáneamente todo el frame de golpe.
const WIPE_BAR_WIDTH_RATIO = 0.55;

// Dibuja las transiciones de cierre "flash" (destello blanco) y "wipe" (barra sólida
// barriendo el canvas) por encima de la imagen ya compuesta — mismo frame, una capa más,
// sin necesitar componer dos imágenes distintas (ver OUTRO_TRANSITION_POOL en ReelsAgent).
function drawTransitionOverlay(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  transform: FrameTransform,
  canvasWidth: number,
  canvasHeight: number,
): void {
  if (transform.flashOpacity > 0.01) {
    ctx.save();
    ctx.globalAlpha = transform.flashOpacity;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.restore();
  }

  if (transform.wipeProgress !== null) {
    // La barra recorre desde fuera del borde izquierdo hasta fuera del borde derecho —
    // en progress 0 y 1 está completamente fuera de canvas (invisible), como cualquier
    // otro efecto encadenado que arranca/termina en su estado neutro.
    const barWidth = canvasWidth * WIPE_BAR_WIDTH_RATIO;
    const barLeft = -barWidth + transform.wipeProgress * (canvasWidth + barWidth * 2);
    ctx.save();
    ctx.fillStyle = "#000000";
    ctx.fillRect(barLeft, 0, barWidth, canvasHeight);
    ctx.restore();
  }
}

function wrapText(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// No bajar el tamaño de fuente de un texto largo por debajo de este % del pedido — los
// tamaños de TEXT_ROLE_STYLE (180/130/90px) buscan impacto visual a propósito; reducirlos
// demasiado para que quepan anularía ese objetivo, así que se prioriza mantener presencia
// visual sobre encajar perfecto en `maxHeight` en el caso extremo de un texto muy largo.
const MIN_FONT_SIZE_SCALE = 0.55;
const FONT_SHRINK_STEP = 0.92;

// Margen de seguridad respecto al borde de canvas más cercano al calcular cuánto alto
// puede ocupar un bloque de texto envuelto en varias líneas (ver fitTextBlock/maxHeight).
const TEXT_VERTICAL_MARGIN = 48;

// Contorno fijo (no depende del brillo muestreado) dibujado siempre detrás del fill del
// texto — capa de seguridad de contraste independiente del color: si el muestreo de
// brillo elige mal o el fondo es uniforme, este trazo oscuro sigue delimitando las letras.
const TEXT_OUTLINE_COLOR = "rgba(0,0,0,0.55)";
const TEXT_OUTLINE_WIDTH_RATIO = 0.06;
const TEXT_OUTLINE_MIN_WIDTH = 2;

// Reduce el fontSize en pasos (nunca por debajo de MIN_FONT_SIZE_SCALE del tamaño pedido)
// hasta que el bloque de líneas quepa en maxHeight, o hasta agotar el margen de reducción
// permitido. Necesario porque los tamaños grandes de P3 (180/130/90px) pueden envolver a
// 2-3 líneas con textos más largos y desbordar verticalmente el canvas si no se acotan.
function fitTextBlock(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  text: string,
  fontWeight: number,
  fontFamily: string,
  baseFontSize: number,
  maxWidth: number,
  maxHeight: number,
): { lines: string[]; fontSize: number; lineHeight: number } {
  const minFontSize = baseFontSize * MIN_FONT_SIZE_SCALE;
  let fontSize = baseFontSize;

  const measure = () => {
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    const lines = wrapText(ctx, text, maxWidth);
    const lineHeight = fontSize * 1.15;
    return { lines, lineHeight, blockHeight: lines.length * lineHeight };
  };

  let block = measure();
  while (block.blockHeight > maxHeight && fontSize > minFontSize) {
    fontSize = Math.max(minFontSize, fontSize * FONT_SHRINK_STEP);
    block = measure();
  }

  return { lines: block.lines, fontSize, lineHeight: block.lineHeight };
}

function textForOverlayAtTime(overlay: ReelsTextOverlay, t: number): string {
  const progress = clamp((t - overlay.startAt) / overlay.durationSec, 0, 1);
  if (overlay.animation === "word-by-word") {
    const words = overlay.text.split(/\s+/).filter(Boolean);
    const revealCount = Math.max(1, Math.ceil(words.length * progress));
    return words.slice(0, revealCount).join(" ");
  }
  if (overlay.animation === "typewriter") {
    const revealCount = Math.max(1, Math.ceil(overlay.text.length * progress));
    return overlay.text.slice(0, revealCount);
  }
  return overlay.text;
}

// Y relativo del canvas por posición — "top-center"/"upper-center" son paradas
// intermedias entre "top" y "center", usadas hoy solo por el título (ver
// pickTitlePosition en ReelsAgent.ts) para que no todos los Reels lleven el título
// pegado al borde superior.
// bottom: subido de 0.82 a 0.79 — con el fontSize de CTA de 68px (ver TEXT_ROLE_STYLE),
// 0.82 dejaba el borde inferior de la caja del CTA a solo ~247px del borde del canvas en
// el caso de 2 líneas, por debajo de la "zona segura" que reservan Instagram/TikTok para
// sus propios controles (username, caption, iconos de interacción — hasta ~300-320px
// cuando están visibles). Con 0.79 y CTA a 68px: ~344px de margen con 1 línea, ~305px con
// 2 líneas. Tras subir CTA a 90px (P4) el margen baja a ~331px (1 línea) / ~280px (2
// líneas) — ligeramente por debajo del objetivo de 300px en el caso de 2 líneas; no se
// tocó este ratio porque no formaba parte de este ajuste, pero queda anotado para revisar
// si algún CTA real llega a envolver a 2 líneas con este tamaño.
const POSITION_Y_RATIO: Record<NonNullable<ReelsTextOverlay["position"]>, number> = {
  top: 0.18,
  "top-center": 0.28,
  "upper-center": 0.38,
  center: 0.5,
  bottom: 0.79,
};

// Traduce el tipo de animación del overlay a opacity/offsetY/scale en el instante t,
// cubriendo tanto la entrada como la salida (antes solo había entrada; el texto
// desaparecía de golpe en endAt). introWindow/outroWindow usan la misma duración (máx
// 0.5s o mitad del tiempo visible, lo que sea menor) y se tocan exactamente en el punto
// medio del overlay, así que nunca se solapan ni dejan un hueco sin animar.
// La salida es simétrica a la entrada dentro de la misma familia: fade-in↔fade-out,
// slide-up (entra desde abajo) ↔ sale deslizando hacia abajo, slide-down (entra desde
// arriba) ↔ sale deslizando hacia arriba, zoom (crece al entrar) ↔ encoge al salir.
function computeEntryAnimation(
  animation: ReelsTextOverlay["animation"],
  t: number,
  startAt: number,
  durationSec: number,
): { opacity: number; offsetY: number; scale: number } {
  const endAt = startAt + durationSec;
  const window = Math.min(0.5, durationSec / 2);
  const introProgress = clamp((t - startAt) / window, 0, 1);
  const outroProgress = clamp((endAt - t) / window, 0, 1);
  // El más restrictivo de los dos manda — así un overlay corto no llega a estar 100%
  // visible entre que termina de entrar y ya tiene que empezar a salir.
  const visibility = Math.min(introProgress, outroProgress);
  // Mientras introProgress < 1 todavía estamos en la ventana de entrada; en cuanto llega
  // a 1 (resto de la vida del overlay, incluida la salida) manda la fórmula de salida,
  // que en reposo (outroProgress = 1) da exactamente el mismo valor neutro que la entrada
  // ya terminada.
  const inEntry = introProgress < 1;

  switch (animation) {
    case "fade-in":
      return { opacity: visibility, offsetY: 0, scale: 1 };
    case "slide-up":
      return { opacity: visibility, offsetY: inEntry ? (1 - introProgress) * 50 : (1 - outroProgress) * 50, scale: 1 };
    case "slide-down":
      return { opacity: visibility, offsetY: inEntry ? -50 * (1 - introProgress) : -50 * (1 - outroProgress), scale: 1 };
    case "zoom":
      return { opacity: visibility, offsetY: 0, scale: inEntry ? 0.85 + 0.15 * introProgress : 0.85 + 0.15 * outroProgress };
    case "word-by-word":
    case "typewriter":
      // El reveal progresivo del propio texto ya transmite la entrada — solo un fade rápido
      // (tanto al entrar como al salir).
      return { opacity: Math.min(1, introProgress * 2, outroProgress * 2), offsetY: 0, scale: 1 };
    default:
      return { opacity: visibility, offsetY: 0, scale: 1 };
  }
}

// Detecta si el fondo bajo el texto es claro u oscuro muestreando el área indicada
// (pensada para ser el bounding box real del bloque de texto — ver su uso en
// drawTextOverlays), para elegir texto negro/sombra blanca o texto blanco/sombra negra.
// Se recalcula cada frame porque los efectos mueven la imagen bajo el texto, así que lo
// que hay debajo puede cambiar de brillo con el tiempo.
export function sampleAverageBrightness(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  sampleWidth: number,
  sampleHeight: number,
): number {
  const { data } = ctx.getImageData(centerX - sampleWidth / 2, centerY - sampleHeight / 2, sampleWidth, sampleHeight);
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    total += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
  }
  return total / (data.length / 4);
}

function drawTextOverlays(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  overlays: ReelsTextOverlay[],
  template: ReelsTemplate,
  t: number,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const templateStyle = TEMPLATE_STYLES[template];

  for (const overlay of overlays) {
    const endAt = overlay.startAt + overlay.durationSec;
    if (t < overlay.startAt || t > endAt) continue;

    const { opacity, offsetY, scale } = computeEntryAnimation(overlay.animation, t, overlay.startAt, overlay.durationSec);

    const roleStyle = overlay.role ? TEXT_ROLE_STYLE[overlay.role] : undefined;
    const requestedFontSize = overlay.fontSize ?? roleStyle?.fontSize ?? templateStyle.fallbackFontSize;
    const position = overlay.position ?? roleStyle?.position ?? "center";
    const baseY = canvasHeight * (POSITION_Y_RATIO[position] ?? 0.5);

    const text = textForOverlayAtTime(overlay, t);
    const maxWidth = canvasWidth * 0.85;
    // Espacio vertical disponible centrado en baseY, acotado por el borde de canvas más
    // cercano (con margen de seguridad) — evita que 2-3 líneas de un texto largo con los
    // tamaños grandes de TEXT_ROLE_STYLE (180/130/90px) se salgan del canvas por arriba/abajo.
    const maxHeight = 2 * Math.min(baseY, canvasHeight - baseY) - TEXT_VERTICAL_MARGIN * 2;
    const { lines, fontSize, lineHeight } = fitTextBlock(
      ctx,
      text,
      templateStyle.weight,
      templateStyle.family,
      requestedFontSize,
      maxWidth,
      maxHeight,
    );
    if (lines.length === 0) continue;

    // Bounding box real del bloque (ancho real tras el wrap, alto real de todas las
    // líneas + el mismo padding que luego dibuja el fondo semitransparente) — el brillo
    // se muestrea sobre esta área exacta, no sobre un parche fijo arbitrario, para que la
    // decisión de color refleje lo que de verdad hay detrás del texto.
    const maxLineWidth = Math.max(...lines.map((line) => ctx.measureText(line).width));
    const boxPaddingX = 32;
    const boxPaddingY = 20;
    const boxWidth = maxLineWidth + boxPaddingX * 2;
    const boxHeight = lines.length * lineHeight + boxPaddingY * 2;

    const brightness = sampleAverageBrightness(ctx, canvasWidth / 2, baseY, boxWidth, boxHeight);
    const isLightBackground = brightness > 128;
    const textColor = isLightBackground ? "#000000" : "#ffffff";
    const shadowColor = isLightBackground ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)";
    const boxColor = isLightBackground ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.35)";

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.font = `${templateStyle.weight} ${fontSize}px ${templateStyle.family}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = 28;

    if (scale !== 1) {
      // Escala alrededor del centro del bloque de texto (no de la esquina del canvas).
      const blockCenterY = baseY + offsetY;
      ctx.translate(canvasWidth / 2, blockCenterY);
      ctx.scale(scale, scale);
      ctx.translate(-canvasWidth / 2, -blockCenterY);
    }

    const startY = baseY - ((lines.length - 1) * lineHeight) / 2 + offsetY;

    // Fondo semitransparente real detrás del texto (antes se asignaba fillStyle pero se
    // sobreescribía sin dibujarse nunca) — sin sombra propia, para no verse "difuminado".
    ctx.shadowBlur = 0;
    ctx.fillStyle = boxColor;
    ctx.fillRect(canvasWidth / 2 - boxWidth / 2, startY - lineHeight / 2 - boxPaddingY, boxWidth, boxHeight);
    ctx.shadowBlur = 28;

    lines.forEach((line, i) => {
      const y = startY + i * lineHeight;
      // Contorno de contraste SIEMPRE presente, fijo (no depende de isLightBackground) —
      // capa de seguridad independiente del muestreo de brillo: aunque este falle o el
      // fondo sea uniforme, el trazo oscuro delimita las letras contra cualquier imagen.
      ctx.lineJoin = "round";
      ctx.strokeStyle = TEXT_OUTLINE_COLOR;
      ctx.lineWidth = Math.max(TEXT_OUTLINE_MIN_WIDTH, fontSize * TEXT_OUTLINE_WIDTH_RATIO);
      ctx.strokeText(line, canvasWidth / 2, y);
      ctx.fillStyle = textColor;
      ctx.fillText(line, canvasWidth / 2, y);
    });

    ctx.restore();
  }
}

// Y del handle como fracción del canvas (textBaseline "bottom", así que el texto entero
// queda POR ENCIMA de esta línea) — 0.70 en vez de pegado al borde inferior (ver P5 del
// audit): a POSITION_Y_RATIO.bottom (0.79, la misma "zona segura" del CTA) la caja del
// CTA a 90px puede llegar hasta ~123.5px por encima de su propio baseY en el caso de 2
// líneas, es decir su borde superior cae en ~0.79-123.5/1920 ≈ 0.725 del canvas. 0.70 deja
// ~48px de margen por encima de ese peor caso, así el handle (esquina inferior izquierda)
// nunca se solapa verticalmente con el CTA (centrado) aunque este envuelva a 2 líneas.
// A la vez, 0.70 sigue estando muy por encima del borde inferior real (~576px de margen
// en un canvas de 1920px), bien dentro de la zona segura de Instagram/TikTok.
const HANDLE_Y_RATIO = 0.7;

// Handle del cliente — SIEMPRE se dibuja si se pasa, sin importar plantilla/efectos
// (esquina inferior izquierda, semitransparente con sombra para leerse tanto sobre fondos
// claros como oscuros). Ya no comparte tamaño/posición 1:1 con drawHandle en
// StaticSlideRenderer.ts (Carruseles): el canvas de Reels es mucho más alto y compite con
// una jerarquía de texto mucho mayor, así que aquí necesita más tamaño y su propia zona
// vertical segura (ver HANDLE_Y_RATIO) en vez de ir pegado al borde inferior.
function drawHandle(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  handle: string,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const text = handle.startsWith("@") ? handle : `@${handle}`;
  // 56px (subido de 40) — es la marca del influencer, tiene que leerse igual de bien que
  // el CTA (ver P5 del audit), no quedar como un detalle discreto de esquina.
  const fontSize = 56;
  const padding = 28;
  const y = canvasHeight * HANDLE_Y_RATIO;

  ctx.save();
  ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.globalAlpha = 0.7;
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 6;

  // Mismo contorno de contraste fijo que drawTextOverlays desde P2 — antes esta función
  // solo tenía una sombra suave (shadowBlur), insuficiente sobre fondos claros/blancos
  // (ropa deportiva, paredes de gimnasio, etc.), donde el relleno blanco quedaba
  // prácticamente invisible. El contorno no depende del brillo del fondo: siempre está.
  ctx.lineJoin = "round";
  ctx.strokeStyle = TEXT_OUTLINE_COLOR;
  ctx.lineWidth = Math.max(TEXT_OUTLINE_MIN_WIDTH, fontSize * TEXT_OUTLINE_WIDTH_RATIO);
  ctx.strokeText(text, padding, y);

  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, padding, y);
  ctx.restore();
}

async function loadImageBitmap(imageUrl: string): Promise<ImageBitmap> {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new ReelsRenderError(`No se pudo cargar la imagen origen (${res.status}).`, "REELS_IMAGE_FETCH_FAILED");
  }
  const blob = await res.blob();
  return createImageBitmap(blob);
}

// AAC-LC — codec de audio más ampliamente soportado por AudioEncoder y por el
// contenedor MP4 (mp4-muxer lo declara como 'aac').
const AAC_CODEC = "mp4a.40.2";

async function loadAudioBuffer(musicTrackUrl: string): Promise<AudioBuffer> {
  const res = await fetch(musicTrackUrl);
  if (!res.ok) {
    throw new ReelsRenderError(`No se pudo cargar la pista de audio (${res.status}).`, "REELS_AUDIO_FETCH_FAILED");
  }
  const arrayBuffer = await res.arrayBuffer();
  const audioCtx = new AudioContext();
  try {
    return await audioCtx.decodeAudioData(arrayBuffer);
  } finally {
    void audioCtx.close();
  }
}

// La música es un extra, nunca el motivo por el que falle un Reel: si el navegador no
// soporta WebCodecs de audio, la pista no carga (R2 caído, mp3 corrupto…) o el códec no
// está soportado, se registra un aviso y el Reel se genera igualmente, mudo.
async function prepareAudioTrack(musicTrackUrl: string): Promise<AudioBuffer | null> {
  if (typeof AudioEncoder === "undefined" || typeof AudioData === "undefined" || typeof AudioContext === "undefined") {
    console.warn("[CanvasRenderer] Este navegador no soporta WebCodecs de audio; el Reel se generará sin música.");
    return null;
  }
  try {
    const buffer = await loadAudioBuffer(musicTrackUrl);
    const support = await AudioEncoder.isConfigSupported({
      codec: AAC_CODEC,
      numberOfChannels: buffer.numberOfChannels,
      sampleRate: buffer.sampleRate,
      bitrate: 128_000,
    });
    if (!support.supported) {
      console.warn(`[CanvasRenderer] Códec de audio no soportado (${AAC_CODEC}); el Reel se generará sin música.`);
      return null;
    }
    return buffer;
  } catch (err) {
    console.warn("[CanvasRenderer] No se pudo preparar la pista de audio; el Reel se generará sin música.", err);
    return null;
  }
}

const AUDIO_FADE_OUT_SEC = 0.3;

// Recorta o repite en bucle la pista para que dure exactamente durationSec, y aplica un
// fade-out corto al final para evitar un corte/pop audible si la pista no encaja exacta.
function buildPcmForDuration(buffer: AudioBuffer, durationSec: number): Float32Array[] {
  const totalSamples = Math.round(durationSec * buffer.sampleRate);
  const fadeSamples = Math.min(totalSamples, Math.round(AUDIO_FADE_OUT_SEC * buffer.sampleRate));

  const channels: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const source = buffer.getChannelData(c);
    const out = new Float32Array(totalSamples);
    for (let i = 0; i < totalSamples; i++) {
      out[i] = source[i % source.length];
    }
    for (let i = 0; i < fadeSamples; i++) {
      out[totalSamples - fadeSamples + i] *= 1 - i / fadeSamples;
    }
    channels.push(out);
  }
  return channels;
}

const AUDIO_FRAME_SIZE = 4096;

// El soporte del códec ya se validó en prepareAudioTrack antes de declarar la pista de
// audio en el Muxer, así que aquí se asume disponible.
async function encodeAudioTrack(buffer: AudioBuffer, durationSec: number, muxer: Mp4Muxer): Promise<void> {
  const sampleRate = buffer.sampleRate;
  const numberOfChannels = buffer.numberOfChannels;
  const channels = buildPcmForDuration(buffer, durationSec);
  const totalSamples = channels[0]?.length ?? 0;

  const encoderConfig: AudioEncoderConfig = { codec: AAC_CODEC, numberOfChannels, sampleRate, bitrate: 128_000 };
  const encoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (err) => console.error("[CanvasRenderer] AudioEncoder error", err),
  });
  encoder.configure(encoderConfig);

  for (let offset = 0; offset < totalSamples; offset += AUDIO_FRAME_SIZE) {
    const frameCount = Math.min(AUDIO_FRAME_SIZE, totalSamples - offset);
    const chunkData = new Float32Array(frameCount * numberOfChannels);
    for (let c = 0; c < numberOfChannels; c++) {
      chunkData.set(channels[c].subarray(offset, offset + frameCount), c * frameCount);
    }

    const audioData = new AudioData({
      format: "f32-planar",
      sampleRate,
      numberOfChannels,
      numberOfFrames: frameCount,
      timestamp: Math.round((offset / sampleRate) * 1_000_000),
      data: chunkData,
    });
    encoder.encode(audioData);
    audioData.close();
  }

  await encoder.flush();
  encoder.close();
}

// H.264 High Profile Level 4.0 — soportado por todos los navegadores con WebCodecs.
const H264_CODEC = "avc1.640028";

export class CanvasRenderer implements ReelsRenderer {
  async render(config: ReelsConfig, onProgress?: ReelsProgressCallback): Promise<Blob> {
    assertBrowserEnvironment();

    const { width, height, fps, durationSec, musicTrackUrl } = config;
    // imageSegments solo viene poblado cuando ReelsConfig.imageUrls tenía 2+ entradas
    // (ver ReelsAgent.buildMultiImageEffects) — con 0-1 imagen, el Reel sigue siendo
    // exactamente el flujo de una sola imagen de siempre.
    const imageSegments = config.imageSegments && config.imageSegments.length > 0 ? config.imageSegments : null;

    const [images, audioBuffer] = await Promise.all([
      imageSegments
        ? Promise.all(imageSegments.map((seg) => loadImageBitmap(seg.imageUrl)))
        : loadImageBitmap(config.imageUrl).then((img) => [img]),
      musicTrackUrl ? prepareAudioTrack(musicTrackUrl) : Promise.resolve(null),
    ]);

    // Una entrada por imagen, calculada una sola vez aquí — nunca dentro del loop de
    // frames de más abajo (ver computeSaliencyOffset).
    const saliencyOffsets = images.map((img) => computeSaliencyOffset(img, width, height));

    // Devuelve el índice de la imagen que corresponde al instante t (para images[] y
    // saliencyOffsets[] a la vez). Sin imageSegments, siempre 0 — comportamiento idéntico
    // al de antes de multi-imagen.
    function imageIndexForTime(t: number): number {
      if (!imageSegments) return 0;
      const idx = imageSegments.findIndex((seg) => t >= seg.startAt && t < seg.endAt);
      return idx === -1 ? imageSegments.length - 1 : idx;
    }

    const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(width, height) : document.createElement("canvas");
    if (!(canvas instanceof OffscreenCanvas)) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
    if (!ctx) {
      throw new ReelsRenderError("No se pudo obtener el contexto 2D del canvas.", "REELS_CANVAS_CONTEXT_UNAVAILABLE");
    }

    const encoderConfig: VideoEncoderConfig = {
      codec: H264_CODEC,
      width,
      height,
      bitrate: 6_000_000,
      framerate: fps,
    };
    const support = await VideoEncoder.isConfigSupported(encoderConfig);
    if (!support.supported) {
      throw new ReelsRenderError(`Este navegador no soporta la configuración de vídeo requerida (${H264_CODEC}).`, "REELS_CODEC_UNSUPPORTED");
    }

    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: "avc", width, height, frameRate: fps },
      audio: audioBuffer ? { codec: "aac", numberOfChannels: audioBuffer.numberOfChannels, sampleRate: audioBuffer.sampleRate } : undefined,
      fastStart: "in-memory",
    });

    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (err) => console.error("[CanvasRenderer] VideoEncoder error", err),
    });
    encoder.configure(encoderConfig);

    const totalFrames = Math.round(durationSec * fps);
    const frameDurationUs = Math.round(1_000_000 / fps);
    const keyFrameInterval = fps; // 1 keyframe/segundo — suficiente para un clip de 15-30s
    const videoProgressShare = audioBuffer ? 0.9 : 1; // deja un 10% para el encode de audio

    for (let i = 0; i < totalFrames; i++) {
      const t = i / fps;
      const transform = computeTransformAtTime(config.effects, t, width, height);
      const imageIndex = imageIndexForTime(t);

      ctx.clearRect(0, 0, width, height);
      drawImageCover(ctx, images[imageIndex], width, height, transform, saliencyOffsets[imageIndex]);
      drawTransitionOverlay(ctx, transform, width, height);
      drawTextOverlays(ctx, config.textOverlays, config.template, t, width, height);
      if (config.handle) drawHandle(ctx, config.handle, width, height);

      const frame = new VideoFrame(canvas as CanvasImageSource, {
        timestamp: i * frameDurationUs,
        duration: frameDurationUs,
      });
      encoder.encode(frame, { keyFrame: i % keyFrameInterval === 0 });
      frame.close();
      onProgress?.(((i + 1) / totalFrames) * videoProgressShare);
    }

    await encoder.flush();
    encoder.close();

    if (audioBuffer) {
      try {
        await encodeAudioTrack(audioBuffer, durationSec, muxer);
      } catch (err) {
        console.warn("[CanvasRenderer] Falló la codificación de audio; el Reel se generará sin música.", err);
      }
      onProgress?.(1);
    }

    muxer.finalize();

    const { buffer } = muxer.target as ArrayBufferTarget;
    return new Blob([buffer], { type: "video/mp4" });
  }
}
