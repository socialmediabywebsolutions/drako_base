export type SaasFactoryProvisioningResult = {
  saasId?: string | null;
  cloudflare?: { status?: string | null; message?: string | null } | null;
  stripe?: { status?: string | null; message?: string | null } | null;
  ai?: { status?: string | null; profile?: { tier?: string | null } | null } | null;
};
