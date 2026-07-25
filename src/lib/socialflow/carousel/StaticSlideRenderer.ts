import type { CarouselSlideRole } from "@/lib/socialflow/ai/agents/CarouselComposerAgent";
import type { ReelsTextRole } from "@/lib/socialflow/reels/ReelsEngine";
import { TEXT_ROLE_STYLE, sampleAverageBrightness } from "@/lib/socialflow/reels/CanvasRenderer";
import type { CarouselStyleVariant } from "@/lib/socialflow/carousel/CarouselStylePacks";

// Compone un slide de carrusel ESTÁTICO (una foto + un bloque de texto quemado encima)
// reusando la jerarquía visual y la lógica de brillo→color de CanvasRenderer.ts, pero sin
// nada de animación/timing/vídeo — dibuja una vez y exporta una imagen, no un frame de
// una secuencia. wrapText/drawImageCover/loadImageBitmap se duplican aquí (son piezas
// pequeñas y puras) en vez de exportarlas desde CanvasRenderer.ts, para no ampliar la
// superficie tocada en el renderer de Reels que ya está en producción.

export class StaticSlideRenderError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "StaticSlideRenderError";
    this.code = code;
  }
}

function assertBrowserEnvironment(): void {
  if (typeof document === "undefined") {
    throw new StaticSlideRenderError(
      "StaticSlideRenderer solo puede ejecutarse en el navegador (necesita document/Canvas).",
      "STATIC_SLIDE_RENDERER_REQUIRES_BROWSER",
    );
  }
}

async function loadImageBitmap(imageUrl: string): Promise<ImageBitmap> {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new StaticSlideRenderError(`No se pudo cargar la imagen origen (${res.status}).`, "STATIC_SLIDE_IMAGE_FETCH_FAILED");
  }
  const blob = await res.blob();
  return createImageBitmap(blob);
}

// Cover simple, sin el margen del 12% que usa CanvasRenderer.ts — ese margen existe
// solo para dar recorrido a zoom/pan/parallax, que aquí no existen.
function drawImageCoverStatic(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  image: ImageBitmap,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const coverScale = Math.max(canvasWidth / image.width, canvasHeight / image.height);
  const drawWidth = image.width * coverScale;
  const drawHeight = image.height * coverScale;
  ctx.drawImage(image, (canvasWidth - drawWidth) / 2, (canvasHeight - drawHeight) / 2, drawWidth, drawHeight);
}

