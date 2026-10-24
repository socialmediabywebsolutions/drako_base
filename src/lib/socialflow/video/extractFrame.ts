// Extracts a single JPEG frame from a client-uploaded video file. Uses <video> +
// <canvas> — both browser-only APIs, same constraint as CanvasRenderer.ts (no video
// decoding exists in the Cloudflare Workers runtime where this app's API routes run),
// so this can only be called from a client component.

const FRAME_TIMESTAMP_RATIO = 0.25; // 25% into the video — see Fase 1 design
const JPEG_QUALITY = 0.9;

function waitForVideoEvent(
  video: HTMLVideoElement,
  eventName: "loadedmetadata" | "seeked",
  errorMessage: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    function onEvent() {
      cleanup();
      resolve();
    }
    function onError() {
      cleanup();
      reject(new Error(errorMessage));
    }
    function cleanup() {
      video.removeEventListener(eventName, onEvent);
      video.removeEventListener("error", onError);
    }
    video.addEventListener(eventName, onEvent, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

export async function extractVideoFrame(file: File): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");

  try {
    // display:none (rather than never attaching to the DOM) is the more reliable option
    // across browsers — some engines (notably Safari) delay or skip metadata/seek events
    // for detached <video> elements.
    video.style.display = "none";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = objectUrl;
    document.body.appendChild(video);

    await waitForVideoEvent(video, "loadedmetadata", "No se pudo cargar el vídeo.");

    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error("El vídeo no tiene una duración válida.");
    }

    video.currentTime = duration * FRAME_TIMESTAMP_RATIO;
    await waitForVideoEvent(video, "seeked", "No se pudo posicionar el vídeo en el frame indicado.");

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("No se pudo obtener el contexto 2D del canvas.");
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), "image/jpeg", JPEG_QUALITY);
    });
    if (!blob) {
      throw new Error("No se pudo generar la imagen del frame.");
    }

    return blob;
  } finally {
    video.remove();
    URL.revokeObjectURL(objectUrl);
  }
}
