import { PhotonImage, draw_text_with_border } from "@cf-wasm/photon/workerd";
import type { DracoEnv } from "../../../src/lib/cf";

// @cf-wasm/photon SOLO puede vivir aquí — es un import WASM directo que el bundler de
// Wrangler/esbuild de este worker resuelve bien, pero el build de la app principal
// (OpenNext + webpack) NO. Ver auditoría: importarlo desde src/lib/socialflow/ai/
// image-generator.ts (compartido, alcanzable desde 9 rutas de la app principal vía
// SocialFlowOrchestrator.ts) rompió el build completo de producción. Este archivo vive
// fuera de src/ a propósito, para que nada del árbol de imports de Next.js pueda
// alcanzarlo nunca.

const WATERMARK_TEXT = "Hecho con Socialcors";
const WATERMARK_FONT_SIZE = 32;
const WATERMARK_MARGIN = 24;

interface CampaignPostRow {
  id: string;
  image_hint: string | null;
}

function extractR2Key(imageHint: string): string | null {
  // generatePostImage sube a `posts/${postId}/ai-image.png` bajo R2_PUBLIC_BASE — el
  // resto de imageHint (fotos subidas por el cliente, URLs externas) no pasa por este
  // pipeline y se ignora explícitamente, nunca se intenta re-descargar/re-subir algo
  // que no controlamos.
  const match = imageHint.match(/\/posts\/[^/]+\/ai-image\.png$/);
  return match ? match[0].slice(1) : null;
}

// Nunca lanza — un fallo de watermarking (WASM, memoria, imagen ya borrada) nunca debe
// tumbar el procesamiento del resto de la cola. free() en un finally: PhotonImage vive
// en memoria WASM, no en el heap de JS — sin esto se filtra en cada llamada.
async function watermarkOneImage(bucket: R2Bucket, key: string, postId: string): Promise<void> {
  let photonImg: PhotonImage | null = null;
  try {
    const object = await bucket.get(key);
    if (!object) {
      console.warn(`[ImageWatermark] R2 object not found for ${key} (post ${postId})`);
      return;
    }
    const bytes = new Uint8Array(await object.arrayBuffer());
    photonImg = PhotonImage.new_from_byteslice(bytes);
    const y = photonImg.get_height() - WATERMARK_FONT_SIZE - WATERMARK_MARGIN;
    draw_text_with_border(photonImg, WATERMARK_TEXT, WATERMARK_MARGIN, y, WATERMARK_FONT_SIZE);
    const watermarked = photonImg.get_bytes();
    await bucket.put(key, watermarked, { httpMetadata: { contentType: "image/png" } });
    console.log(`[ImageWatermark] Applied trial watermark to ${key}`);
  } catch (err) {
    console.error(`[ImageWatermark] Failed for ${key} (post ${postId})`, err instanceof Error ? err.message : String(err));
  } finally {
    photonImg?.free();
  }
}

// Se llama DESPUÉS de que generateFullCampaign termine — recorre los posts reales que
// quedaron persistidos para esta campaña (no los que se intentaron generar, algunos
// pueden haber fallado silenciosamente en persistToDb) y marca solo los que
// efectivamente tienen una imagen IA generada por este pipeline (no fotos subidas a
// mano ni carruseles, que nunca llegan a este worker vía type:"campaign").
export async function watermarkCampaignImages(env: DracoEnv, campaignId: string): Promise<void> {
  const db = env.SOCIAL_DB;
  const bucket = env.SOCIAL_MEDIA_BUCKET;
  if (!db || !bucket) return;

  const { results } = await db
    .prepare(`SELECT id, image_hint FROM saas_social_posts WHERE campaign_id = ?`)
    .bind(campaignId)
    .all<CampaignPostRow>();

  for (const row of results ?? []) {
    if (!row.image_hint) continue;
    const key = extractR2Key(row.image_hint);
    if (!key) continue;
    await watermarkOneImage(bucket, key, row.id);
  }
}
