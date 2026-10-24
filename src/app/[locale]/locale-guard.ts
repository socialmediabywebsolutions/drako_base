import { redirect } from "next/navigation";
import { defaultMarketingLocale, resolveMarketingLocale, type MarketingLocale } from "@/lib/i18n/marketing";

export function getLocaleOrRedirect(localeParam: string | undefined, restPath: string): MarketingLocale {
  const requested = (localeParam || "").toLowerCase();
  const resolved = resolveMarketingLocale(requested);

  // If locale is unsupported, fall back to default path (no prefix)
  if (resolved === defaultMarketingLocale && requested && resolved !== requested) {
    redirect(restPath || "/");
  }

  // If locale is supported but casing/format differs, redirect to canonical prefixed path
  if (resolved !== defaultMarketingLocale && resolved !== requested) {
    const suffix = restPath === "/" ? "" : restPath;
    redirect(`/${resolved}${suffix}`);
  }

  return resolved;
}
