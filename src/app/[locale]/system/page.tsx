import SystemPage from "../../system/page";
import { getLocaleOrRedirect } from "../locale-guard";

export default async function LocaleSystemPage({ params }: { params: Promise<{ locale?: string }> }) {
  const resolvedParams = await params;
  const locale = getLocaleOrRedirect(resolvedParams?.locale, "/system");
  return <SystemPage params={Promise.resolve({ locale })} />;
}
