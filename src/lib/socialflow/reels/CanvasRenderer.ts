import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import type { ReelsConfig, ReelsEffect, ReelsProgressCallback, ReelsRenderer, ReelsTemplate, ReelsTextOverlay } from "./ReelsEngine";

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

const TEMPLATE_STYLES: Record<ReelsTemplate, { font: string; color: string; accent: string }> = {
  fitness: { font: "900 64px system-ui, sans-serif", color: "#ffffff", accent: "#22d3ee" },
  lifestyle: { font: "600 58px system-ui, sans-serif", color: "#ffffff", accent: "#f0abfc" },
  motivation: { font: "800 68px system-ui, sans-serif", color: "#ffffff", accent: "#fbbf24" },
  education: { font: "700 56px system-ui, sans-serif", color: "#ffffff", accent: "#60a5fa" },
  marketing: { font: "800 60px system-ui, sans-serif", color: "#ffffff", accent: "#34d399" },
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

type FrameTransform = { scale: number; translateX: number; translateY: number; rotateDeg: number; blurPx: number };

// Combina todos los efectos activos en el instante t en una única transformación.
// zoom es multiplicativo (varios zooms se acumulan), pan/rotate/blur son aditivos.
function computeTransformAtTime(effects: ReelsEffect[], t: number, width: number): FrameTransform {
  const transform: FrameTransform = { scale: 1, translateX: 0, translateY: 0, rotateDeg: 0, blurPx: 0 };

  for (const effect of effects) {
    if (t < effect.startAt || t > effect.endAt) continue;
    const progress = easedProgress(t, effect.startAt, effect.endAt);
    const intensity = effect.intensity ?? 0.15;

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
    }
  }

  return transform;
}

// Dibuja la imagen ya cargada rellenando el canvas ("cover"), con un 12% de margen
// extra para que zoom/pan/parallax tengan recorrido sin dejar ver los bordes.
function drawImageCover(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  image: ImageBitmap,
  canvasWidth: number,
  canvasHeight: number,
  transform: FrameTransform,
): void {
  const coverScale = Math.max(canvasWidth / image.width, canvasHeight / image.height) * 1.12;
  const drawWidth = image.width * coverScale * transform.scale;
  const drawHeight = image.height * coverScale * transform.scale;

  ctx.save();
  ctx.filter = transform.blurPx > 0.5 ? `blur(${transform.blurPx.toFixed(1)}px)` : "none";
  ctx.translate(canvasWidth / 2 + transform.translateX, canvasHeight / 2 + transform.translateY);
  ctx.rotate((transform.rotateDeg * Math.PI) / 180);
  ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
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

function textForOverlayAtTime(overlay: ReelsTextOverlay, t: number): string {
  if (overlay.animation !== "word-by-word") return overlay.text;
  const words = overlay.text.split(/\s+/).filter(Boolean);
  const progress = clamp((t - overlay.startAt) / overlay.durationSec, 0, 1);
  const revealCount = Math.max(1, Math.ceil(words.length * progress));
  return words.slice(0, revealCount).join(" ");
}

function drawTextOverlays(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  overlays: ReelsTextOverlay[],
  template: ReelsTemplate,
  t: number,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const style = TEMPLATE_STYLES[template];

  for (const overlay of overlays) {
    const endAt = overlay.startAt + overlay.durationSec;
    if (t < overlay.startAt || t > endAt) continue;

    const introProgress = easedProgress(t, overlay.startAt, overlay.startAt + Math.min(0.4, overlay.durationSec / 2));
    let opacity = 1;
    let offsetY = 0;

    if (overlay.animation === "fade-in") {
      opacity = introProgress;
    } else if (overlay.animation === "slide-up") {
      opacity = introProgress;
      offsetY = (1 - introProgress) * 40;
    }

    const baseY =
      overlay.position === "top" ? canvasHeight * 0.18 : overlay.position === "bottom" ? canvasHeight * 0.82 : canvasHeight * 0.5;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.font = style.font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 18;

    const text = textForOverlayAtTime(overlay, t);
    const lines = wrapText(ctx, text, canvasWidth * 0.85);
    const lineHeight = 76;
    const startY = baseY - ((lines.length - 1) * lineHeight) / 2 + offsetY;

    lines.forEach((line, i) => {
      const y = startY + i * lineHeight;
      ctx.fillStyle = style.color;
      ctx.fillText(line, canvasWidth / 2, y);
    });

    ctx.restore();
  }
}

async function loadImageBitmap(imageUrl: string): Promise<ImageBitmap> {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new ReelsRenderError(`No se pudo cargar la imagen origen (${res.status}).`, "REELS_IMAGE_FETCH_FAILED");
  }
  const blob = await res.blob();
  return createImageBitmap(blob);
}

// H.264 High Profile Level 4.0 — soportado por todos los navegadores con WebCodecs.
const H264_CODEC = "avc1.640028";

export class CanvasRenderer implements ReelsRenderer {
  async render(config: ReelsConfig, onProgress?: ReelsProgressCallback): Promise<Blob> {
    assertBrowserEnvironment();

    const { width, height, fps, durationSec } = config;
    const image = await loadImageBitmap(config.imageUrl);

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

    for (let i = 0; i < totalFrames; i++) {
      const t = i / fps;
      const transform = computeTransformAtTime(config.effects, t, width);

      ctx.clearRect(0, 0, width, height);
      drawImageCover(ctx, image, width, height, transform);
      drawTextOverlays(ctx, config.textOverlays, config.template, t, width, height);

      const frame = new VideoFrame(canvas as CanvasImageSource, {
        timestamp: i * frameDurationUs,
        duration: frameDurationUs,
      });
      encoder.encode(frame, { keyFrame: i % keyFrameInterval === 0 });
      frame.close();
      onProgress?.((i + 1) / totalFrames);
    }

    await encoder.flush();
    encoder.close();
    muxer.finalize();

    const { buffer } = muxer.target as ArrayBufferTarget;
    return new Blob([buffer], { type: "video/mp4" });
  }
}
