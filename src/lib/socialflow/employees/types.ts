export interface EmpresaEmployee {
  id: string;
  tenantId: string;
  saasId: string;
  name: string;
  role: string | null;
  specialty: string | null;
  description: string | null;
  photoUrl: string | null;
  faceR2Key: string | null;
  active: boolean;
  createdAt: string;
}

export interface CreateEmployeeInput {
  name: string;
  role?: string | null;
  specialty?: string | null;
  description?: string | null;
  photoUrl?: string | null;
  active?: boolean;
}

export interface UpdateEmployeeInput {
  name?: string;
  role?: string | null;
  specialty?: string | null;
  description?: string | null;
  photoUrl?: string | null;
  faceR2Key?: string | null;
  active?: boolean;
}
