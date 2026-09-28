import { PhotonImage, SamplingFilter, resize, watermark } from "@cf-wasm/photon/workerd";
import type { DracoEnv } from "../../../src/lib/cf";

// Mismo motivo que image-watermark.ts: @cf-wasm/photon solo puede importarse desde
// código exclusivo de este worker, nunca desde src/ (rompe el build de OpenNext).
// Por eso el logo se superpone como post-proceso de la campaña y no dentro de
// generatePostImage.

const R2_PUBLIC_BASE = "https://pub-04c730a67921499bac35a1f62402cc17.r2.dev";

// Logos en socialflow-media/logos/ — solo los tenants internos por ahora.
const TENANT_LOGO_KEYS: Record<string, string> = {
  "775444ce-5ed0-4e69-864f-dc3e0d886817": "logos/logo social cors perfil.png", // socialcors
  "6816c820-d483-4146-bada-b86cfdc49453": "logos/logo drako.png", // drako.systems
};

const LOGO_WIDTH_RATIO = 0.15;
const LOGO_MARGIN = 20;

interface CampaignPostRow {
  id: string;
  image_hint: string | null;
}

function extractR2Key(imageHint: string): string | null {
  // Solo imágenes IA de generatePostImage (`posts/${postId}/ai-image.png`) — nunca
  // fotos subidas por el cliente ni URLs externas.
  const match = imageHint.match(/\/posts\/[^/]+\/ai-image\.png$/);
  return match ? match[0].slice(1) : null;
}

async function fetchLogoBytes(logoKey: string): Promise<Uint8Array | null> {
  const url = `${R2_PUBLIC_BASE}/${logoKey.split("/").map(encodeURIComponent).join("/")}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[ImageLogo] Logo fetch failed ${response.status} for ${url}`);
      return null;
    }
    return new Uint8Array(await response.arrayBuffer());
  } catch (err) {
    console.warn(`[ImageLogo] Logo fetch error for ${url}`, err instanceof Error ? err.message : String(err));
    return null;
  }
}

// Nunca lanza — un fallo (WASM, memoria, imagen borrada) deja la imagen original
// intacta. free() en finally: PhotonImage vive en memoria WASM, no en el heap de JS.
async function overlayLogoOnImage(bucket: R2Bucket, key: string, postId: string, logoBytes: Uint8Array): Promise<void> {
  let image: PhotonImage | null = null;
  let logo: PhotonImage | null = null;
  let scaledLogo: PhotonImage | null = null;
  try {
    const object = await bucket.get(key);
    if (!object) {
      console.warn(`[ImageLogo] R2 object not found for ${key} (post ${postId})`);
      return;
    }
    image = PhotonImage.new_from_byteslice(new Uint8Array(await object.arrayBuffer()));
    logo = PhotonImage.new_from_byteslice(logoBytes);

    const imageWidth = image.get_width();
    const imageHeight = image.get_height();
    const logoWidth = Math.max(1, Math.round(imageWidth * LOGO_WIDTH_RATIO));
    const logoHeight = Math.max(1, Math.round((logo.get_height() * logoWidth) / logo.get_width()));
    scaledLogo = resize(logo, logoWidth, logoHeight, SamplingFilter.Lanczos3);

    const x = imageWidth - logoWidth - LOGO_MARGIN;
    const y = imageHeight - logoHeight - LOGO_MARGIN;
    watermark(image, scaledLogo, BigInt(x), BigInt(y));

    await bucket.put(key, image.get_bytes(), { httpMetadata: { contentType: "image/png" } });
    console.log(`[ImageLogo] Applied tenant logo to ${key}`);
  } catch (err) {
    console.error(`[ImageLogo] Failed for ${key} (post ${postId})`, err instanceof Error ? err.message : String(err));
  } finally {
    scaledLogo?.free();
    logo?.free();
    image?.free();
  }
}

// Se llama DESPUÉS de que generateFullCampaign termine, sobre los posts realmente
// persistidos. No-op para tenants sin logo configurado.
export async function overlayTenantLogoOnCampaignImages(env: DracoEnv, campaignId: string, tenantId: string): Promise<void> {
  const logoKey = TENANT_LOGO_KEYS[tenantId];
  if (!logoKey) return;

  const db = env.SOCIAL_DB;
  const bucket = env.SOCIAL_MEDIA_BUCKET;
  if (!db || !bucket) return;

  const logoBytes = await fetchLogoBytes(logoKey);
  if (!logoBytes) return;

  const { results } = await db
    .prepare(`SELECT id, image_hint FROM saas_social_posts WHERE campaign_id = ? AND tenant_id = ?`)
    .bind(campaignId, tenantId)
    .all<CampaignPostRow>();

  // Las variantes LinkedIn/Facebook comparten la imagen del post de Instagram (misma
  // clave R2) — el logo se aplica en sitio, así que sin deduplicar se pegaría dos veces.
  const processedKeys = new Set<string>();
  for (const row of results ?? []) {
    if (!row.image_hint) continue;
    const key = extractR2Key(row.image_hint);
    if (!key || processedKeys.has(key)) continue;
    processedKeys.add(key);
    await overlayLogoOnImage(bucket, key, row.id, logoBytes);
  }
}
