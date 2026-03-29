"use client";

import Link from "next/link";
import { getHomeTexts, type HomeLang } from "@/lib/i18n/home-i18n";
import "@/app/home.css";

export default function HomePageComponent() {
    const lang: HomeLang = "es";
    const t = getHomeTexts(lang);

    const scrollToHow = () => {
        document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
    };

    return (
        <div className="drako-home">
            {/* ── Header ── */}
            <header className="dh-header">
                <div className="dh-header-inner">
                    <Link href="/" className="dh-logo">
                        DRĀKO<span>.Systems</span>
                    </Link>
                    <nav className="dh-nav">
                        <Link href="/dashboard">{t.nav.panel}</Link>
                        <Link href="/support">{t.nav.support}</Link>
                        <Link href="/drakos/auths/registrations" className="dh-nav-cta">
                            {t.nav.start}
                        </Link>
                    </nav>
                </div>
            </header>

            {/* ── 1) Hero ── */}
            <section className="dh-hero">
                <h1>{t.hero.title}</h1>
                <p>{t.hero.subtitle}</p>
                <div className="dh-hero-ctas">
                    <Link href="/drakos/auths/registrations" className="dh-btn-primary">
                        {t.hero.ctaPrimary} →
                    </Link>
                    <button onClick={scrollToHow} className="dh-btn-secondary" type="button">
                        {t.hero.ctaSecondary}
                    </button>
                </div>
            </section>

            {/* ── 2) Cómo funciona ── */}
            <div className="dh-section-full-alt">
                <section id="how-it-works" className="dh-section dh-section-center">
                    <span className="dh-badge">{t.howItWorks.badge}</span>
                    <h2 className="dh-section-title">{t.howItWorks.title}</h2>
                    <div className="dh-steps">
                        {t.howItWorks.steps.map((step, i) => (
                            <div key={i} className="dh-step-card">
                                <div className="dh-step-number">Paso {i + 1}</div>
                                <h3>{step.title.replace(/^\d+\.\s*/, "")}</h3>
                                <p>{step.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            {/* ── 3) Departamentos ── */}
            <section className="dh-section dh-section-center">
                <span className="dh-badge">{t.departments.badge}</span>
                <h2 className="dh-section-title">{t.departments.title}</h2>
                <p className="dh-section-subtitle">{t.departments.subtitle}</p>
                <div className="dh-departments">
                    {t.departments.items.map((dept) => (
                        <div key={dept.id} className="dh-dept-card">
                            <h3>{dept.name}</h3>
                            <p>{dept.desc}</p>
                        </div>
                    ))}
                </div>
                <p className="dh-departments-footer">{t.departments.footer}</p>
            </section>

            {/* ── 4) Resultados ── */}
            <div className="dh-section-full-alt">
                <section className="dh-section dh-section-center">
                    <span className="dh-badge">{t.results.badge}</span>
                    <h2 className="dh-section-title">{t.results.title}</h2>
                    <div className="dh-results">
                        {t.results.items.map((item, i) => (
                            <div key={i} className="dh-result-card">
                                <h3>{item.title}</h3>
                                <p>{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            {/* ── 5) Para quién es ── */}
            <section className="dh-section dh-section-center">
                <span className="dh-badge">{t.forWhom.badge}</span>
                <h2 className="dh-section-title">{t.forWhom.title}</h2>
                <div className="dh-profiles">
                    {t.forWhom.profiles.map((p, i) => (
                        <div key={i} className="dh-profile-card">
                            <h3>{p.title}</h3>
                            <p>{p.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── 6) CTA Final ── */}
            <section className="dh-cta-section">
                <h2>{t.finalCta.title}</h2>
                <p>{t.finalCta.subtitle}</p>
                <Link href="/drakos/auths/registrations" className="dh-btn-primary">
                    {t.finalCta.button} →
                </Link>
            </section>

            {/* ── Footer ── */}
            <footer className="dh-footer">
                <div className="dh-footer-copy">{t.footer.copy}</div>
                <div className="dh-footer-links">
                    {t.footer.legal} · <a href={`mailto:${t.footer.contact}`}>{t.footer.contact}</a>
                </div>
                {/* Build Stamp */}
                <div className="dh-footer-stamp">
                    v2 · {process.env.NEXT_PUBLIC_GIT_SHA?.slice(0, 7) || "dev"}
                </div>
            </footer>
        </div>
    );
}
