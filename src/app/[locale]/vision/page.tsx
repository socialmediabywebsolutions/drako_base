import VisionPage from "../../vision/page";
import { getLocaleOrRedirect } from "../locale-guard";

export default async function LocaleVisionPage({ params }: { params: Promise<{ locale?: string }> }) {
  const resolvedParams = await params;
  const locale = getLocaleOrRedirect(resolvedParams?.locale, "/vision");
  return <VisionPage params={Promise.resolve({ locale })} />;
}
