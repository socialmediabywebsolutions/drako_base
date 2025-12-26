import { env } from "@/lib/cf";
import { queryAll } from "@/lib/db";
import {
  getDemoClinicProfile,
  listDemoClinicServices,
  listDemoClinicReviews,
  listDemoSaas,
} from "@/lib/admin/demo-data";
import type { ClinicProfile, ClinicService } from "@/lib/clinic/types";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";

type SaasRow = {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  public_domain: string | null;
  public_subdomain: string | null;
  domain_status: string;
};

type ClinicProfileRow = {
  id: string;
  tenant_id: string;
  client_id: string | null;
  saas_id: string;
  display_name: string;
  city: string | null;
  rooms_count: number | null;
  staff_count: number | null;
  primary_goal: string | null;
  channels: string | null;
  created_at: string;
  updated_at: string;
};

type ClinicServiceRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  name: string;
  duration_minutes: number | null;
  base_price: number | null;
  is_active: number;
  created_at: string;
  updated_at: string;
};

type ClinicReviewRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  patient_name: string;
  rating: number;
  text: string;
  source: string | null;
  created_at: string;
};

export type PublicClinicReview = {
  id: string;
  patientName: string;
  rating: number;
  text: string;
  source: string | null;
};

export type PublicClinicSiteData = {
  tenantId: string;
  saasId: string;
  name: string;
  slug: string;
  publicDomain: string | null;
  publicSubdomain: string | null;
  domainStatus: string;
  profile: ClinicProfile | null;
  services: ClinicService[];
  reviews: PublicClinicReview[];
};

function hasDatabase(): boolean {
  return Boolean(env()?.DRACO_DB);
}

function mapProfile(row: ClinicProfileRow | null): ClinicProfile | null {
  if (!row) return null;
  let channels: Record<string, boolean> | null = null;
  if (row.channels) {
    try {
      channels = JSON.parse(row.channels);
    } catch {
      channels = null;
    }
  }
  return {
    id: row.id,
    saasId: row.saas_id,
    clientId: row.client_id,
    displayName: row.display_name,
    city: row.city,
    roomsCount: row.rooms_count ?? 0,
    staffCount: row.staff_count ?? 0,
    primaryGoal: row.primary_goal,
    channels,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapService(row: ClinicServiceRow): ClinicService {
  return {
    id: row.id,
    saasId: row.saas_id,
    name: row.name,
    durationMinutes: row.duration_minutes ?? 0,
    basePrice: row.base_price ?? 0,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapReview(row: ClinicReviewRow): PublicClinicReview {
  return {
    id: row.id,
    patientName: row.patient_name,
    rating: row.rating,
    text: row.text,
    source: row.source,
  };
}

export async function findSaasBySlug(slug: string): Promise<{ tenantId: string; saasId: string } | null> {
  const trimmed = slug.trim().toLowerCase();
  if (!trimmed) return null;
  if (hasDatabase()) {
    const rows = await queryAll<SaasRow>(
      "SELECT id, tenant_id, name, slug, public_domain, public_subdomain, domain_status FROM saas WHERE lower(slug) = ? LIMIT 1",
      trimmed,
    );
    if (!rows[0]) return null;
    return { tenantId: rows[0].tenant_id, saasId: rows[0].id };
  }
  const saas = listDemoSaas(DEMO_TENANT_ID).find((item) => item.slug.toLowerCase() === trimmed);
  return saas ? { tenantId: DEMO_TENANT_ID, saasId: saas.id } : null;
}

export async function getPublicClinicSiteData(slug: string): Promise<PublicClinicSiteData | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;

  if (hasDatabase()) {
    const saasRows = await queryAll<SaasRow>(
      "SELECT id, tenant_id, name, slug, public_domain, public_subdomain, domain_status FROM saas WHERE lower(slug) = ? LIMIT 1",
      normalized,
    );
    const saas = saasRows[0];
    if (!saas) return null;
    const profileRows = await queryAll<ClinicProfileRow>(
      "SELECT id, tenant_id, client_id, saas_id, display_name, city, rooms_count, staff_count, primary_goal, channels, created_at, updated_at FROM clinic_profiles WHERE tenant_id = ? AND saas_id = ? LIMIT 1",
      saas.tenant_id,
      saas.id,
    );
    const servicesRows = await queryAll<ClinicServiceRow>(
      "SELECT id, tenant_id, saas_id, name, duration_minutes, base_price, is_active, created_at, updated_at FROM clinic_services WHERE tenant_id = ? AND saas_id = ? ORDER BY base_price DESC",
      saas.tenant_id,
      saas.id,
    );
    let reviewsRows: ClinicReviewRow[] = [];
    try {
      reviewsRows = await queryAll<ClinicReviewRow>(
        "SELECT id, tenant_id, saas_id, patient_name, rating, text, source, created_at FROM clinic_reviews WHERE tenant_id = ? AND saas_id = ? ORDER BY created_at DESC",
        saas.tenant_id,
        saas.id,
      );
    } catch {
      reviewsRows = [];
    }
    return {
      tenantId: saas.tenant_id,
      saasId: saas.id,
      name: saas.name,
      slug: saas.slug,
      publicDomain: saas.public_domain,
      publicSubdomain: saas.public_subdomain,
      domainStatus: saas.domain_status,
      profile: mapProfile(profileRows[0] ?? null),
      services: servicesRows.map(mapService),
      reviews: reviewsRows.map(mapReview),
    };
  }

  const saas = listDemoSaas(DEMO_TENANT_ID).find((item) => item.slug.toLowerCase() === normalized);
  if (!saas) return null;
  const profile = getDemoClinicProfile(DEMO_TENANT_ID, saas.id);
  return {
    tenantId: DEMO_TENANT_ID,
    saasId: saas.id,
    name: saas.name,
    slug: saas.slug,
    publicDomain: saas.public_domain,
    publicSubdomain: saas.public_subdomain,
    domainStatus: saas.domain_status,
    profile: profile
      ? {
          id: profile.id,
          saasId: profile.saas_id,
          clientId: profile.client_id,
          displayName: profile.display_name,
          city: profile.city,
          roomsCount: profile.rooms_count,
          staffCount: profile.staff_count,
          primaryGoal: profile.primary_goal,
          channels: profile.channels,
          createdAt: profile.created_at,
          updatedAt: profile.updated_at,
        }
      : null,
    services: listDemoClinicServices(DEMO_TENANT_ID, saas.id).map((service) => ({
      id: service.id,
      saasId: service.saas_id,
      name: service.name,
      durationMinutes: service.duration_minutes,
      basePrice: service.base_price,
      isActive: service.is_active === 1,
      createdAt: service.created_at,
      updatedAt: service.updated_at,
    })),
    reviews: listDemoClinicReviews(DEMO_TENANT_ID, saas.id).map((review) => ({
      id: review.id,
      patientName: review.patient_name,
      rating: review.rating,
      text: review.text,
      source: review.source,
    })),
  };
}