// Fondo generado por Canvas cuando el slide no trae foto (modo "Crear con IA") — usa la
// técnica declarada en el estilo del pack (solid/gradient/stripes). darkOverlay (Estilo C)
// se aplica aparte, también sobre foto real, ver applyDarkOverlay.
function drawStyleBackground(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  style: CarouselStyleVariant,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const [primary, secondary] = style.backgroundColors;

  if (style.backgroundKind === "gradient" && secondary) {
    const gradient = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
    gradient.addColorStop(0, primary);
    gradient.addColorStop(1, secondary);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    return;
  }

  if (style.backgroundKind === "stripes") {
    ctx.fillStyle = primary;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = secondary ?? primary;
    const stripeWidth = canvasWidth * 0.07;
    for (let x = -canvasHeight; x < canvasWidth + canvasHeight; x += stripeWidth * 2) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + canvasHeight, canvasHeight);
      ctx.lineTo(x + canvasHeight + stripeWidth, canvasHeight);
      ctx.lineTo(x + stripeWidth, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  // "solid"
  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
}

function applyDarkOverlay(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
): void {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.restore();
}

// Handle del cliente — SIEMPRE se dibuja si se pasa, sin importar el estilo/rol del
// slide (esquina inferior izquierda, pequeño, semitransparente con sombra para leerse
// tanto sobre fondos claros como oscuros).
function drawHandle(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  handle: string,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const text = handle.startsWith("@") ? handle : `@${handle}`;
  const fontSize = 28;
  const padding = 28;

  ctx.save();
  ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 6;
  ctx.fillText(text, padding, canvasHeight - padding);
  ctx.restore();
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

const CAROUSEL_TEXT_STYLE = { weight: 800, family: "system-ui, sans-serif" };

function splitLastWord(text: string): { rest: string; lastWord: string } {
  const trimmed = text.trim();
  const idx = trimmed.lastIndexOf(" ");
  if (idx === -1) return { rest: "", lastWord: trimmed };
  return { rest: trimmed.slice(0, idx), lastWord: trimmed.slice(idx + 1) };
}

// Dibuja cada línea centrada; en la última línea, si highlightLastWord está activo,
// solo recolorea la última palabra (accentColor) — la fuente ya es la misma cursiva
// para toda la frase (fijada antes de llamar a esta función vía ctx.font).
function drawTextLines(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  lines: string[],
  startY: number,
  lineHeight: number,
  canvasWidth: number,
  textColor: string,
  highlightLastWord: boolean,
  accentColor: string | undefined,
): void {
  lines.forEach((line, i) => {
    const y = startY + i * lineHeight;
    const isLastLine = i === lines.length - 1;
    if (isLastLine && highlightLastWord && accentColor) {
      const { rest, lastWord } = splitLastWord(line);
      if (!rest) {
        ctx.textAlign = "center";
        ctx.fillStyle = accentColor;
        ctx.fillText(lastWord, canvasWidth / 2, y);
        return;
      }
      const restWithSpace = `${rest} `;
      const restWidth = ctx.measureText(restWithSpace).width;
      const lastWordWidth = ctx.measureText(lastWord).width;
      const startX = canvasWidth / 2 - (restWidth + lastWordWidth) / 2;
      ctx.textAlign = "left";
      ctx.fillStyle = textColor;
      ctx.fillText(restWithSpace, startX, y);
      ctx.fillStyle = accentColor;
      ctx.fillText(lastWord, startX + restWidth, y);
    } else {
      ctx.textAlign = "center";
      ctx.fillStyle = textColor;
      ctx.fillText(line, canvasWidth / 2, y);
    }
  });
}

// drawTextOverlays de CanvasRenderer.ts, sin el bloque de animación de entrada por rol
// (opacity/offsetY/scale calculados desde `t`) ni textForOverlayAtTime (word-by-word) —
// aquí siempre se dibuja el texto completo, ya asentado, una sola vez.
function drawStaticSlideText(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  text: string,
  role: ReelsTextRole,
  canvasWidth: number,
  canvasHeight: number,
  style?: CarouselStyleVariant,
): void {
  const { fontSize: baseFontSize, position } = TEXT_ROLE_STYLE[role];
  const fontSize = style?.fontScale ? Math.round(baseFontSize * style.fontScale) : baseFontSize;
  const baseY = position === "top" ? canvasHeight * 0.18 : position === "bottom" ? canvasHeight * 0.82 : canvasHeight * 0.5;

  let textColor: string;
  let shadowColor: string;
  let boxColor: string | null;

  if (style) {
    // Los colores del pack ya están pensados para contraste — sin caja detrás del texto.
    textColor = style.darkOverlay ? "#ffffff" : style.textColor;
    shadowColor = style.darkOverlay ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.25)";
    boxColor = null;
  } else {
    // Retrocompatible: comportamiento de siempre, color por brillo del fondo bajo el texto.
    const brightness = sampleAverageBrightness(ctx, canvasWidth / 2, baseY, 200, 80);
    const isLightBackground = brightness > 128;
    textColor = isLightBackground ? "#000000" : "#ffffff";
    shadowColor = isLightBackground ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)";
    boxColor = isLightBackground ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.35)";
  }

  ctx.save();
  ctx.font = `${style?.fontWeight ?? CAROUSEL_TEXT_STYLE.weight} ${fontSize}px ${style?.fontFamily ?? CAROUSEL_TEXT_STYLE.family}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = shadowColor;
  ctx.shadowBlur = 28;

  const lines = wrapText(ctx, text, canvasWidth * 0.85);
  if (lines.length === 0) {
    ctx.restore();
    return;
  }
  const lineHeight = fontSize * 1.15;
  const startY = baseY - ((lines.length - 1) * lineHeight) / 2;

  if (boxColor) {
    // Fondo semitransparente real detrás del texto — solo en el modo sin estilo (retrocompatible).
    const maxLineWidth = Math.max(...lines.map((line) => ctx.measureText(line).width));
    const boxPaddingX = 32;
    const boxPaddingY = 20;
    ctx.shadowBlur = 0;
    ctx.fillStyle = boxColor;
    ctx.fillRect(
      canvasWidth / 2 - maxLineWidth / 2 - boxPaddingX,
      startY - lineHeight / 2 - boxPaddingY,
      maxLineWidth + boxPaddingX * 2,
      lines.length * lineHeight + boxPaddingY * 2,
    );
    ctx.shadowBlur = 28;
  }

  drawTextLines(ctx, lines, startY, lineHeight, canvasWidth, textColor, !!style?.highlightLastWord, style?.accentColor);

  ctx.restore();
}

const CAROUSEL_ROLE_TO_TEXT_ROLE: Record<CarouselSlideRole, ReelsTextRole> = {
  intro: "title",
  desarrollo: "subtitle",
  cierre_cta: "cta",
};

export type StaticSlideInput = {
  imageUrl?: string;          // URL pública HTTPS de la foto subida — opcional en modo "Crear con IA" (requiere `style` para el fondo generado)
  text: string;               // ya clampeado por CarouselComposerAgent — este renderer no vuelve a recortar
  role: CarouselSlideRole;
  width?: number;              // default 1080 — 4:5 es el ratio recomendado de Meta para carrusel/feed
  height?: number;             // default 1350, a diferencia de 1920 (9:16) que usa Reels
  style?: CarouselStyleVariant;  // opcional — sin él, estilo fijo de siempre (retrocompatible). Ver CarouselStylePacks.getStyleForCarousel.
  handle?: string;                // "@usuario" — si se pasa, se dibuja SIEMPRE (esquina inferior izquierda)
};

export class StaticSlideRenderer {
  async render(input: StaticSlideInput): Promise<Blob> {
    assertBrowserEnvironment();
    const width = input.width ?? 1080;
    const height = input.height ?? 1350;

    const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(width, height) : document.createElement("canvas");
    if (!(canvas instanceof OffscreenCanvas)) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
    if (!ctx) {
      throw new StaticSlideRenderError("No se pudo obtener el contexto 2D del canvas.", "STATIC_SLIDE_CANVAS_CONTEXT_UNAVAILABLE");
    }

    if (input.imageUrl) {
      if (!input.imageUrl.startsWith("http")) {
        throw new StaticSlideRenderError("Se requiere una URL pública HTTPS de la imagen.", "STATIC_SLIDE_MEDIA_REQUIRED");
      }
      const image = await loadImageBitmap(input.imageUrl);
      drawImageCoverStatic(ctx, image, width, height);
      if (input.style?.darkOverlay) applyDarkOverlay(ctx, width, height);
    } else if (input.style) {
      drawStyleBackground(ctx, input.style, width, height);
      if (input.style.darkOverlay) applyDarkOverlay(ctx, width, height);
    } else {
      throw new StaticSlideRenderError(
        "Se requiere imageUrl (modo Subir imágenes) o style (modo Crear con IA, fondo generado).",
        "STATIC_SLIDE_BACKGROUND_REQUIRED",
      );
    }

    drawStaticSlideText(ctx, input.text, CAROUSEL_ROLE_TO_TEXT_ROLE[input.role], width, height, input.style);
    if (input.handle) drawHandle(ctx, input.handle, width, height);

    if (canvas instanceof OffscreenCanvas) {
      return canvas.convertToBlob({ type: "image/jpeg", quality: 0.92 });
    }
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new StaticSlideRenderError("No se pudo exportar el canvas a imagen.", "STATIC_SLIDE_EXPORT_FAILED"))),
        "image/jpeg",
        0.92,
      );
    });
  }
}
