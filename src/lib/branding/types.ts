export type BrandingLayoutDensity = "COMPACT" | "COZY" | "NORMAL";

export type BrandingRoleType = "OWNER" | "EMPLOYEE";

export type SaasBrandingSettings = {
  id: string;
  tenantId: string;
  saasId: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  dangerColor: string;
  successColor: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  heroImageUrl?: string | null;
  layoutDensity: BrandingLayoutDensity;
  enableDarkMode: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type SaasUserUiPreferences = {
  id: string;
  tenantId: string;
  saasId: string;
  userId: string;
  roleType: BrandingRoleType;
  layoutDensityOverride?: BrandingLayoutDensity | null;
  defaultSection?: string | null;
  hiddenWidgets?: string[] | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type ResolvedTheme = {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    danger: string;
    success: string;
  };
  layoutDensity: BrandingLayoutDensity;
  logoUrl?: string | null;
  heroImageUrl?: string | null;
  effectiveDarkMode: boolean;
};
