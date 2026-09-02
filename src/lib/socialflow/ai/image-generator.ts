import { env } from "@/lib/cf";

const MODEL = "@cf/stabilityai/stable-diffusion-xl-base-1.0";
const R2_PUBLIC_BASE = "https://pub-04c730a67921499bac35a1f62402cc17.r2.dev";

// SDXL (Workers AI) acepta negative_prompt de forma nativa — evita las anomalías de
// anatomía más comunes (manos/extremidades) en las imágenes generadas para posts.
const NEGATIVE_PROMPT =
  "deformed, extra limbs, twisted joints, bad anatomy, mutated hands, extra fingers, missing fingers, fused fingers, too many fingers, malformed limbs, missing arms, missing legs, extra arms, extra legs, mutated, ugly, blurry, low quality, watermark, text";

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

export async function generatePostImage(prompt: string, postId: string): Promise<string | null> {
  const e = env();
  if (!e?.AI || !e?.SOCIAL_MEDIA_BUCKET) {
    console.warn("IMAGE_GEN_SKIPPED: AI or SOCIAL_MEDIA_BUCKET binding not available");
    return null;
  }

  try {
    const response = await e.AI.run(MODEL, {
      prompt,
      negative_prompt: NEGATIVE_PROMPT,
      num_steps: 20,
      width: 1024,
      height: 1024,
    });

    let imageBuffer: ArrayBuffer;
    if (response instanceof ReadableStream) {
      imageBuffer = await readStream(response as ReadableStream<Uint8Array>);
    } else if (response instanceof ArrayBuffer) {
      imageBuffer = response;
    } else if (response instanceof Uint8Array) {
      imageBuffer = (response as Uint8Array).buffer as ArrayBuffer;
    } else {
      console.error("IMAGE_GEN_UNEXPECTED_RESPONSE_TYPE", { postId });
      return null;
    }

    const key = `posts/${postId}/ai-image.png`;
    await e.SOCIAL_MEDIA_BUCKET.put(key, imageBuffer, {
      httpMetadata: { contentType: "image/png" },
    });

    const publicUrl = `${R2_PUBLIC_BASE}/${key}`;
    console.log("IMAGE_GEN_OK", { postId, key, bytes: imageBuffer.byteLength });
    return publicUrl;
  } catch (err) {
    console.error("IMAGE_GEN_FAILED", {
      postId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
