/**
 * socialcors.com — Casa central del ecosistema social de Drako
 *
 * Este dominio es el hub/holding de todos los SaaS del ecosistema
 * que tienen una base social. No aloja el SaaS directamente —
 * presenta la cartera de productos y dirige a cada uno.
 *
 * Arquitectura de dominios:
 *  - socialcors.com          → esta página (hub social)
 *  - drako.systems       → SaaS de gestión de redes sociales (community manager)
 *  - mentoria.socialcors.com → plataforma educativa con IA
 *  - cadul.socialcors.com    → gestión de reclamaciones legales
 *  - [futuros].socialcors.com → más SaaS sociales del ecosistema
 */

import Link from 'next/link';

const LOGO_SOCIALCORS = 'https://pub-3e782268d66e465bbe7c7fa767074ee2.r2.dev/assets/logo-cabecera.png';
const LOGO_DRAKO = 'https://pub-3e782268d66e465bbe7c7fa767074ee2.r2.dev/assets/logo%20drako.png';

const PRODUCTS = [
  {
    slug: 'community-manager',
    name: 'Community Manager IA',
    tagline: 'Gestión autónoma de redes sociales',
    description:
      'El Cerebro: 26 agentes de IA que analizan tu audiencia, crean contenido viral adaptado a tu nicho y publican solos. Para autónomos, pymes e influencers.',
    href: 'https://drako.systems',
    cta: 'Empezar gratis',
    badge: 'En producción',
    badgeColor: 'bg-emerald-100 text-emerald-700',
    networks: ['Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'YouTube', 'X'],
    accent: '#3b82f6',
  },
  {
    slug: 'mentoria',
    name: 'Mentoría IA',
    tagline: 'Apoyo educativo personalizado',
    description:
      'Tutores de IA especializados en matemáticas, física, idiomas y programación. Seguimiento de rendimiento y comunicación con padres por WhatsApp.',
    href: 'https://mentoria.socialcors.com',
    cta: 'Próximamente',
    badge: 'En desarrollo',
    badgeColor: 'bg-blue-100 text-blue-700',
    networks: ['WhatsApp', 'Email', 'Web'],
    accent: '#06b6d4',
  },
  {
    slug: 'cadul',
    name: 'Cadul',
    tagline: 'Reclamaciones legales con IA',
    description:
      'Gestiona reclamaciones legales de forma autónoma. Análisis de casos, redacción de documentos, seguimiento de plazos y escalado automático a acción colectiva.',
    href: 'https://cadul.socialcors.com',
    cta: 'Próximamente',
    badge: 'En desarrollo',
    badgeColor: 'bg-blue-100 text-blue-700',
    networks: ['Email', 'Web', 'BOE'],
    accent: '#3b82f6',
  },
];

const STATS = [
  { value: '26', label: 'Agentes de IA activos' },
  { value: '6', label: 'Redes sociales gestionadas' },
  { value: '3', label: 'SaaS en el ecosistema' },
  { value: '∞', label: 'Posibilidades' },
];

export default function SocialCorsHubPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans">

      {/* ── Navbar ── */}
      <header className="w-full bg-white/90 backdrop-blur-md border-b border-slate-100 sticky top-0 z-50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img
              src={LOGO_SOCIALCORS}
              alt="SocialCors"
              width={1536}
              height={1024}
              className="h-9 w-auto object-contain"
            />
            <span className="text-xs font-semibold text-slate-400 hidden sm:block tracking-wide uppercase">
              Ecosistema Social
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#productos" className="hover:text-blue-600 transition-colors">Productos</a>
            <a href="#ecosistema" className="hover:text-blue-600 transition-colors">Ecosistema</a>
            <Link href="https://drako.systems" className="hover:text-blue-600 transition-colors">
              drako.systems
            </Link>
          </nav>

          <Link
            href="https://drako.systems"
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
          >
            Acceder al SaaS →
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">

        {/* Badge Drako */}
        <div className="flex justify-center mb-6">
          <a
            href="https://drako.systems"
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors text-xs font-semibold text-slate-600"
          >
            <img src={LOGO_DRAKO} alt="Drako" className="h-4 w-auto" />
            Un producto del ecosistema Drako
          </a>
        </div>

        <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight mb-6">
          La casa de los SaaS<br />
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(135deg, #3b82f6, #06b6d4)' }}
          >
            con base social.
          </span>
        </h1>

        <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed mb-10">
          SocialCors es el hub del ecosistema Drako para todos los productos
          que conectan personas, comunidades y negocios mediante inteligencia artificial.
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto mb-12">
          {STATS.map((s) => (
            <div key={s.label} className="bg-slate-50 rounded-2xl p-5 text-center">
              <div className="text-3xl font-extrabold text-blue-600">{s.value}</div>
              <div className="text-xs text-slate-500 mt-1 font-medium">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Hero CTA */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="https://drako.systems"
            className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-base rounded-2xl shadow-lg shadow-blue-100 transition-all"
          >
            Probar Community Manager IA →
          </Link>
          <a
            href="#productos"
            className="px-8 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-base rounded-2xl transition-all"
          >
            Ver todos los productos
          </a>
        </div>
      </section>

      {/* ── Separador con efecto ── */}
      <div className="w-full h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent mx-auto max-w-4xl" />

      {/* ── Productos ── */}
      <section id="productos" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <span className="text-xs font-bold tracking-widest text-blue-500 uppercase">
            Ecosistema Social
          </span>
          <h2 className="text-4xl font-extrabold text-slate-900 mt-3">
            Todos los productos
          </h2>
          <p className="text-slate-500 mt-3 max-w-xl mx-auto">
            Cada SaaS resuelve un problema concreto. Todos comparten la misma
            infraestructura de IA y aprenden del ecosistema compartido.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {PRODUCTS.map((p) => (
            <div
              key={p.slug}
              className="group relative bg-white border border-slate-100 rounded-3xl p-8 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col"
            >
              {/* Glow en hover */}
              <div
                className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-5 transition-opacity"
                style={{ background: `radial-gradient(circle at 50% 0%, ${p.accent}, transparent 70%)` }}
              />

              {/* Badge estado */}
              <span className={`self-start text-xs font-semibold px-3 py-1 rounded-full mb-5 ${p.badgeColor}`}>
                {p.badge}
              </span>

              {/* Nombre + tagline */}
              <h3 className="text-xl font-extrabold text-slate-900 mb-1">{p.name}</h3>
              <p className="text-sm font-semibold mb-3" style={{ color: p.accent }}>{p.tagline}</p>

              {/* Descripción */}
              <p className="text-sm text-slate-500 leading-relaxed mb-6 flex-1">
                {p.description}
              </p>

              {/* Canales/redes */}
              <div className="flex flex-wrap gap-2 mb-7">
                {p.networks.map((n) => (
                  <span
                    key={n}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600"
                  >
                    {n}
                  </span>
                ))}
              </div>

              {/* CTA */}
              <a
                href={p.href}
                className="w-full text-center py-3 rounded-xl text-sm font-bold transition-all"
                style={
                  p.badge === 'En producción'
                    ? { background: p.accent, color: '#fff' }
                    : { background: '#f1f5f9', color: '#64748b', cursor: 'default' }
                }
              >
                {p.cta}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* ── Ecosistema Drako ── */}
      <section
        id="ecosistema"
        className="w-full py-20 px-6"
        style={{ background: 'linear-gradient(135deg, #f0f9ff 0%, #f8fafc 50%, #f0fdf4 100%)' }}
      >
        <div className="max-w-6xl mx-auto text-center">
          <span className="text-xs font-bold tracking-widest text-cyan-500 uppercase">
            Drako Holding
          </span>
          <h2 className="text-4xl font-extrabold text-slate-900 mt-3 mb-4">
            Más allá de lo social
          </h2>
          <p className="text-slate-500 max-w-xl mx-auto mb-12">
            SocialCors es la casa de los SaaS sociales. Para fintech, inmobiliaria, cripto y
            más, existe{' '}
            <a href="https://drako.systems" className="text-blue-600 font-semibold hover:underline">
              drako.systems
            </a>{' '}
            — el holding tecnológico completo.
          </p>

          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-5 max-w-4xl mx-auto">
            {[
              { name: 'Community Manager IA', domain: 'drako.systems', icon: '🤖', live: true },
              { name: 'Crypto IA', domain: 'cryptos.drako.systems', icon: '₿', live: false },
              { name: 'Cazh', domain: 'cazh.drako.systems', icon: '💳', live: false },
              { name: 'Rentia', domain: 'rentia.drako.systems', icon: '🏠', live: false },
            ].map((item) => (
              <div
                key={item.name}
                className="bg-white rounded-2xl p-5 text-center border border-slate-100 shadow-sm"
              >
                <div className="text-3xl mb-3">{item.icon}</div>
                <div className="font-bold text-slate-900 text-sm mb-1">{item.name}</div>
                <div className="text-xs text-slate-400 font-mono">{item.domain}</div>
                <div className={`mt-3 text-xs font-semibold px-2 py-0.5 rounded-full inline-block ${item.live ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {item.live ? 'Activo' : 'Próximamente'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h2 className="text-4xl font-extrabold text-slate-900 mb-4">
          ¿Listo para automatizar<br />tus redes sociales?
        </h2>
        <p className="text-slate-500 max-w-lg mx-auto mb-8">
          El Community Manager IA de Drako ya está en producción.
          Empieza gratis y deja que el Cerebro trabaje por ti.
        </p>
        <Link
          href="https://drako.systems"
          className="inline-block px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg rounded-2xl shadow-lg shadow-blue-100 transition-all"
        >
          Empezar 15 días gratis →
        </Link>
        <p className="text-xs text-slate-400 mt-4">Sin tarjeta de crédito · Cancela cuando quieras</p>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-100 bg-slate-50 px-6 py-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src={LOGO_SOCIALCORS} alt="SocialCors" className="h-7 w-auto" />
            <span className="text-xs text-slate-400">Parte del ecosistema</span>
            <a href="https://drako.systems">
              <img src={LOGO_DRAKO} alt="Drako" className="h-5 w-auto opacity-60 hover:opacity-100 transition-opacity" />
            </a>
          </div>

          <nav className="flex flex-wrap justify-center gap-6 text-xs text-slate-500">
            <Link href="/aviso-legal" className="hover:text-slate-700">Aviso legal</Link>
            <Link href="/privacidad" className="hover:text-slate-700">Privacidad</Link>
            <Link href="/cookies" className="hover:text-slate-700">Cookies</Link>
            <Link href="/terminos" className="hover:text-slate-700">Términos</Link>
            <Link href="/contacto" className="hover:text-slate-700">Contacto</Link>
          </nav>

          <p className="text-xs text-slate-400">
            © 2026 Cristóbal Cors Bernal · SocialCors
          </p>
        </div>
      </footer>

    </div>
  );
}
