import { resolveSocialContext } from "@/lib/socialflow/repository";
import type { EmpresaLocal, UpsertLocalInput, EmpresaLocalPhoto, LocalPhotoType } from "./types";

const LOCAL_TABLE = "saas_empresa_local";
const PHOTOS_TABLE = "saas_empresa_local_photos";

type LocalRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  business_name: string | null;
  address: string | null;
  opening_hours: string | null;
  description: string | null;
  niche: string | null;
  latitude: number | null;
  longitude: number | null;
  place_id: string | null;
  geocoded_at: string | null;
  created_at: string;
  updated_at: string;
};

type PhotoRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  photo_url: string;
  photo_type: LocalPhotoType;
  created_at: string;
};

function rowToLocal(row: LocalRow): EmpresaLocal {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    businessName: row.business_name,
    address: row.address,
    openingHours: row.opening_hours,
    description: row.description,
    niche: row.niche,
    latitude: row.latitude,
    longitude: row.longitude,
    placeId: row.place_id,
    geocodedAt: row.geocoded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToPhoto(row: PhotoRow): EmpresaLocalPhoto {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    photoUrl: row.photo_url,
    photoType: row.photo_type,
    createdAt: row.created_at,
  };
}

async function getDb(tenantId: string, saasId: string) {
  const ctx = await resolveSocialContext({ tenantId, saasId });
  return ctx.socialDb;
}

export async function getLocal(tenantId: string, saasId: string): Promise<EmpresaLocal | null> {
  const db = await getDb(tenantId, saasId);
  const row = await db
    .prepare(`SELECT * FROM ${LOCAL_TABLE} WHERE tenant_id = ? AND saas_id = ?`)
    .bind(tenantId, saasId)
    .first<LocalRow>();
  return row ? rowToLocal(row) : null;
}

export async function upsertLocal(
  tenantId: string,
  saasId: string,
  input: UpsertLocalInput,
): Promise<EmpresaLocal> {
  const db = await getDb(tenantId, saasId);
  const existing = await db
    .prepare(`SELECT id, address FROM ${LOCAL_TABLE} WHERE tenant_id = ? AND saas_id = ?`)
    .bind(tenantId, saasId)
    .first<{ id: string; address: string | null }>();
  const now = new Date().toISOString();

  if (existing) {
    // If the address changed, the cached geocoding (latitude/longitude/place_id/
    // geocoded_at) no longer points at the right place — reset it so
    // CompetitorIntelligenceAgent re-geocodes on its next run instead of using stale
    // coordinates for the old address.
    const addressChanged = (input.address ?? null) !== existing.address;
    const setClause = addressChanged
      ? `business_name = ?, address = ?, opening_hours = ?, description = ?, niche = ?, updated_at = ?, latitude = NULL, longitude = NULL, place_id = NULL, geocoded_at = NULL`
      : `business_name = ?, address = ?, opening_hours = ?, description = ?, niche = ?, updated_at = ?`;

    await db
      .prepare(`UPDATE ${LOCAL_TABLE} SET ${setClause} WHERE id = ?`)
      .bind(
        input.businessName ?? null,
        input.address ?? null,
        input.openingHours ?? null,
        input.description ?? null,
        input.niche ?? null,
        now,
        existing.id,
      )
      .run();
    return (await getLocal(tenantId, saasId))!;
  }

  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO ${LOCAL_TABLE} (id, tenant_id, saas_id, business_name, address, opening_hours, description, niche, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      tenantId,
      saasId,
      input.businessName ?? null,
      input.address ?? null,
      input.openingHours ?? null,
      input.description ?? null,
      input.niche ?? null,
      now,
      now,
    )
    .run();

  return {
    id,
    tenantId,
    saasId,
    businessName: input.businessName ?? null,
    address: input.address ?? null,
    openingHours: input.openingHours ?? null,
    description: input.description ?? null,
    niche: input.niche ?? null,
    latitude: null,
    longitude: null,
    placeId: null,
    geocodedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getLocalPhotos(tenantId: string, saasId: string): Promise<EmpresaLocalPhoto[]> {
  const db = await getDb(tenantId, saasId);
  const { results } = await db
    .prepare(
      `SELECT id, tenant_id, saas_id, photo_url, photo_type, created_at
       FROM ${PHOTOS_TABLE} WHERE tenant_id = ? AND saas_id = ? ORDER BY created_at DESC LIMIT 100`,
    )
    .bind(tenantId, saasId)
    .all<PhotoRow>();
  return (results ?? []).map(rowToPhoto);
}

export async function addLocalPhoto(
  tenantId: string,
  saasId: string,
  photoUrl: string,
  photoType: LocalPhotoType,
): Promise<EmpresaLocalPhoto> {
  const db = await getDb(tenantId, saasId);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO ${PHOTOS_TABLE} (id, tenant_id, saas_id, photo_url, photo_type, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, tenantId, saasId, photoUrl, photoType, now)
    .run();
  return { id, tenantId, saasId, photoUrl, photoType, createdAt: now };
}

export async function deleteLocalPhoto(id: string, tenantId: string, saasId: string): Promise<boolean> {
  const db = await getDb(tenantId, saasId);
  const result = await db
    .prepare(`DELETE FROM ${PHOTOS_TABLE} WHERE id = ? AND tenant_id = ? AND saas_id = ?`)
    .bind(id, tenantId, saasId)
    .run();
  return ((result?.meta as { changes?: number })?.changes ?? 0) > 0;
}

// Persists geocoded coordinates for the business address, so CompetitorIntelligenceAgent
// doesn't need to re-geocode on every run. Called only when saas_empresa_local has no
// cached latitude/longitude yet (or the client's address changed).
export async function updateLocalCoordinates(
  tenantId: string,
  saasId: string,
  coords: { latitude: number; longitude: number; placeId: string | null },
): Promise<void> {
  const db = await getDb(tenantId, saasId);
  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE ${LOCAL_TABLE} SET latitude = ?, longitude = ?, place_id = ?, geocoded_at = ? WHERE tenant_id = ? AND saas_id = ?`,
    )
    .bind(coords.latitude, coords.longitude, coords.placeId, now, tenantId, saasId)
    .run();
}

// Returns a structured context string for injection into the LLaVA image-analysis
// prompt, so descriptions and themes match the real business — same role as
// getEmployeeContext() but for the business location itself.
export async function getLocalContext(tenantId: string, saasId: string): Promise<string> {
  const local = await getLocal(tenantId, saasId);
  if (!local) return "";

  const parts: string[] = [];
  if (local.businessName) parts.push(`Nombre del negocio: ${local.businessName}.`);
  if (local.niche) parts.push(`Categoría: ${local.niche}.`);
  if (local.address) parts.push(`Dirección: ${local.address}.`);
  if (local.openingHours) parts.push(`Horario: ${local.openingHours}.`);
  if (local.description) parts.push(local.description);

  if (!parts.length) return "";
  return `Información del local: ${parts.join(" ")}`;
}
