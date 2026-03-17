import AboutPage from "../../about/page";
import { getLocaleOrRedirect } from "../locale-guard";

export default async function LocaleAboutPage({ params }: { params: Promise<{ locale?: string }> }) {
  const resolvedParams = await params;
  const locale = getLocaleOrRedirect(resolvedParams?.locale, "/about");
  return <AboutPage params={Promise.resolve({ locale })} />;
}
