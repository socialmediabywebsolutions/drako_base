import type {
  EmployeeGender,
  EmployeeSkinTone,
  EmployeeHairStyle,
  EmployeeHairLength,
  EmployeeBodyConstitution,
  EmployeePhysicalFields,
} from "./types";

export const EMPLOYEE_GENDERS: EmployeeGender[] = ["hombre", "mujer", "no_binario"];
export const EMPLOYEE_SKIN_TONES: EmployeeSkinTone[] = ["muy_clara", "clara", "media", "olivacea", "morena", "oscura", "muy_oscura"];
export const EMPLOYEE_HAIR_STYLES: EmployeeHairStyle[] = ["liso", "ondulado", "rizado", "muy_rizado_afro"];
export const EMPLOYEE_HAIR_LENGTHS: EmployeeHairLength[] = ["rapado", "muy_corto", "corto", "medio", "largo", "muy_largo"];
export const EMPLOYEE_BODY_CONSTITUTIONS: EmployeeBodyConstitution[] = ["ectomorfo", "mesomorfo", "endomorfo", "mixto"];

function parseEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

function parseNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseNullableString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return typeof value === "string" ? value.trim() || null : null;
}

export function parseEmployeePhysicalFields(body: Record<string, unknown>): EmployeePhysicalFields {
  return {
    age: parseNumber(body.age),
    heightCm: parseNumber(body.heightCm),
    weightKg: parseNumber(body.weightKg),
    gender: parseEnum(body.gender, EMPLOYEE_GENDERS),
    skinTone: parseEnum(body.skinTone, EMPLOYEE_SKIN_TONES),
    hairColor: parseNullableString(body.hairColor),
    hairStyle: parseEnum(body.hairStyle, EMPLOYEE_HAIR_STYLES),
    hairLength: parseEnum(body.hairLength, EMPLOYEE_HAIR_LENGTHS),
    eyeColor: parseNullableString(body.eyeColor),
    bodyConstitution: parseEnum(body.bodyConstitution, EMPLOYEE_BODY_CONSTITUTIONS),
    faceShape: parseNullableString(body.faceShape),
    tattoos: parseNullableString(body.tattoos),
    beard: parseNullableString(body.beard),
  };
}
