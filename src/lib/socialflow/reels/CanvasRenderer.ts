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
  title: { fontSize: 120, position: "top" },
  subtitle: { fontSize: 72, position: "center" },
  cta: { fontSize: 56, position: "bottom" },
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

type FrameTransform = { scale: number; translateX: number; translateY: number; rotateDeg: number; blurPx: number };

// Combina todos los efectos activos en el instante t en una única transformación.
// zoom es multiplicativo (varios zooms se acumulan), pan/rotate/blur son aditivos.
function computeTransformAtTime(effects: ReelsEffect[], t: number, width: number): FrameTransform {
  const transform: FrameTransform = { scale: 1, translateX: 0, translateY: 0, rotateDeg: 0, blurPx: 0 };

  for (const effect of effects) {
    if (t < effect.startAt || t > effect.endAt) continue;
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

// Detecta si el fondo bajo el texto es claro u oscuro muestreando un área ~200x80px
// centrada en (centerX, centerY), para elegir texto negro/sombra blanca o texto
// blanco/sombra negra. Se recalcula cada frame porque los efectos mueven la imagen
// bajo el texto, así que lo que hay debajo puede cambiar de brillo con el tiempo.
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

    let opacity = 1;
    let offsetY = 0;
    let scale = 1;

    if (overlay.role) {
      // Animación de entrada por rol, primeros 0.5s de vida del overlay (lineal, no eased).
      const roleIntroProgress = Math.min(1, (t - overlay.startAt) / 0.5);
      opacity = roleIntroProgress;
      if (overlay.role === "title") {
        offsetY = -50 * (1 - roleIntroProgress); // slide-down: entra desde arriba
      } else if (overlay.role === "cta") {
        offsetY = 50 * (1 - roleIntroProgress); // slide-up: entra desde abajo
      } else if (overlay.role === "subtitle") {
        scale = 0.85 + 0.15 * roleIntroProgress; // zoom-in: 0.85 → 1.0
      }
    } else {
      const introProgress = easedProgress(t, overlay.startAt, overlay.startAt + Math.min(0.4, overlay.durationSec / 2));
      if (overlay.animation === "fade-in") {
        opacity = introProgress;
      } else if (overlay.animation === "slide-up") {
        opacity = introProgress;
        offsetY = (1 - introProgress) * 40;
      }
    }

    const roleStyle = overlay.role ? TEXT_ROLE_STYLE[overlay.role] : undefined;
    const fontSize = roleStyle?.fontSize ?? templateStyle.fallbackFontSize;
    const position = overlay.position ?? roleStyle?.position ?? "center";
    const baseY = position === "top" ? canvasHeight * 0.18 : position === "bottom" ? canvasHeight * 0.82 : canvasHeight * 0.5;

    const brightness = sampleAverageBrightness(ctx, canvasWidth / 2, baseY, 200, 80);
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

    const text = textForOverlayAtTime(overlay, t);
    const lines = wrapText(ctx, text, canvasWidth * 0.85);
    if (lines.length === 0) {
      ctx.restore();
      continue;
    }
    const lineHeight = fontSize * 1.15;
    const startY = baseY - ((lines.length - 1) * lineHeight) / 2 + offsetY;

    // Fondo semitransparente real detrás del texto (antes se asignaba fillStyle pero se
    // sobreescribía sin dibujarse nunca) — sin sombra propia, para no verse "difuminado".
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

    const [image, audioBuffer] = await Promise.all([
      loadImageBitmap(config.imageUrl),
      musicTrackUrl ? prepareAudioTrack(musicTrackUrl) : Promise.resolve(null),
    ]);

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
