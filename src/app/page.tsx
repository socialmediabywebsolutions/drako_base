import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Space_Grotesk } from "next/font/google";
import { HostMode, resolveHostMode } from "@/lib/hosts";
import { resolveMarketingLocale, defaultMarketingLocale } from "@/lib/i18n/marketing";
import { StatCounter } from "@/components/marketing/home/StatCounter";

const sg = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--sg",
  display: "swap",
});

const LOGO =
  "https://pub-3e782268d66e465bbe7c7fa767074ee2.r2.dev/assets/logo%20drako.png";

const isHostMode = (v: string | null): v is HostMode =>
  v === "CAMPAMENTO_BASE" || v === "PREVIEW" || v === "PUBLIC_SAAS";

export default async function HomePage(_props?: { params?: Promise<{ locale?: string }> }) {
  const hdrs = await headers();
  const host = hdrs.get("x-drako-effective-host") ?? hdrs.get("host") ?? "";
  const headerMode = hdrs.get("x-drako-host-mode");
  const hostMode = isHostMode(headerMode) ? headerMode : resolveHostMode(host);
  if (hostMode === "CAMPAMENTO_BASE") redirect("/admin");

  const locale = resolveMarketingLocale(undefined) ?? defaultMarketingLocale;

  return (
    <div className={sg.variable} id="drako">
      <style>{`
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        :root {
          --b: #3b82f6;
          --b2: #1d4ed8;
          --c: #06b6d4;
          --c2: #0891b2;
          --ink: #0a0f1e;
          --ink2: #4a5568;
          --f: 'Space Grotesk', system-ui, sans-serif;
        }
        html { scroll-behavior: smooth; }
        body { font-family: var(--f); background: #fff; color: var(--ink); -webkit-font-smoothing: antialiased; overflow-x: hidden; }

        /* ─── NAV ─────────────────────────────────────────────── */
        #nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 200;
          height: 60px; padding: 0 6vw;
          display: flex; align-items: center; justify-content: space-between;
          background: rgba(255,255,255,.9); backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(0,0,0,.06);
        }
        #nav-logo { display:flex; align-items:center; gap:9px; text-decoration:none; }
        #nav-logo b { font-size:1.1rem; font-weight:800; letter-spacing:-.03em; color:var(--ink); }
        #nav-r { display:flex; align-items:center; gap:2.25rem; }
        #nav-r a { font-size:.875rem; font-weight:500; color:var(--ink2); text-decoration:none; transition:color .18s; }
        #nav-r a:hover { color:var(--b); }
        .nb {
          background:var(--b); color:#fff !important;
          padding:.42rem 1.1rem; border-radius:8px;
          font-weight:700 !important; font-size:.875rem !important;
          transition:background .18s, transform .15s !important;
          box-shadow: 0 2px 12px rgba(59,130,246,.35);
        }
        .nb:hover { background:var(--b2) !important; transform:translateY(-1px); }

        /* ─── HERO ────────────────────────────────────────────── */
        #hero {
          min-height: 100svh;
          padding: 60px 6vw 0;
          display: flex; align-items: center;
          position: relative; overflow: hidden;
          background: #fff;
        }
        #hero-orb {
          position: absolute; right: -8vw; top: 50%; transform: translateY(-50%);
          width: clamp(480px, 55vw, 820px);
          height: clamp(480px, 55vw, 820px);
          border-radius: 50%;
          background: conic-gradient(from 0deg, #3b82f6, #06b6d4, #0891b2, #1d4ed8, #3b82f6);
          opacity: .13;
          animation: spin 22s linear infinite;
          filter: blur(2px);
          pointer-events: none;
        }
        @keyframes spin { to { transform: translateY(-50%) rotate(360deg); } }
        #hero-orb2 {
          position: absolute; right: 2vw; top: 50%; transform: translateY(-50%);
          width: clamp(300px, 34vw, 520px);
          height: clamp(300px, 34vw, 520px);
          border-radius: 50%;
          background: radial-gradient(circle at 35% 45%, rgba(6,182,212,.22), rgba(59,130,246,.16) 55%, transparent 75%);
          pointer-events: none;
          animation: breathe 6s ease-in-out infinite;
        }
        @keyframes breathe {
          0%,100% { transform:translateY(-50%) scale(1); opacity:.9; }
          50% { transform:translateY(-50%) scale(1.06); opacity:1; }
        }
        #hero-content { position:relative; z-index:2; max-width: 720px; }
        #hero-flag {
          display:inline-flex; align-items:center; gap:.5rem;
          border: 1.5px solid rgba(6,182,212,.4);
          color: var(--c2); font-size:.78rem; font-weight:700;
          letter-spacing:.07em; text-transform:uppercase;
          padding:.28rem .9rem; border-radius:100px; margin-bottom:2rem;
          background: rgba(6,182,212,.05);
        }
        #hero-flag span { width:7px; height:7px; border-radius:50%; background:var(--c); animation:pulse 2s infinite; display:block; }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.5)} }
        #hero h1 {
          font-size: clamp(3rem, 6.5vw, 5.5rem);
          font-weight: 800;
          letter-spacing: -.04em;
          line-height: 1.02;
          color: var(--ink);
          margin-bottom: 1.5rem;
        }
        #hero h1 em { font-style:normal; color:var(--b); }
        #hero h1 strong { font-style:normal; color:var(--c); font-weight:800; }
        #hero-sub {
          font-size:1.15rem; color:var(--ink2); line-height:1.7;
          max-width:520px; margin-bottom:2.5rem; font-weight:400;
        }
        #hero-acts { display:flex; gap:1rem; flex-wrap:wrap; align-items:center; }
        .ha {
          display:inline-flex; align-items:center; gap:.4rem;
          padding:.78rem 1.9rem; border-radius:12px;
          font-size:1rem; font-weight:700;
          text-decoration:none; transition:all .2s;
        }
        .ha-p { background:var(--b); color:#fff; box-shadow:0 4px 20px rgba(59,130,246,.38); }
        .ha-p:hover { background:var(--b2); transform:translateY(-2px); box-shadow:0 8px 28px rgba(59,130,246,.45); }
        .ha-s { background:rgba(6,182,212,.08); color:var(--c2); border:2px solid rgba(6,182,212,.3); }
        .ha-s:hover { background:rgba(6,182,212,.14); transform:translateY(-2px); }
        #hero-scroll {
          position:absolute; bottom:2.5rem; left:50%; transform:translateX(-50%);
          display:flex; flex-direction:column; align-items:center; gap:.5rem;
          opacity:.45; animation:bobble 2s ease-in-out infinite;
        }
        #hero-scroll span { font-size:.72rem; letter-spacing:.1em; text-transform:uppercase; font-weight:600; }
        #hero-scroll svg { width:18px; }
        @keyframes bobble { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(5px)} }

        /* ─── HOLDING STRIP ─────────────────────────────────────── */
        #strip {
          background: var(--ink);
          padding: 4.5rem 6vw;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0;
        }
        .sn {
          padding: 0 2.5rem;
          border-right: 1px solid rgba(255,255,255,.08);
          text-align: center;
        }
        .sn:first-child { padding-left:0; }
        .sn:last-child { border-right:none; padding-right:0; }
        .sn-val {
          font-size: clamp(2.8rem,4.5vw,4rem);
          font-weight:900; letter-spacing:-.05em; line-height:1;
          background: linear-gradient(135deg, #fff 40%, var(--c));
          -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
        }
        .sn:nth-child(even) .sn-val {
          background: linear-gradient(135deg, var(--c), #fff);
          -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
        }
        .sn-lbl { font-size:.8rem; color:rgba(255,255,255,.45); font-weight:500; margin-top:.5rem; letter-spacing:.04em; }

        /* ─── PORTFOLIO ───────────────────────────────────────── */
        #portfolio { padding: 7rem 6vw; background:#fff; }
        #portfolio-hd { margin-bottom:4rem; }
        #portfolio-hd .pl { font-size:.72rem; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:var(--c2); margin-bottom:.75rem; }
        #portfolio-hd h2 {
          font-size:clamp(2rem,3.5vw,3rem); font-weight:800;
          letter-spacing:-.04em; line-height:1.08; color:var(--ink);
        }
        #plist { display:flex; flex-direction:column; gap:0; }
        .prow {
          display:grid; grid-template-columns: 80px 1fr 1fr auto;
          align-items:center; gap:2rem; padding:1.75rem 0;
          border-bottom:1px solid rgba(0,0,0,.07);
          text-decoration:none; color:inherit;
          transition:background .2s, padding .2s;
          border-radius:12px;
          position:relative;
        }
        .prow::before {
          content:''; position:absolute; left:0; top:0; bottom:0; width:3px;
          border-radius:2px;
          background:linear-gradient(to bottom,var(--b),var(--c));
          opacity:0; transition:opacity .2s;
        }
        .prow:hover { background:rgba(59,130,246,.03); padding-left:1.25rem; }
        .prow:hover::before { opacity:1; }
        .prow-n {
          font-size:2.5rem; font-weight:900; letter-spacing:-.06em;
          color:rgba(0,0,0,.07); line-height:1; text-align:center;
        }
        .prow-name { font-size:1.35rem; font-weight:800; letter-spacing:-.03em; color:var(--ink); }
        .prow-sub { font-size:.875rem; color:var(--ink2); margin-top:.2rem; }
        .prow-sector { font-size:.8rem; font-weight:600; color:var(--c2); letter-spacing:.05em; text-transform:uppercase; }
        .prow-tag {
          font-size:.72rem; font-weight:700; letter-spacing:.06em;
          padding:.28rem .8rem; border-radius:100px; text-transform:uppercase; white-space:nowrap;
        }
        .t-live { background:rgba(6,182,212,.1); color:var(--c2); border:1px solid rgba(6,182,212,.3); }
        .t-beta { background:rgba(59,130,246,.08); color:var(--b); border:1px solid rgba(59,130,246,.2); }
        .t-soon { background:rgba(0,0,0,.04); color:#94a3b8; border:1px solid rgba(0,0,0,.08); }
        .prow-arr { font-size:1.25rem; color:rgba(0,0,0,.15); transition:color .2s, transform .2s; }
        .prow:hover .prow-arr { color:var(--b); transform:translateX(4px); }

        /* ─── ARCHITECTURE ────────────────────────────────────── */
        #arch {
          background: #f7faff;
          padding: 7rem 6vw;
          overflow:hidden;
        }
        #arch-hd { margin-bottom: 4rem; }
        #arch-hd .pl { font-size:.72rem; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:var(--b); margin-bottom:.75rem; }
        #arch-hd h2 { font-size:clamp(2rem,3.5vw,3rem); font-weight:800; letter-spacing:-.04em; line-height:1.08; color:var(--ink); }
        #arch-grid { display:grid; grid-template-columns:1fr 1fr; gap:5rem; align-items:center; }
        #arch-diagram {
          position:relative; height:380px;
          display:flex; align-items:center; justify-content:center;
        }
        .arc-center {
          width:100px; height:100px; border-radius:50%;
          background:linear-gradient(135deg,var(--b),var(--c));
          display:flex; align-items:center; justify-content:center;
          position:relative; z-index:2;
          box-shadow:0 0 0 12px rgba(59,130,246,.1), 0 0 0 24px rgba(6,182,212,.06);
        }
        .arc-center img { width:44px; height:44px; object-fit:contain; filter:brightness(0) invert(1); }
        .arc-orbit {
          position:absolute; border-radius:50%;
          border:1.5px dashed rgba(59,130,246,.2);
          animation:orb-spin 20s linear infinite;
        }
        .arc-orbit:nth-child(2) { width:200px; height:200px; animation-duration:15s; }
        .arc-orbit:nth-child(3) { width:320px; height:320px; animation-duration:25s; animation-direction:reverse; }
        @keyframes orb-spin { to { transform:rotate(360deg); } }
        .arc-dot {
          position:absolute; top:50%; left:50%;
          width:46px; height:46px; margin:-23px 0 0 -23px;
          border-radius:50%;
          background:#fff;
          border:2px solid rgba(59,130,246,.25);
          display:flex; align-items:center; justify-content:center;
          font-size:.62rem; font-weight:800; color:var(--b); letter-spacing:.04em; text-align:center; text-transform:uppercase;
          box-shadow:0 2px 12px rgba(0,0,0,.08);
        }
        .d1 { transform:rotate(0deg) translateX(100px) rotate(0deg); }
        .d2 { transform:rotate(72deg) translateX(100px) rotate(-72deg); }
        .d3 { transform:rotate(144deg) translateX(100px) rotate(-144deg); }
        .d4 { transform:rotate(216deg) translateX(100px) rotate(-216deg); }
        .d5 { transform:rotate(288deg) translateX(100px) rotate(-288deg); }
        .d6 { transform:rotate(45deg) translateX(160px) rotate(-45deg); }
        .d7 { transform:rotate(165deg) translateX(160px) rotate(-165deg); }
        .d8 { transform:rotate(285deg) translateX(160px) rotate(-285deg); }
        #arch-text { }
        .arch-block { margin-bottom:2.25rem; display:flex; gap:1.25rem; align-items:flex-start; }
        .arch-ic {
          width:42px; height:42px; border-radius:10px; flex-shrink:0;
          display:flex; align-items:center; justify-content:center;
          font-size:1.2rem;
        }
        .arch-ic-b { background:rgba(59,130,246,.1); }
        .arch-ic-c { background:rgba(6,182,212,.1); }
        .arch-title { font-size:1rem; font-weight:700; color:var(--ink); margin-bottom:.3rem; }
        .arch-body { font-size:.875rem; color:var(--ink2); line-height:1.65; }

        /* ─── TURQUOISE BAND ─────────────────────────────────── */
        #tband {
          background:linear-gradient(135deg,var(--c2) 0%,var(--c) 50%,#22d3ee 100%);
          padding:5rem 6vw;
          display:grid; grid-template-columns:1fr 1fr; gap:4rem; align-items:center;
        }
        #tband h2 {
          font-size:clamp(1.9rem,3.5vw,2.8rem); font-weight:800;
          letter-spacing:-.04em; line-height:1.1; color:#fff;
          margin-bottom:1rem;
        }
        #tband p { font-size:1.05rem; color:rgba(255,255,255,.8); line-height:1.7; margin-bottom:2rem; }
        .tc-list { list-style:none; display:flex; flex-direction:column; gap:.9rem; }
        .tc-list li {
          display:flex; align-items:center; gap:.75rem;
          font-size:.9rem; color:#fff; font-weight:500;
        }
        .tc-list li::before {
          content:''; width:20px; height:20px; border-radius:50%;
          background:rgba(255,255,255,.25); flex-shrink:0;
          display:flex; align-items:center; justify-content:center;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='white'%3E%3Cpath fill-rule='evenodd' d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z' clip-rule='evenodd'/%3E%3C/svg%3E");
          background-size:11px; background-position:center; background-repeat:no-repeat;
        }
        #tband-right {
          background:rgba(255,255,255,.12);
          backdrop-filter:blur(10px);
          border-radius:20px; padding:2.5rem;
          border:1px solid rgba(255,255,255,.2);
        }
        .tbr-row { display:flex; align-items:center; gap:1rem; padding:.9rem 0; border-bottom:1px solid rgba(255,255,255,.12); }
        .tbr-row:last-child { border-bottom:none; padding-bottom:0; }
        .tbr-ic {
          width:40px; height:40px; border-radius:10px;
          background:rgba(255,255,255,.15); flex-shrink:0;
          display:flex; align-items:center; justify-content:center;
          font-size:1.1rem;
        }
        .tbr-name { font-size:.9rem; font-weight:700; color:#fff; }
        .tbr-sub { font-size:.78rem; color:rgba(255,255,255,.65); }
        .tbr-dot { width:8px; height:8px; border-radius:50%; background:#4ade80; margin-left:auto; flex-shrink:0; box-shadow:0 0 0 3px rgba(74,222,128,.25); }

        /* ─── CTA ─────────────────────────────────────────────── */
        #cta {
          background:var(--ink); padding:7rem 6vw; text-align:center;
          position:relative; overflow:hidden;
        }
        #cta::before {
          content:''; position:absolute; inset:0;
          background:radial-gradient(ellipse at 50% 0%, rgba(59,130,246,.2), transparent 65%);
          pointer-events:none;
        }
        #cta::after {
          content:''; position:absolute; left:50%; bottom:-80px; transform:translateX(-50%);
          width:600px; height:160px; border-radius:50%;
          background:rgba(6,182,212,.15);
          filter:blur(40px); pointer-events:none;
        }
        #cta h2 {
          position:relative; z-index:1;
          font-size:clamp(2.2rem,4.5vw,4rem); font-weight:800;
          letter-spacing:-.04em; line-height:1.05; color:#fff;
          max-width:700px; margin:0 auto 1.25rem;
        }
        #cta h2 span { color:var(--c); }
        #cta p { position:relative; z-index:1; font-size:1.1rem; color:rgba(255,255,255,.6); max-width:460px; margin:0 auto 2.75rem; line-height:1.7; }
        #cta-btns { position:relative; z-index:1; display:flex; gap:1rem; justify-content:center; flex-wrap:wrap; }
        .cb1 {
          display:inline-flex; align-items:center; gap:.5rem;
          background:var(--c); color:var(--ink);
          padding:.85rem 2.25rem; border-radius:12px;
          font-size:1rem; font-weight:800;
          text-decoration:none;
          transition:all .2s;
          box-shadow:0 4px 24px rgba(6,182,212,.4);
        }
        .cb1:hover { transform:translateY(-3px); box-shadow:0 10px 36px rgba(6,182,212,.5); }
        .cb2 {
          display:inline-flex; align-items:center; gap:.5rem;
          background:rgba(255,255,255,.08); color:rgba(255,255,255,.85);
          padding:.85rem 2.25rem; border-radius:12px;
          font-size:1rem; font-weight:700;
          text-decoration:none; border:1px solid rgba(255,255,255,.12);
          transition:all .2s;
        }
        .cb2:hover { background:rgba(255,255,255,.14); transform:translateY(-3px); }

        /* ─── FOOTER ─────────────────────────────────────────── */
        #ft {
          background:var(--ink); border-top:1px solid rgba(255,255,255,.06);
          padding:2.25rem 6vw;
          display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1.5rem;
        }
        #ft-brand { display:flex; align-items:center; gap:9px; }
        #ft-brand b { font-size:1rem; font-weight:800; color:#fff; }
        #ft-copy { font-size:.78rem; color:rgba(255,255,255,.3); }
        #ft-links { display:flex; gap:1.75rem; }
        #ft-links a { font-size:.78rem; color:rgba(255,255,255,.4); text-decoration:none; transition:color .18s; }
        #ft-links a:hover { color:var(--c); }

        /* ─── MARQUEE ────────────────────────────────────────── */
        #mq {
          overflow:hidden; padding:.85rem 0;
          border-top:1px solid rgba(6,182,212,.15);
          border-bottom:1px solid rgba(6,182,212,.15);
          background:rgba(6,182,212,.03);
        }
        #mq-track { display:flex; gap:3.5rem; animation:mq 30s linear infinite; width:max-content; }
        @keyframes mq { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        .mqi {
          font-size:.78rem; font-weight:700; letter-spacing:.08em; text-transform:uppercase;
          color:var(--c2); white-space:nowrap;
          display:flex; align-items:center; gap:.5rem;
        }
        .mqi::before { content:'◆'; font-size:.45rem; color:var(--c); }

        /* ─── REVEAL ─────────────────────────────────────────── */
        .rv { opacity:0; transform:translateY(32px); transition:opacity .6s ease, transform .6s ease; }
        .rv.vis { opacity:1; transform:none; }

        /* ─── RESPONSIVE ─────────────────────────────────────── */
        @media(max-width:768px){
          #nav-r a:not(.nb) { display:none; }
          #strip { grid-template-columns:1fr 1fr; gap:2rem; }
          .sn { border:none; padding:0; text-align:left; }
          #arch-grid { grid-template-columns:1fr; }
          #arch-diagram { height:280px; }
          #tband { grid-template-columns:1fr; }
          .prow { grid-template-columns:50px 1fr auto; }
          .prow-sector { display:none; }
          #cta-btns { flex-direction:column; align-items:center; }
          #ft { flex-direction:column; text-align:center; }
          #ft-links { justify-content:center; }
        }
        @media(prefers-reduced-motion:reduce){
          .rv { opacity:1; transform:none; transition:none; }
          #mq-track { animation:none; }
          #hero-orb, .arc-orbit { animation:none; }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav id="nav">
        <a id="nav-logo" href="#">
          <img src={LOGO} alt="Drako" width={32} height={32} style={{width:32,height:32,objectFit:"contain"}} />
          <b>Drako</b>
        </a>
        <div id="nav-r">
          <a href="#portfolio">Productos</a>
          <a href="#arch">Arquitectura</a>
          <a href="https://socialcors.com" className="nb">Empezar →</a>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section id="hero">
        <div id="hero-orb" aria-hidden />
        <div id="hero-orb2" aria-hidden />
        <div id="hero-content">
          <div id="hero-flag"><span />Holding tecnológico · IA</div>
          <h1>
            Construimos<br />
            empresas de <em>IA</em><br />
            que trabajan <strong>solas.</strong>
          </h1>
          <p id="hero-sub">
            Drako diseña, construye y escala software de inteligencia artificial
            que automatiza departamentos enteros. Múltiples productos.
            Una infraestructura. Inteligencia compartida.
          </p>
          <div id="hero-acts">
            <a href="https://socialcors.com" className="ha ha-p">Ver Socialcors →</a>
            <a href="#portfolio" className="ha ha-s">Explorar el ecosistema</a>
          </div>
        </div>
        <div id="hero-scroll" aria-hidden>
          <span>Scroll</span>
          <svg viewBox="0 0 18 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 5v14M3 13l6 6 6-6" />
          </svg>
        </div>
      </section>

      {/* ── MARQUEE ── */}
      <div id="mq" aria-hidden>
        <div id="mq-track">
          {[...Array(2)].map((_,i)=>(
            <div key={i} style={{display:"flex",gap:"3.5rem"}}>
              {["Publicación autónoma","Análisis de tendencias","Agentes IA","Gestión inmobiliaria","Tutores inteligentes","Crypto analytics","Wallet inteligente","Marketing autónomo","IA multiagente"].map(t=>(
                <span className="mqi" key={t}>{t}</span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── STRIP DE MÉTRICAS ── */}
      <div id="strip">
        {[
          {v:5, s:"x", l:"Más productividad"},
          {v:98, s:"%", l:"Ejecución autónoma"},
          {v:5, s:"", l:"Productos en desarrollo"},
          {v:24, s:"h", l:"IA activa sin parar"},
        ].map(m=>(
          <div className="sn rv" key={m.l}>
            <div className="sn-val"><StatCounter value={m.v} suffix={m.s} /></div>
            <div className="sn-lbl">{m.l}</div>
          </div>
        ))}
      </div>

      {/* ── PORTFOLIO ── */}
      <section id="portfolio">
        <div id="portfolio-hd" className="rv">
          <div className="pl">Ecosistema</div>
          <h2>Cinco empresas.<br />Una inteligencia.</h2>
        </div>
        <div id="plist">
          {[
            {n:"01", name:"Socialcors", sub:"Marketing en redes sociales que se gestiona solo — 30+ posts al mes sin intervención.", sector:"Social Media", tag:"Disponible", tc:"t-live", url:"https://socialcors.com"},
            {n:"02", name:"Mentoría", sub:"Tutor IA 24/7 para estudiantes. Seguimiento académico directo a padres por WhatsApp.", sector:"Educación", tag:"Beta", tc:"t-beta"},
            {n:"03", name:"Crypto IA", sub:"Análisis técnico completo con agentes especializados: señales, riesgo y backtesting.", sector:"Finanzas", tag:"En desarrollo", tc:"t-soon"},
            {n:"04", name:"Cazh", sub:"Wallet inteligente con transferencias, tarjetas virtuales y scoring financiero IA.", sector:"Pagos", tag:"En desarrollo", tc:"t-soon"},
            {n:"05", name:"Rentia", sub:"Gestión de alquileres automatizada: contratos, cobros, incidencias y evaluación de inquilinos.", sector:"Inmobiliario", tag:"En desarrollo", tc:"t-soon"},
          ].map(p=>(
            <a className="prow rv" key={p.name} href={p.url ?? "#"} target={p.url ? "_blank" : "_self"} rel="noopener">
              <div className="prow-n">{p.n}</div>
              <div>
                <div className="prow-name">{p.name}</div>
                <div className="prow-sub">{p.sub}</div>
              </div>
              <div className="prow-sector">{p.sector}</div>
              <div style={{display:"flex",alignItems:"center",gap:"1rem"}}>
                <span className={`prow-tag ${p.tc}`}>{p.tag}</span>
                <span className="prow-arr">→</span>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* ── ARQUITECTURA ── */}
      <section id="arch">
        <div id="arch-hd" className="rv">
          <div className="pl">Arquitectura</div>
          <h2>Un ecosistema<br />sin precedentes.</h2>
        </div>
        <div id="arch-grid">
          <div id="arch-diagram" aria-hidden>
            <div className="arc-orbit">
              {["SC","Men","Cry","Caz","Ren"].map((l,i)=>(
                <div className={`arc-dot d${i+1}`} key={l}>{l}</div>
              ))}
            </div>
            <div className="arc-orbit">
              {["CB","R2","D1","CF"].map((l,i)=>(
                <div className={`arc-dot d${i+6}`} key={l}>{l}</div>
              ))}
            </div>
            <div className="arc-center">
              <img src={LOGO} alt="Drako" />
            </div>
          </div>
          <div id="arch-text">
            {[
              {ic:"🔗", c:"arch-ic-b", t:"Productos 100% independientes", b:"Cada SaaS opera con su propia marca, base de datos y modelo de negocio. No hay conexiones directas entre ellos."},
              {ic:"🧠", c:"arch-ic-c", t:"Inteligencia compartida", b:"Lo que aprende un agente en Socialcors puede beneficiar a Mentoría. La experiencia acumulada es un activo del holding."},
              {ic:"⚡", c:"arch-ic-b", t:"Infraestructura edge global", b:"Cloudflare Workers + D1 + R2. Cero servidores que mantener, latencia de milisegundos en cualquier continente."},
              {ic:"🔒", c:"arch-ic-c", t:"Aislamiento total de datos", b:"Multi-tenant con Row-Level Security. Los datos de un cliente nunca se mezclan con los de otro, nunca."},
            ].map(a=>(
              <div className="arch-block rv" key={a.t}>
                <div className={`arch-ic ${a.c}`}>{a.ic}</div>
                <div>
                  <div className="arch-title">{a.t}</div>
                  <div className="arch-body">{a.b}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TURQUOISE BAND ── */}
      <section id="tband">
        <div className="rv">
          <h2>Automatiza tu empresa.<br />Empieza hoy.</h2>
          <p>Sin configuraciones complejas. La IA aprende tu negocio en horas y empieza a trabajar ese mismo día.</p>
          <ul className="tc-list">
            {["Onboarding en menos de 24 horas","Cero intervención manual en el día a día","Resultados medibles desde la primera semana","Soporte y evolución continua del sistema"].map(li=>(
              <li key={li}>{li}</li>
            ))}
          </ul>
        </div>
        <div id="tband-right" className="rv">
          {[
            {ic:"📱", name:"Socialcors", sub:"Activo · 847 posts publicados este mes"},
            {ic:"📚", name:"Mentoría", sub:"Beta · 23 alumnos en seguimiento"},
            {ic:"📈", name:"Crypto IA", sub:"Desarrollo · Q1 2027"},
          ].map(r=>(
            <div className="tbr-row" key={r.name}>
              <div className="tbr-ic">{r.ic}</div>
              <div>
                <div className="tbr-name">{r.name}</div>
                <div className="tbr-sub">{r.sub}</div>
              </div>
              {r.sub.startsWith("Activo") && <div className="tbr-dot" />}
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section id="cta">
        <h2 className="rv">¿Listo para que la <span>IA</span><br />trabaje por ti?</h2>
        <p className="rv">Empieza con Socialcors y descubre en 30 días cómo la IA gestiona tu presencia digital de principio a fin.</p>
        <div id="cta-btns" className="rv">
          <a href="https://socialcors.com" className="cb1">Probar Socialcors gratis →</a>
          <a href="mailto:hola@drako.systems" className="cb2">Hablar con el equipo</a>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer id="ft">
        <div id="ft-brand">
          <img src={LOGO} alt="Drako" width={26} height={26} style={{width:26,height:26,objectFit:"contain",filter:"brightness(0) invert(1)"}} />
          <b>Drako</b>
        </div>
        <span id="ft-copy">© 2026 Drako Systems · Todos los derechos reservados.</span>
        <div id="ft-links">
          <a href="https://socialcors.com">Socialcors</a>
          <a href="mailto:hola@drako.systems">Contacto</a>
        </div>
      </footer>

      <script dangerouslySetInnerHTML={{__html:`
        (function(){
          var io=new IntersectionObserver(function(es){
            es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('vis');io.unobserve(e.target);}});
          },{threshold:.1});
          document.querySelectorAll('.rv').forEach(function(el){io.observe(el);});
        })();
      `}} />
    </div>
  );
}
