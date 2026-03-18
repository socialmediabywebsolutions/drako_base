import { SiteLayout } from "@/components/marketing/SiteLayout";
import { OpsPanel } from "@/components/ui/ops-primitives";
import { getMarketingCopy, resolveMarketingLocale, type MarketingLocale } from "@/lib/i18n/marketing";

export default async function ContactPage({ params }: { params?: Promise<{ locale?: string }> }) {
  const resolvedParams = params ? await params : undefined;
  const locale: MarketingLocale = resolveMarketingLocale(resolvedParams?.locale);
  const copy = getMarketingCopy(locale);

  return (
    <SiteLayout locale={locale} currentPath="/contact" copy={{ nav: copy.nav, footerLine: copy.about.intro }}>
      <div className="min-h-screen bg-[#f6f8fb] text-slate-900 leading-tight">
        <main className="mx-auto grid max-w-5xl gap-4 p-4 sm:p-6">
          <OpsPanel variant="elevated" className="p-5 sm:p-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.nav.contact}</p>
              <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900">{copy.contact.title}</h1>
              <p className="text-sm text-slate-600 max-w-3xl">{copy.contact.subtitle}</p>
            </div>
          </OpsPanel>

          <OpsPanel variant="base" className="p-5 sm:p-6">
            <section className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-slate-900">Motivos de contacto</h2>
                <ul className="space-y-2 text-sm text-slate-700">
                  {copy.contact.reasons.map((reason) => (
                    <li key={reason.title} className="rounded-xl border border-[#e3e9f3] bg-white px-4 py-3">
                      <p className="font-semibold text-slate-900">{reason.title}</p>
                      <p className="text-slate-600">{reason.desc}</p>
                    </li>
                  ))}
                </ul>
              </div>
              <form className="space-y-4 rounded-2xl border border-[#e3e9f3] bg-white px-5 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800" htmlFor="name">{copy.contact.form.name}</label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    className="w-full rounded-xl border border-[#e3e9f3] bg-white px-3 py-2 text-slate-900 outline-none ring-0 focus:border-sky-200"
                    placeholder={copy.contact.form.placeholderName}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800" htmlFor="email">{copy.contact.form.email}</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    className="w-full rounded-xl border border-[#e3e9f3] bg-white px-3 py-2 text-slate-900 outline-none ring-0 focus:border-sky-200"
                    placeholder={copy.contact.form.placeholderEmail}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800" htmlFor="reason">{copy.contact.form.reason}</label>
                  <select
                    id="reason"
                    name="reason"
                    className="w-full rounded-xl border border-[#e3e9f3] bg-white px-3 py-2 text-slate-900 outline-none ring-0 focus:border-sky-200"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      --
                    </option>
                    {copy.contact.reasons.map((reason) => (
                      <option key={reason.title} value={reason.title}>
                        {reason.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800" htmlFor="message">{copy.contact.form.message}</label>
                  <textarea
                    id="message"
                    name="message"
                    rows={5}
                    className="w-full rounded-xl border border-[#e3e9f3] bg-white px-3 py-2 text-slate-900 outline-none ring-0 focus:border-sky-200"
                    placeholder={copy.contact.form.placeholderMessage}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(56,189,248,0.35)] transition hover:bg-sky-600"
                >
                  {copy.contact.form.submit}
                </button>
                <p className="text-xs text-slate-500">{copy.contact.note}</p>
              </form>
            </section>
            <p className="mt-4 text-sm text-slate-600">{copy.contact.footer}</p>
          </OpsPanel>
        </main>
      </div>
    </SiteLayout>
  );
}
