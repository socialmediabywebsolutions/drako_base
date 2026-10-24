export interface EmpresaLocal {
  id: string;
  tenantId: string;
  saasId: string;
  businessName: string | null;
  address: string | null;
  openingHours: string | null;
  description: string | null;
  niche: string | null;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  geocodedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertLocalInput {
  businessName?: string | null;
  address?: string | null;
  openingHours?: string | null;
  description?: string | null;
  niche?: string | null;
}

export type LocalPhotoType = "exterior" | "interior" | "ambiente";

export interface EmpresaLocalPhoto {
  id: string;
  tenantId: string;
  saasId: string;
  photoUrl: string;
  photoType: LocalPhotoType;
  createdAt: string;
}
