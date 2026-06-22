"use client";

import { useState } from "react";
import Link from "next/link";

type Lang = "es" | "en";

// ─── Copy ──────────────────────────────────────────────────────────────────────
const COPY = {
  es: {
    nav: { login: "Iniciar sesión", cta: "Empezar gratis" },
    hero: {
      badge: "Sistema operativo de marketing con IA",
      h1a: "La IA que gestiona tu marketing",
      h1b: "mientras tú te dedicas a tu negocio.",
      sub: "SocialFlow aprende quién eres, crea campañas completas, publica solo, responde comentarios con tu voz, detecta leads y analiza resultados — sin que toques nada.",
      cta: "Activar mi marketing",
      ctaSub: "Ver cómo funciona",
      trust: "Sin tarjeta de crédito · 14 días gratis · Cancela cuando quieras",
      channels: "Conectado a tus canales",
    },
    stats: [
      { v: "10.000+", l: "Publicaciones gestionadas" },
      { v: "98%", l: "Menos tiempo en marketing" },
      { v: "3.2×", l: "Más engagement promedio" },
    ],
    how: {
      badge: "Cómo funciona",
      h2: "De cero a marketing autónomo en 15 minutos",
      steps: [
        { n: "01", title: "Entrena a tu IA", body: "Conecta tu web, sube documentos y define tu tono. SocialFlow construye el modelo mental de tu empresa y aprende tus argumentos comerciales.", tag: "Una sola vez" },
        { n: "02", title: "Define una campaña", body: "Indica el objetivo: lanzar un producto, generar leads, crecer tu comunidad. La IA diseña la campaña completa: copies, formatos y calendario por canal.", tag: "En minutos" },
        { n: "03", title: "El sistema opera solo", body: "Publica, responde con tu voz, detecta leads y mide el sentimiento. Tú recibes reportes. La IA ejecuta.", tag: "24 / 7" },
      ],
    },
    caps: {
      badge: "Capacidades",
      h2: "Un equipo completo de marketing, por 49€ al mes",
      items: [
        { icon: "brain",    title: "Conoce tu empresa",         body: "Ingesta web, documentos y FAQs para responder siempre en contexto." },
        { icon: "campaign", title: "Crea campañas completas",   body: "De objetivo a calendario con copies e imágenes. Todo automático." },
        { icon: "publish",  title: "Publica automáticamente",   body: "Elige el mejor horario por red social y ejecuta sin intervención." },
        { icon: "reply",    title: "Responde con tu voz",       body: "Gestiona DMs y comentarios usando el conocimiento real de tu empresa." },
        { icon: "leads",    title: "Detecta leads",             body: "Identifica intención de compra en tiempo real y alimenta tu CRM." },
        { icon: "chart",    title: "Analiza el sentimiento",    body: "Entiende cómo percibe tu audiencia cada mensaje. Ajusta con datos." },
      ],
    },
    pricing: {
      badge: "Precios",
      h2: "Menos que contratar a alguien",
      sub: "Un Community Manager en España cuesta entre 1.500€ y 2.500€/mes. SocialFlow trabaja 24/7 por una fracción.",
      cm: {
        label: "Community Manager",
        price: "~1.800€/mes",
        items: ["Solo 8 h/día laborables", "Sin IA ni automatización", "Responde en horario de oficina", "Vacaciones y bajas", "1 persona, 1 marca"],
      },
      plans: [
        {
          name: "Creator", price: "49€", period: "/mes",
          desc: "Para creadores y marcas personales que quieren marketing profesional sin equipo.",
          features: ["1 marca con base de conocimiento IA", "Generación de campañas completas", "Publicación automática en 3 canales", "Respuestas automáticas con tu voz", "Detección de leads", "Analytics de sentimiento"],
          cta: "Empezar con Creator", hot: false,
        },
        {
          name: "Pro", price: "99€", period: "/mes",
          desc: "Para agencias y equipos que gestionan varias marcas a escala.",
          features: ["Hasta 5 marcas con bases independientes", "Campañas ilimitadas con IA", "Canales sociales ilimitados", "Respuestas multi-cuenta", "Pipeline de leads + CRM", "Analytics avanzado + exportación", "Informes de campaña", "Soporte prioritario"],
          cta: "Empezar con Pro", hot: true,
        },
      ],
      trial: "14 días gratis en cualquier plan · Sin tarjeta de crédito",
    },
    testimonials: {
      badge: "Lo que dicen nuestros clientes",
      items: [
        { q: "Pasé de publicar una vez a la semana cuando me acordaba, a tener un calendario de 30 días ejecutándose solo. Mi engagement creció un 280% en dos meses.", name: "Laura M.", role: "Fundadora · Estudio de diseño", av: "L" },
        { q: "Gestiono 4 clientes con SocialFlow Pro. Lo que antes me llevaba 40 horas al mes ahora son 3 horas de revisión. El ROI es inmediato.", name: "Marcos R.", role: "Director · Agencia de marketing", av: "M" },
        { q: "Lo que más me sorprende es cómo responde los comentarios. Suena exactamente como yo. Los clientes no saben que es IA.", name: "Ana C.", role: "CEO · E-commerce de moda", av: "A" },
      ],
    },
    cta: {
      h2a: "Tu competencia ya tiene equipo de marketing.",
      h2b: "Tú puedes tener algo mejor.",
      body: "Empieza en 15 minutos. Conecta tu primera red social, sube tu base de conocimiento y deja que SocialFlow diseñe tu primera campaña.",
      btn: "Activar mi sistema de marketing",
      trust: "14 días gratis · Sin tarjeta · Cancela cuando quieras",
    },
    footer: "Todos los derechos reservados.",
  },
  en: {
    nav: { login: "Sign in", cta: "Start free" },
    hero: {
      badge: "AI-powered marketing operating system",
      h1a: "The AI that runs your marketing",
      h1b: "while you focus on your business.",
      sub: "SocialFlow learns who you are, creates full campaigns, publishes automatically, replies to comments in your voice, detects leads and analyzes results — without you lifting a finger.",
      cta: "Activate my marketing",
      ctaSub: "See how it works",
      trust: "No credit card · 14-day free trial · Cancel anytime",
      channels: "Connected to your channels",
    },
    stats: [
      { v: "10,000+", l: "Posts managed" },
      { v: "98%",     l: "Less time on marketing" },
      { v: "3.2×",    l: "Average engagement lift" },
    ],
    how: {
      badge: "How it works",
      h2: "From zero to autonomous marketing in 15 minutes",
      steps: [
        { n: "01", title: "Train your AI", body: "Connect your website, upload documents and define your voice. SocialFlow builds the mental model of your company and learns your commercial arguments.", tag: "One time only" },
        { n: "02", title: "Define a campaign", body: "Set the objective: launch a product, generate leads, grow your community. The AI designs the full campaign: copy, formats and a multi-channel calendar.", tag: "In minutes" },
        { n: "03", title: "The system runs itself", body: "Posts, replies in your voice, detects leads and measures sentiment. You receive reports. The AI executes.", tag: "24 / 7" },
      ],
    },
    caps: {
      badge: "Capabilities",
      h2: "A full marketing team, for €49/month",
      items: [
        { icon: "brain",    title: "Knows your business",      body: "Ingests your web, docs and FAQs to always respond in context." },
        { icon: "campaign", title: "Creates full campaigns",   body: "From objective to content calendar with copy and images. Automatic." },
        { icon: "publish",  title: "Publishes automatically",  body: "Picks the best time per social network and executes without intervention." },
        { icon: "reply",    title: "Replies in your voice",    body: "Handles DMs and comments using the real knowledge of your business." },
        { icon: "leads",    title: "Detects leads",            body: "Identifies purchase intent in real time and feeds your CRM." },
        { icon: "chart",    title: "Analyzes sentiment",       body: "Understand how your audience perceives every message. Adjust with data." },
      ],
    },
    pricing: {
      badge: "Pricing",
      h2: "Less than hiring someone",
      sub: "A social media manager in Europe costs €1,500–2,500/month. SocialFlow works 24/7 for a fraction of that.",
      cm: {
        label: "Social Media Manager",
        price: "~€1,800/mo",
        items: ["8 h/day, weekdays only", "No AI or automation", "Replies during office hours", "Vacation & sick days", "1 person, 1 brand"],
      },
      plans: [
        {
          name: "Creator", price: "€49", period: "/mo",
          desc: "For creators and personal brands who want professional marketing without a team.",
          features: ["1 brand with AI knowledge base", "Full campaign generation", "Auto-publishing on 3 channels", "Automatic replies in your voice", "Lead detection", "Sentiment analytics"],
          cta: "Start with Creator", hot: false,
        },
        {
          name: "Pro", price: "€99", period: "/mo",
          desc: "For agencies and teams managing multiple brands at scale.",
          features: ["Up to 5 brands with independent bases", "Unlimited AI campaigns", "Unlimited social channels", "Multi-account replies", "Lead pipeline + CRM", "Advanced analytics + export", "Campaign reports", "Priority support"],
          cta: "Start with Pro", hot: true,
        },
      ],
      trial: "14-day free trial on any plan · No credit card required",
    },
    testimonials: {
      badge: "What our customers say",
      items: [
        { q: "I went from posting once a week when I remembered, to having a 30-day calendar running by itself. My engagement grew 280% in two months.", name: "Laura M.", role: "Founder · Design Studio", av: "L" },
        { q: "I manage 4 clients with SocialFlow Pro. What used to take me 40 hours a month is now 3 hours of review. The ROI is immediate.", name: "Marcos R.", role: "Director · Marketing Agency", av: "M" },
        { q: "What surprises me most is how it replies to comments. It sounds exactly like me. Clients don't know it's AI.", name: "Ana C.", role: "CEO · Fashion E-commerce", av: "A" },
      ],
    },
    cta: {
      h2a: "Your competition already has a marketing team.",
      h2b: "You can have something better.",
      body: "Get started in 15 minutes. Connect your first social network, upload your knowledge base and let SocialFlow design your first campaign.",
      btn: "Activate my marketing system",
      trust: "14-day free trial · No card required · Cancel anytime",
    },
    footer: "All rights reserved.",
  },
} as const;

