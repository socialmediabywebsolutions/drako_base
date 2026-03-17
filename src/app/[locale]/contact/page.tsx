import ContactPage from "../../contact/page";
import { getLocaleOrRedirect } from "../locale-guard";

export default async function LocaleContactPage({ params }: { params: Promise<{ locale?: string }> }) {
  const resolvedParams = await params;
  const locale = getLocaleOrRedirect(resolvedParams?.locale, "/contact");
  return <ContactPage params={Promise.resolve({ locale })} />;
}
