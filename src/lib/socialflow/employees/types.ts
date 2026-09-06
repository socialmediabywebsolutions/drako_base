export type EmployeeGender = "hombre" | "mujer" | "no_binario";
export type EmployeeSkinTone = "muy_clara" | "clara" | "media" | "olivacea" | "morena" | "oscura" | "muy_oscura";
export type EmployeeHairStyle = "liso" | "ondulado" | "rizado" | "muy_rizado_afro";
export type EmployeeHairLength = "rapado" | "muy_corto" | "corto" | "medio" | "largo" | "muy_largo";
export type EmployeeBodyConstitution = "ectomorfo" | "mesomorfo" | "endomorfo" | "mixto";

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
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  gender: EmployeeGender | null;
  skinTone: EmployeeSkinTone | null;
  hairColor: string | null;
  hairStyle: EmployeeHairStyle | null;
  hairLength: EmployeeHairLength | null;
  eyeColor: string | null;
  bodyConstitution: EmployeeBodyConstitution | null;
  faceShape: string | null;
  tattoos: string | null;
  beard: string | null;
}

export interface EmployeePhysicalFields {
  age?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  gender?: EmployeeGender | null;
  skinTone?: EmployeeSkinTone | null;
  hairColor?: string | null;
  hairStyle?: EmployeeHairStyle | null;
  hairLength?: EmployeeHairLength | null;
  eyeColor?: string | null;
  bodyConstitution?: EmployeeBodyConstitution | null;
  faceShape?: string | null;
  tattoos?: string | null;
  beard?: string | null;
}

export interface CreateEmployeeInput extends EmployeePhysicalFields {
  name: string;
  role?: string | null;
  specialty?: string | null;
  description?: string | null;
  photoUrl?: string | null;
  active?: boolean;
}

export interface UpdateEmployeeInput extends EmployeePhysicalFields {
  name?: string;
  role?: string | null;
  specialty?: string | null;
  description?: string | null;
  photoUrl?: string | null;
  faceR2Key?: string | null;
  active?: boolean;
}
