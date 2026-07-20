import type { CarouselSlideRole } from "@/lib/socialflow/ai/agents/CarouselComposerAgent";
import type { ReelsTextRole } from "@/lib/socialflow/reels/ReelsEngine";
import { TEXT_ROLE_STYLE, sampleAverageBrightness } from "@/lib/socialflow/reels/CanvasRenderer";

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

// drawTextOverlays de CanvasRenderer.ts, sin el bloque de animación de entrada por rol
// (opacity/offsetY/scale calculados desde `t`) ni textForOverlayAtTime (word-by-word) —
// aquí siempre se dibuja el texto completo, ya asentado, una sola vez.
function drawStaticSlideText(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  text: string,
  role: ReelsTextRole,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const { fontSize, position } = TEXT_ROLE_STYLE[role];
  const baseY = position === "top" ? canvasHeight * 0.18 : position === "bottom" ? canvasHeight * 0.82 : canvasHeight * 0.5;

  const brightness = sampleAverageBrightness(ctx, canvasWidth / 2, baseY, 200, 80);
  const isLightBackground = brightness > 128;
  const textColor = isLightBackground ? "#000000" : "#ffffff";
  const shadowColor = isLightBackground ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)";
  const boxColor = isLightBackground ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.35)";

  ctx.save();
  ctx.font = `${CAROUSEL_TEXT_STYLE.weight} ${fontSize}px ${CAROUSEL_TEXT_STYLE.family}`;
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

  lines.forEach((line, i) => {
    const y = startY + i * lineHeight;
    ctx.fillStyle = textColor;
    ctx.fillText(line, canvasWidth / 2, y);
  });

  ctx.restore();
}

const CAROUSEL_ROLE_TO_TEXT_ROLE: Record<CarouselSlideRole, ReelsTextRole> = {
  intro: "title",
  desarrollo: "subtitle",
  cierre_cta: "cta",
};

export type StaticSlideInput = {
  imageUrl: string;          // URL pública HTTPS de la foto subida
  text: string;               // ya clampeado por CarouselComposerAgent — este renderer no vuelve a recortar
  role: CarouselSlideRole;
  width?: number;              // default 1080 — 4:5 es el ratio recomendado de Meta para carrusel/feed
  height?: number;             // default 1350, a diferencia de 1920 (9:16) que usa Reels
};

export class StaticSlideRenderer {
  async render(input: StaticSlideInput): Promise<Blob> {
    assertBrowserEnvironment();
    const width = input.width ?? 1080;
    const height = input.height ?? 1350;

    if (!input.imageUrl.startsWith("http")) {
      throw new StaticSlideRenderError("Se requiere una URL pública HTTPS de la imagen.", "STATIC_SLIDE_MEDIA_REQUIRED");
    }

    const image = await loadImageBitmap(input.imageUrl);

    const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(width, height) : document.createElement("canvas");
    if (!(canvas instanceof OffscreenCanvas)) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
    if (!ctx) {
      throw new StaticSlideRenderError("No se pudo obtener el contexto 2D del canvas.", "STATIC_SLIDE_CANVAS_CONTEXT_UNAVAILABLE");
    }

    drawImageCoverStatic(ctx, image, width, height);
    drawStaticSlideText(ctx, input.text, CAROUSEL_ROLE_TO_TEXT_ROLE[input.role], width, height);

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
