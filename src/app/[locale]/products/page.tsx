import ProductsPage from "../../products/page";
import { getLocaleOrRedirect } from "../locale-guard";

export default async function LocaleProductsPage({ params }: { params: Promise<{ locale?: string }> }) {
  const resolvedParams = await params;
  const locale = getLocaleOrRedirect(resolvedParams?.locale, "/products");
  return <ProductsPage params={Promise.resolve({ locale })} />;
}
