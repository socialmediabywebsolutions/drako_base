import { env } from "@/lib/cf";

// SDXL base — mismo modelo que usa Socialcors para posts.
// Resolucion 512x512 (más rápido y suficiente para diagramas educativos).
const MODEL = "@cf/stabilityai/stable-diffusion-xl-base-1.0";
const R2_PUBLIC_BASE = "https://pub-04c730a67921499bac35a1f62402cc17.r2.dev";
const DIAGRAM_WIDTH = 512;
const DIAGRAM_HEIGHT = 512;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

// Evita anatomía, personas y elementos innecesarios en diagramas educativos
const NEGATIVE_PROMPT =
  "people, person, face, hands, body, realistic photo, photorealistic, text, watermark, "
  + "blurry, low quality, distorted, ugly, noise, dark background, complex background, "
  + "cluttered, confusing, decorative border";

// Prefijo de prompt que asegura un estilo de diagrama limpio estilo pizarra
const STYLE_PREFIX =
  "clean educational whiteboard diagram, minimalist scientific illustration, "
  + "clear labeled diagram, white background, simple line drawing, educational textbook style, "
  + "high contrast black lines on white, no shading";

export type MentoriaDiagramRequest = {
  subject: string; // e.g. "chemistry", "geometry", "physics"
  topic: string;   // e.g. "Pitagoras", "celula animal", "Newton primera ley"
  concept: string; // brief description: "triangulo rectangulo con catetos a, b e hipotenusa c"
  sessionId?: string;
};

export type MentoriaDiagramResult = {
  url: string | null;
  skipped: boolean;
  reason?: string;
};

function buildDiagramPrompt(req: MentoriaDiagramRequest): string {
  const subjectHint = buildSubjectHint(req.subject);
  return [
    STYLE_PREFIX,
    subjectHint,
    `topic: ${req.topic}`,
    `showing: ${req.concept}`,
  ].filter(Boolean).join(", ");
}

function buildSubjectHint(subject: string): string {
  const s = subject.toLowerCase();
  if (s.includes("geometr") || s.includes("matem")) return "geometry diagram, mathematical figure";
  if (s.includes("quim") || s.includes("chem")) return "chemistry diagram, molecular structure or reaction";
  if (s.includes("fis") || s.includes("physic")) return "physics diagram, force arrows and labels";
  if (s.includes("bio")) return "biology diagram, cell or organism illustration";
  if (s.includes("hist") || s.includes("geograf")) return "timeline or map diagram";
  return "educational diagram";
}

async function readStream(stream: ReadableStream<Uint8Array>): Promise<ArrayBuffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged.buffer as ArrayBuffer;
}

export async function generateMentoriaDiagram(
  req: MentoriaDiagramRequest,
): Promise<MentoriaDiagramResult> {
  const e = env();

  if (!e?.AI) {
    console.warn("MENTORIA_DIAGRAM_SKIPPED: AI binding not available");
    return { url: null, skipped: true, reason: "AI_BINDING_MISSING" };
  }

  if (!e?.MENTORIA_BUCKET) {
    console.warn("MENTORIA_DIAGRAM_SKIPPED: MENTORIA_BUCKET binding not available");
    return { url: null, skipped: true, reason: "BUCKET_BINDING_MISSING" };
  }

  const prompt = buildDiagramPrompt(req);
  const ai = e.AI;

  const runModel = async (): Promise<ArrayBuffer> => {
    const response = await (ai.run as (m: string, i: Record<string, unknown>) => Promise<unknown>)
      .call(ai, MODEL, {
        prompt,
        negative_prompt: NEGATIVE_PROMPT,
        num_steps: 20,
        width: DIAGRAM_WIDTH,
        height: DIAGRAM_HEIGHT,
      });
    if (response instanceof ReadableStream) return readStream(response as ReadableStream<Uint8Array>);
    if (response instanceof ArrayBuffer) return response;
    if (response instanceof Uint8Array) return response.buffer as ArrayBuffer;
    throw new Error(`MENTORIA_DIAGRAM_UNEXPECTED_RESPONSE_TYPE`);
  };

  let imageBuffer: ArrayBuffer | null = null;
  for (let attempt = 1; !imageBuffer; attempt++) {
    try {
      imageBuffer = await runModel();
    } catch (err) {
      if (attempt > MAX_RETRIES) {
        console.error("MENTORIA_DIAGRAM_FAILED", {
          topic: req.topic,
          error: err instanceof Error ? err.message : String(err),
        });
        return { url: null, skipped: false, reason: "AI_GENERATION_FAILED" };
      }
      console.warn("MENTORIA_DIAGRAM_RETRY", {
        topic: req.topic,
        attempt,
        error: err instanceof Error ? err.message : String(err),
      });
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  const timestamp = Date.now();
  const sessionPart = req.sessionId ?? "nosession";
  const key = `mentoria/diagrams/${sessionPart}/${timestamp}.png`;

  try {
    await e.MENTORIA_BUCKET.put(key, imageBuffer, {
      httpMetadata: { contentType: "image/png" },
    });
  } catch (err) {
    console.error("MENTORIA_DIAGRAM_UPLOAD_FAILED", {
      key,
      error: err instanceof Error ? err.message : String(err),
    });
    return { url: null, skipped: false, reason: "UPLOAD_FAILED" };
  }

  const url = `${R2_PUBLIC_BASE}/${key}`;
  console.log("MENTORIA_DIAGRAM_OK", { key, topic: req.topic, bytes: imageBuffer.byteLength });
  return { url, skipped: false };
}
