export type SaasDomainStatus = "pending" | "active" | "paused";

export type SaasDomain = {
  id: string;
  tenantId: string;
  saasId: string;
  domain: string;
  isPrimary: boolean;
  status: SaasDomainStatus;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SaasPublicProfile = {
  tenantId: string;
  saasId: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  category: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  brand: {
    primaryColor: string;
    accentColor: string;
  };
  socialLinks: Array<{ provider: string; handle: string | null; url: string }>;
  primaryDomain: string | null;
  publicSubdomain: string | null;
  domainStatus: string;
};
