import { SiteLayout } from "@/components/marketing/SiteLayout";
import { getMarketingCopy, resolveMarketingLocale, type MarketingLocale } from "@/lib/i18n/marketing";

export default async function ContactPage({ params }: { params?: Promise<{ locale?: string }> }) {
  const resolvedParams = params ? await params : undefined;
  const locale: MarketingLocale = resolveMarketingLocale(resolvedParams?.locale);
  const copy = getMarketingCopy(locale);

  return (
    <SiteLayout locale={locale} currentPath="/contact" copy={{ nav: copy.nav, footerLine: copy.about.intro }}>
      <div className="mx-auto max-w-4xl px-6 py-16 space-y-10">
        <header className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{copy.nav.contact}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{copy.contact.title}</h1>
          <p className="text-slate-600 max-w-3xl">{copy.contact.subtitle}</p>
        </header>

        <section className="grid gap-6 rounded-2xl border border-slate-200 bg-white/70 p-8 shadow-sm sm:grid-cols-2">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Motivos de contacto</h2>
            <ul className="space-y-2 text-sm text-slate-700">
              {copy.contact.reasons.map((reason) => (
                <li key={reason.title} className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3">
                  <p className="font-semibold text-slate-900">{reason.title}</p>
                  <p className="text-slate-600">{reason.desc}</p>
                </li>
              ))}
            </ul>
          </div>
          <form className="space-y-4 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800" htmlFor="name">{copy.contact.form.name}</label>
              <input
                id="name"
                name="name"
                type="text"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-0 focus:border-slate-400"
                placeholder={copy.contact.form.placeholderName}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800" htmlFor="email">{copy.contact.form.email}</label>
              <input
                id="email"
                name="email"
                type="email"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-0 focus:border-slate-400"
                placeholder={copy.contact.form.placeholderEmail}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800" htmlFor="reason">{copy.contact.form.reason}</label>
              <select
                id="reason"
                name="reason"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-0 focus:border-slate-400"
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
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-0 focus:border-slate-400"
                placeholder={copy.contact.form.placeholderMessage}
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              {copy.contact.form.submit}
            </button>
            <p className="text-xs text-slate-500">{copy.contact.note}</p>
          </form>
        </section>

        <p className="text-sm text-slate-500">{copy.contact.footer}</p>
      </div>
    </SiteLayout>
  );
}
