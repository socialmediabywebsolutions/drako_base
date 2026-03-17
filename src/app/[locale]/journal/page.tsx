import JournalPage from "../../journal/page";
import { getLocaleOrRedirect } from "../locale-guard";

export default async function LocaleJournalPage({ params }: { params: Promise<{ locale?: string }> }) {
  const resolvedParams = await params;
  const locale = getLocaleOrRedirect(resolvedParams?.locale, "/journal");
  return <JournalPage params={Promise.resolve({ locale })} />;
}
