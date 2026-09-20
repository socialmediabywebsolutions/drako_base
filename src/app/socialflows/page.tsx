import type { Metadata } from "next";
import ChatWidget from "./_components/chat-widget";
import { Spine } from "./_components/flow";
import { Engine } from "./_components/engine";
import { KnowsYourBusiness } from "./_components/knowledge-system";
import { Networks } from "./_components/networks-system";
import {
  BeforeAfter,
  Demo,
  Faq,
  FinalCta,
  Hero,
  HowItWorks,
  LandingFooter,
  LandingNav,
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
        <Spine />
        <HowItWorks />
        <Spine />
        <RealTime />
        <Spine />
        <KnowsYourBusiness />
        <Spine />
        <Engine />
        <Spine />
        <BeforeAfter />
        <YourTime />
        <Spine />
        <Networks />
        <Spine />
        <Demo />
        <Spine />
        <TrialAndPlans />
        <Spine />
        <Faq />
        <Spine />
        <FinalCta />
        <Spine />
      </main>
      <LandingFooter />
      <ChatWidget />
    </div>
  );
}
