// Capa 1 — contrato abstracto del Reels Engine. No sabe ni le importa cómo se
// renderiza el vídeo (Canvas+WebCodecs en el navegador hoy — ver CanvasRenderer.ts —,
// un servicio headless mañana): solo valida el ReelsConfig y delega en el ReelsRenderer
// inyectado. Capa 3 (ReelsAgent) es quien decide el contenido de ese ReelsConfig.

export type ReelsTemplate = "fitness" | "lifestyle" | "motivation" | "education" | "marketing";

export type ReelsEffectKind =
  | "zoom-in"
  | "zoom-out"
  | "pan-left"
  | "pan-right"
  | "parallax"
  | "rotate"
  | "blur";

export type ReelsEffect = {
  kind: ReelsEffectKind;
  /** Segundos desde el inicio del clip en los que el efecto empieza a aplicarse. */
  startAt: number;
  /** Segundos desde el inicio del clip en los que el efecto termina de aplicarse. */
  endAt: number;
  /** 0-1. Significado específico por efecto (cantidad de zoom, distancia de pan, px de blur, grados de rotación). */
  intensity?: number;
};

export type ReelsTextAnimationKind = "fade-in" | "slide-up" | "word-by-word";

export type ReelsTextOverlay = {
  text: string;
  animation: ReelsTextAnimationKind;
  startAt: number;
  durationSec: number;
  position?: "top" | "center" | "bottom";
};

export type ReelsConfig = {
  /** URL pública HTTPS de la imagen origen (misma que ya sube CampaignPhotoUpload/UploadToPost a R2). */
  imageUrl: string;
  template: ReelsTemplate;
  effects: ReelsEffect[];
  textOverlays: ReelsTextOverlay[];
  durationSec: number;
  fps: number;
  width: number;
  height: number;
};

// Formato exigido por Instagram Reels: 9:16, H.264, 15-30fps, 3-90s (acotamos a 15-30s
// para que el Reels Engine siempre produzca clips "cortos" independientemente del nicho).
export const REELS_DEFAULTS = {
  width: 1080,
  height: 1920,
  fps: 30,
  minDurationSec: 15,
  maxDurationSec: 30,
  minFps: 15,
  maxFps: 30,
} as const;

export class ReelsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReelsConfigError";
  }
}

function validateReelsConfig(config: ReelsConfig): void {
  if (!config.imageUrl.startsWith("http")) {
    throw new ReelsConfigError("imageUrl must be a public HTTPS URL.");
  }
  if (config.durationSec < REELS_DEFAULTS.minDurationSec || config.durationSec > REELS_DEFAULTS.maxDurationSec) {
    throw new ReelsConfigError(
      `durationSec must be between ${REELS_DEFAULTS.minDurationSec} and ${REELS_DEFAULTS.maxDurationSec}, got ${config.durationSec}.`,
    );
  }
  if (config.fps < REELS_DEFAULTS.minFps || config.fps > REELS_DEFAULTS.maxFps) {
    throw new ReelsConfigError(`fps must be between ${REELS_DEFAULTS.minFps} and ${REELS_DEFAULTS.maxFps}, got ${config.fps}.`);
  }
  if (config.width <= 0 || config.height <= 0) {
    throw new ReelsConfigError("width and height must be positive.");
  }
  if (config.effects.some((e) => e.endAt < e.startAt)) {
    throw new ReelsConfigError("Every effect's endAt must be >= startAt.");
  }
  if (config.textOverlays.some((t) => t.durationSec <= 0)) {
    throw new ReelsConfigError("Every textOverlay's durationSec must be > 0.");
  }
}

export interface ReelsRenderer {
  render(config: ReelsConfig): Promise<Blob>;
}

export class ReelsEngine {
  constructor(private readonly renderer: ReelsRenderer) {}

  async generate(config: ReelsConfig): Promise<Blob> {
    validateReelsConfig(config);
    return this.renderer.render(config);
  }
}
