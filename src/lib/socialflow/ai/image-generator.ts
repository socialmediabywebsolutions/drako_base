import { env } from "@/lib/cf";
import { getPhysicalProfile } from "@/lib/socialflow/profile/physical-repository";

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

function describePhysicalProfile(profile: Awaited<ReturnType<typeof getPhysicalProfile>>): string | null {
  if (!profile) return null;
  const parts: string[] = [];
  if (profile.bodyType) parts.push(`complexión ${profile.bodyType}`);
  if (profile.heightCm) parts.push(`${profile.heightCm}cm`);
  if (profile.hairLength || profile.hairColor) {
    parts.push(`cabello ${[profile.hairLength, profile.hairColor].filter(Boolean).join(" ")}`);
  }
  if (profile.fitnessStyle) parts.push(`estilo fitness ${profile.fitnessStyle}`);
  if (!parts.length) return null;
  return `Mujer de ${parts.join(", ")}`;
}

export async function generatePostImage(prompt: string, postId: string, tenantId?: string | null): Promise<string | null> {
  const e = env();
  if (!e?.AI || !e?.SOCIAL_MEDIA_BUCKET) {
    console.warn("IMAGE_GEN_SKIPPED: AI or SOCIAL_MEDIA_BUCKET binding not available");
    return null;
  }

  const physicalProfile = tenantId ? await getPhysicalProfile(tenantId).catch(() => null) : null;
  const physicalDescription = describePhysicalProfile(physicalProfile);
  const finalPrompt = physicalDescription ? `${prompt}, ${physicalDescription}` : prompt;

  let referenceImage: number[] | null = null;
  if (physicalProfile?.referenceImageUrl) {
    try {
      const refResponse = await fetch(physicalProfile.referenceImageUrl);
      if (refResponse.ok) {
        const refBuffer = await refResponse.arrayBuffer();
        referenceImage = Array.from(new Uint8Array(refBuffer));
      }
    } catch (err) {
      console.warn("IMAGE_GEN_REFERENCE_IMAGE_FETCH_FAILED", { postId, error: err instanceof Error ? err.message : String(err) });
    }
  }

  try {
    const response = await e.AI.run(MODEL, {
      prompt: finalPrompt,
      negative_prompt: NEGATIVE_PROMPT,
      num_steps: 20,
      width: 1024,
      height: 1024,
      ...(referenceImage ? { image: referenceImage, strength: 0.35 } : {}),
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
