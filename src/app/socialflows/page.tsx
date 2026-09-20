import type { Metadata } from "next";
import ChatWidget from "./_components/chat-widget";
import { Engine } from "./_components/engine";
import {
  BeforeAfter,
  Demo,
  Faq,
  FinalCta,
  Hero,
  HowItWorks,
  KnowsYourBusiness,
  LandingFooter,
  LandingNav,
  Networks,
  RealTime,
  TrialAndPlans,
  YourTime,
} from "./_components/landing-sections";
import { HEADLINE, LOGO_URL, SITE_URL, SUBHEADLINE } from "./_components/landing-config";
import "./landing.css";

const TITLE = `SocialCors — ${HEADLINE}`;

export const metadata: Metadata = {
  title: TITLE,
  description: SUBHEADLINE,
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "SocialCors",
    locale: "es_ES",
    title: TITLE,
    description: SUBHEADLINE,
    images: [{ url: LOGO_URL, alt: "SocialCors" }],
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: SUBHEADLINE,
    images: [LOGO_URL],
  },
};

export default function SocialflowsLandingPage() {
  return (
    <div className="sc-home min-h-screen font-sans antialiased">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-bold"
      >
        Saltar al contenido
      </a>
      <LandingNav />
      <main id="contenido">
        <Hero />
        <HowItWorks />
        <RealTime />
        <KnowsYourBusiness />
        <Engine />
        <BeforeAfter />
        <YourTime />
        <Networks />
        <Demo />
        <TrialAndPlans />
        <Faq />
        <FinalCta />
      </main>
      <LandingFooter />
      <ChatWidget />
    </div>
  );
}
