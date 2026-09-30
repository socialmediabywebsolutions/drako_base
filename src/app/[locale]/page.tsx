import HomePage from "../page";
import { getLocaleOrRedirect } from "./locale-guard";

export default async function LocaleHomePage({ params }: { params: Promise<{ locale?: string }> }) {
  const resolvedParams = await params;
  const locale = getLocaleOrRedirect(resolvedParams?.locale, "/");
  return <HomePage params={Promise.resolve({ locale })} />;
}
