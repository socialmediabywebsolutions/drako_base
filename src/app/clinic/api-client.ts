"use client";

const NO_SUBSCRIPTION_ERROR = "NO_SUBSCRIPTION";

type ClinicApiErrorPayload = { code?: string; message?: string } | null;

type UnwrapOptions = {
  fallbackMessage?: string;
};

async function readJsonSafely<T>(response: Response): Promise<T | null> {
  if (response.status === 204) return null;
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function unwrapClinicResponse<T>(response: Response, options?: UnwrapOptions): Promise<T> {
  if (response.ok) {
    const data = await readJsonSafely<T>(response);
    return (data ?? (undefined as T)) as T;
  }
  const data = await readJsonSafely<ClinicApiErrorPayload>(response);
  if (data?.code === "NO_ACTIVE_CLINIC_SUBSCRIPTION") {
    throw new Error(NO_SUBSCRIPTION_ERROR);
  }
  const fallback = options?.fallbackMessage ?? "No se pudo completar la acción en Drako Clinic.";
  throw new Error(data?.message ?? fallback);
}

export function isNoSubscriptionError(error: unknown): boolean {
  return error instanceof Error && error.message === NO_SUBSCRIPTION_ERROR;
}

export function getNoSubscriptionErrorCode(): string {
  return NO_SUBSCRIPTION_ERROR;
}
