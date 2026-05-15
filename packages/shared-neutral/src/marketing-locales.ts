export type MarketingLocale = "es" | "en";

export const supportedMarketingLocales: MarketingLocale[] = ["es", "en"];
export const defaultMarketingLocale: MarketingLocale = "es";

export const isSupportedMarketingLocale = (value?: string | null): value is MarketingLocale => {
  if (!value) return false;
  return supportedMarketingLocales.includes(value.toLowerCase() as MarketingLocale);
};

export const normalizeMarketingLocale = (value?: string | null): MarketingLocale => {
  if (!value) return defaultMarketingLocale;
  const normalized = value.toLowerCase();
  return isSupportedMarketingLocale(normalized) ? (normalized as MarketingLocale) : defaultMarketingLocale;
};

export const resolveMarketingLocale = normalizeMarketingLocale;

export const getLocalizedPath = (locale: MarketingLocale, path: string): string => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (locale === defaultMarketingLocale) return cleanPath === "//" ? "/" : cleanPath;
  if (cleanPath === "/") return `/${locale}`;
  return `/${locale}${cleanPath}`;
};

export function extractLocaleFromPath(pathname: string): {
  locale: MarketingLocale;
  pathWithoutLocale: string;
  rawLocale?: string;
} {
  const segments = pathname.split("/").filter(Boolean);
  const candidate = segments[0];
  if (isSupportedMarketingLocale(candidate)) {
    const rest = segments.slice(1).join("/");
    const normalizedRest = rest ? `/${rest}` : "/";
    return {
      locale: normalizeMarketingLocale(candidate),
      pathWithoutLocale: normalizedRest,
      rawLocale: candidate,
    };
  }

  return {
    locale: defaultMarketingLocale,
    pathWithoutLocale: pathname || "/",
    rawLocale: undefined,
  };
}

export function resolveLocaleFromRequest(pathname: string, queryLocale?: string | null) {
  const pathInfo = extractLocaleFromPath(pathname);
  const locale = normalizeMarketingLocale(queryLocale || pathInfo.rawLocale);
  const pathWithoutLocale = pathInfo.pathWithoutLocale;
  return { locale, pathWithoutLocale };
}