// ─── Icons ─────────────────────────────────────────────────────────────────────
function IconBrain() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42" />
    </svg>
  );
}
function IconCampaign() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
    </svg>
  );
}
function IconPublish() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
    </svg>
  );
}
function IconReply() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
    </svg>
  );
}
function IconLeads() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-4 w-4 flex-shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}
function IconX() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-4 w-4 flex-shrink-0 text-slate-400">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

function capIcon(icon: string) {
  switch (icon) {
    case "brain":    return <IconBrain />;
    case "campaign": return <IconCampaign />;
    case "publish":  return <IconPublish />;
    case "reply":    return <IconReply />;
    case "leads":    return <IconLeads />;
    default:         return <IconChart />;
  }
}

// Gradient accent colours per capability card
const CAP_GRAD = [
  "from-violet-500 to-purple-600",
  "from-fuchsia-500 to-pink-600",
  "from-blue-500 to-indigo-600",
  "from-cyan-400 to-blue-500",
  "from-emerald-400 to-teal-500",
  "from-orange-400 to-pink-500",
];

// Social network logos (inline SVG - simplified but recognisable)
function LogoInstagram({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  );
}
function LogoLinkedIn({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  );
}
function LogoTikTok({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
    </svg>
  );
}
function LogoX({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}
function LogoFacebook({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function LandingClient() {
  const [lang, setLang] = useState<Lang>("es");
  const t = COPY[lang];

  return (
    <div className="min-h-screen overflow-x-hidden font-sans antialiased">

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-[#030312]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-lg font-black tracking-tight text-white">
            Social<span className="sf-shimmer-text">Flow</span>
          </span>
          <div className="flex items-center gap-2">
            {/* Lang toggle */}
            <div className="flex overflow-hidden rounded-lg border border-white/10 bg-white/5">
              {(["es", "en"] as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                    lang === l
                      ? "bg-white/10 text-white"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <Link
              href="/socialflow/auth"
              className="hidden text-sm font-medium text-white/60 hover:text-white transition-colors sm:block px-3 py-2"
            >
              {t.nav.login}
            </Link>
            <Link
              href="/socialflow/auth"
              className="rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:shadow-violet-500/40 hover:brightness-110"
            >
              {t.nav.cta}
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen overflow-hidden bg-[#030312] pt-20">
        {/* Gradient orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="sf-orb-1 absolute left-[-10%] top-[10%] h-[600px] w-[600px] rounded-full bg-violet-600/25 blur-[120px]" />
          <div className="sf-orb-2 absolute right-[-10%] top-[30%] h-[500px] w-[500px] rounded-full bg-fuchsia-600/20 blur-[120px]" />
          <div className="sf-orb-3 absolute bottom-[5%] left-[30%] h-[400px] w-[400px] rounded-full bg-blue-600/20 blur-[100px]" />
        </div>
        {/* Dot grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px)", backgroundSize: "32px 32px" }}
        />

        <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-24 text-center">
          {/* Badge */}
          <div className="fade-in-up mb-8 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-2">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
            <span className="text-xs font-semibold uppercase tracking-widest text-violet-300">
              {t.hero.badge}
            </span>
          </div>

          {/* Headline */}
          <h1 className="fade-in-up delay-100 mx-auto max-w-4xl text-5xl font-black leading-[1.05] tracking-tight text-white md:text-6xl lg:text-7xl">
            {t.hero.h1a}{" "}
            <span className="sf-shimmer-text">{t.hero.h1b}</span>
          </h1>

          {/* Sub */}
          <p className="fade-in-up delay-200 mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-white/60">
            {t.hero.sub}
          </p>

          {/* CTAs */}
          <div className="fade-in-up delay-300 mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/socialflow/auth"
              className="group relative rounded-xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 px-8 py-3.5 text-sm font-bold text-white shadow-xl shadow-violet-500/25 transition-all hover:shadow-violet-500/50 hover:brightness-110"
            >
              <span className="relative">{t.hero.cta}</span>
            </Link>
            <a
              href="#how"
              className="rounded-xl border border-white/15 bg-white/5 px-8 py-3.5 text-sm font-semibold text-white/80 backdrop-blur-sm transition hover:border-white/30 hover:text-white"
            >
              {t.hero.ctaSub}
            </a>
          </div>
          <p className="fade-in-up delay-400 mt-4 text-xs text-white/30">{t.hero.trust}</p>

          {/* Social channels */}
          <div className="fade-in-up delay-500 mt-14 flex flex-wrap items-center justify-center gap-3">
            <span className="text-xs font-medium uppercase tracking-widest text-white/30">{t.hero.channels}</span>
            {[
              { label: "Instagram", logo: <LogoInstagram />, color: "from-pink-500 to-fuchsia-600" },
              { label: "LinkedIn",  logo: <LogoLinkedIn />,  color: "from-blue-500 to-blue-700" },
              { label: "TikTok",    logo: <LogoTikTok />,    color: "from-slate-700 to-slate-900" },
              { label: "X",         logo: <LogoX />,         color: "from-slate-600 to-slate-800" },
              { label: "Facebook",  logo: <LogoFacebook />,  color: "from-blue-600 to-blue-800" },
            ].map(({ label, logo, color }) => (
              <span
                key={label}
                className={`flex items-center gap-1.5 rounded-full bg-gradient-to-r ${color} px-3 py-1.5 text-xs font-semibold text-white shadow-lg`}
              >
                {logo} {label}
              </span>
            ))}
          </div>

          {/* Floating dashboard mockup */}
          <div className="sf-float fade-in-up delay-500 mx-auto mt-20 max-w-3xl">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d1a] shadow-2xl shadow-violet-900/30">
              {/* Window bar */}
              <div className="flex items-center gap-2 border-b border-white/5 bg-white/5 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
                <span className="ml-4 text-xs text-white/30">SocialFlow — Dashboard</span>
              </div>
              {/* Mock UI */}
              <div className="p-6">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {["Publicaciones hoy", "Leads detectados", "Engagement"].map((label, i) => (
                    <div key={label} className="rounded-xl border border-white/5 bg-white/5 p-3">
                      <p className="text-[10px] text-white/40 mb-1">{label}</p>
                      <p className={`text-lg font-black ${i === 0 ? "text-violet-400" : i === 1 ? "text-fuchsia-400" : "text-blue-400"}`}>
                        {i === 0 ? "12" : i === 1 ? "3" : "↑ 4.2%"}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  {[
                    { time: "10:00", net: "IG", msg: "Nuevo lanzamiento de producto", status: "published", color: "bg-violet-500/20 text-violet-300" },
                    { time: "14:30", net: "LK", msg: "Artículo de industria: tendencias IA", status: "scheduled", color: "bg-blue-500/20 text-blue-300" },
                    { time: "18:00", net: "TK", msg: "Behind the scenes del equipo", status: "generating", color: "bg-fuchsia-500/20 text-fuchsia-300" },
                  ].map((item) => (
                    <div key={item.time} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/3 px-3 py-2">
                      <span className="text-xs text-white/30 w-10 shrink-0">{item.time}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${item.color}`}>{item.net}</span>
                      <span className="text-xs text-white/60 flex-1 truncate">{item.msg}</span>
                      <span className={`text-[10px] ${item.status === "published" ? "text-emerald-400" : item.status === "generating" ? "text-fuchsia-400 animate-pulse" : "text-white/30"}`}>
                        {item.status === "published" ? "✓ publicado" : item.status === "generating" ? "⚡ generando…" : "⏱ programado"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS TICKER ────────────────────────────────────────────────── */}
      <div className="border-y border-white/5 bg-[#0d0d1a] py-5 overflow-hidden">
        <div className="flex gap-0 sf-ticker-track whitespace-nowrap">
          {[...Array(2)].map((_, pass) => (
            <div key={pass} className="flex shrink-0 items-center gap-16 px-8">
              {t.stats.map((s) => (
                <div key={s.l} className="flex items-baseline gap-3">
                  <span className="text-3xl font-black sf-shimmer-text">{s.v}</span>
                  <span className="text-sm text-white/40">{s.l}</span>
                </div>
              ))}
              <span className="text-white/10 text-2xl font-light">·</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ────────────────────────────────────────────────── */}
      <section id="how" className="bg-[#030312] py-24">
        <div className="mx-auto max-w-6xl px-6">
          <SectionLabel dark>{t.how.badge}</SectionLabel>
          <h2 className="mt-4 text-center text-3xl font-black tracking-tight text-white md:text-5xl">
            {t.how.h2}
          </h2>
          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {t.how.steps.map((step, i) => (
              <article
                key={step.n}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-8 transition hover:border-violet-500/40 hover:bg-white/8"
              >
                {/* Large step number */}
                <span
                  className="absolute right-4 top-4 text-[80px] font-black leading-none text-white/5 select-none transition group-hover:text-white/8"
                  aria-hidden
                >
                  {step.n}
                </span>
                {/* Step dot indicator */}
                <div className="mb-6 flex items-center gap-3">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${
                    i === 0 ? "bg-violet-500" : i === 1 ? "bg-fuchsia-500" : "bg-blue-500"
                  }`}>
                    {step.n}
                  </span>
                  <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    i === 0 ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
                    : i === 1 ? "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300"
                    : "border-blue-500/30 bg-blue-500/10 text-blue-300"
                  }`}>
                    {step.tag}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                <p className="text-sm leading-relaxed text-white/55">{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── CAPABILITIES ────────────────────────────────────────────────── */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-6xl px-6">
          <SectionLabel>{t.caps.badge}</SectionLabel>
          <h2 className="mt-4 text-center text-3xl font-black tracking-tight text-slate-900 md:text-5xl">
            {t.caps.h2}
          </h2>
          <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {t.caps.items.map((cap, i) => (
              <article
                key={cap.title}
                className="group rounded-2xl border border-slate-100 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-lg hover:border-slate-200"
              >
                <div className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${CAP_GRAD[i]} text-white shadow-lg`}>
                  {capIcon(cap.icon)}
                </div>
                <h3 className="mb-2 text-base font-bold text-slate-900">{cap.title}</h3>
                <p className="text-sm leading-relaxed text-slate-500">{cap.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ─────────────────────────────────────────────────────── */}
      <section id="pricing" className="bg-[#030312] py-24">
        <div className="mx-auto max-w-6xl px-6">
          <SectionLabel dark>{t.pricing.badge}</SectionLabel>
          <h2 className="mt-4 text-center text-3xl font-black tracking-tight text-white md:text-5xl">
            {t.pricing.h2}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-sm text-white/50">{t.pricing.sub}</p>

          <div className="mt-16 grid gap-6 lg:grid-cols-3">
            {/* CM Column */}
            <article className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-8">
              <div className="mb-4 inline-flex w-fit items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-400">
                <span>⚠</span> {t.pricing.cm.label}
              </div>
              <div className="mt-2 mb-6">
                <span className="text-4xl font-black text-white/40">{t.pricing.cm.price}</span>
              </div>
              <ul className="flex-1 space-y-3">
                {t.pricing.cm.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-white/40">
                    <IconX /> {item}
                  </li>
                ))}
              </ul>
            </article>

            {/* Creator */}
            <PricingCard plan={t.pricing.plans[0]} />
            {/* Pro */}
            <PricingCard plan={t.pricing.plans[1]} />
          </div>

          <p className="mt-8 text-center text-xs text-white/30">{t.pricing.trial}</p>
        </div>
      </section>

      {/* ── TESTIMONIALS ────────────────────────────────────────────────── */}
      <section className="bg-[#080814] py-24">
        <div className="mx-auto max-w-6xl px-6">
          <SectionLabel dark>{t.testimonials.badge}</SectionLabel>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {t.testimonials.items.map((item) => (
              <article
                key={item.name}
                className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-8 transition hover:border-violet-500/30"
              >
                <blockquote className="flex-1 text-sm leading-relaxed text-white/70 italic">
                  &ldquo;{item.q}&rdquo;
                </blockquote>
                <div className="mt-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-black text-white">
                    {item.av}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{item.name}</p>
                    <p className="text-xs text-white/40">{item.role}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-600 py-28">
        {/* Noise overlay */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }}
        />
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-4xl font-black text-white leading-tight md:text-6xl">
            {t.cta.h2a}<br />{t.cta.h2b}
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-white/75">{t.cta.body}</p>
          <Link
            href="/socialflow/auth"
            className="mt-10 inline-flex items-center gap-2 rounded-xl bg-white px-10 py-4 text-base font-bold text-violet-700 shadow-2xl shadow-black/20 transition hover:brightness-95 hover:-translate-y-0.5"
          >
            {t.cta.btn}
          </Link>
          <p className="mt-4 text-sm text-white/50">{t.cta.trust}</p>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 bg-[#030312] py-10">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-base font-black tracking-tight text-white">
            Social<span className="sf-shimmer-text">Flow</span>
          </span>
          <p className="text-xs text-white/25">
            © {new Date().getFullYear()} SocialFlow by Drako Systems · {t.footer}
          </p>
          <Link href="/socialflow/auth" className="text-xs text-white/40 hover:text-white/70 transition-colors">
            {t.nav.login}
          </Link>
        </div>
      </footer>
    </div>
  );
}

// ─── Helper components ─────────────────────────────────────────────────────────
function SectionLabel({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <p className={`text-center text-xs font-bold uppercase tracking-[0.25em] ${dark ? "text-violet-400" : "text-violet-600"}`}>
      {children}
    </p>
  );
}

function PricingCard({ plan }: {
  plan: {
    name: string; price: string; period: string; desc: string;
    features: readonly string[]; cta: string; hot: boolean;
  };
}) {
  return (
    <article
      className={`relative flex flex-col rounded-2xl p-8 ${
        plan.hot
          ? "bg-gradient-to-b from-violet-600 to-fuchsia-700 shadow-2xl shadow-violet-500/30"
          : "border border-white/10 bg-white/5"
      }`}
    >
      {plan.hot && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-white px-4 py-1 text-xs font-black text-violet-700 shadow-lg">
          ★ Más popular
        </span>
      )}
      <h3 className="text-xl font-black text-white">{plan.name}</h3>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-5xl font-black text-white">{plan.price}</span>
        <span className={`text-sm font-medium ${plan.hot ? "text-white/70" : "text-white/40"}`}>{plan.period}</span>
      </div>
      <p className={`mt-3 text-sm ${plan.hot ? "text-white/80" : "text-white/50"}`}>{plan.desc}</p>
      <ul className="mt-6 flex-1 space-y-2.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-white/80">
            <span className={plan.hot ? "text-white" : "text-violet-400"}><IconCheck /></span>
            {f}
          </li>
        ))}
      </ul>
      <Link
        href="/socialflow/auth"
        className={`mt-8 inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-bold transition ${
          plan.hot
            ? "bg-white text-violet-700 hover:brightness-95"
            : "border border-white/20 bg-white/10 text-white hover:bg-white/15"
        }`}
      >
        {plan.cta}
      </Link>
    </article>
  );
}
