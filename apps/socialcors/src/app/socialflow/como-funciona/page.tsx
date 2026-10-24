import Link from 'next/link';
import { LOGO_HEADER_URL } from '@/app/socialflows/_components/landing-config';

export default function ComoFuncionaPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      {/* Menú Superior */}
      <header className="w-full bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img
              src={LOGO_HEADER_URL}
              alt="SocialCors"
              width={1536}
              height={1024}
              className="h-10 w-auto object-contain"
            />
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <Link href="/" className="hover:text-slate-900 transition-colors">
              Inicio
            </Link>
            <Link href="/socialflow/como-funciona" className="text-[#3b82f6] font-semibold">
              Cómo funciona
            </Link>
            <Link href="/socialflow/planes" className="hover:text-slate-900 transition-colors">
              Planes
            </Link>
            <Link href="/socialflow/auth" className="hover:text-slate-900 transition-colors">
              Iniciar sesión
            </Link>
          </nav>

          <div>
            <Link
              href="/socialflow/planes"
              className="px-4 py-2 bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] hover:brightness-110 text-white text-sm font-semibold rounded-xl shadow-lg transition-all"
            >
              Probar SocialCors
            </Link>
          </div>
        </div>
      </header>

      {/* Contenido de Cómo Funciona */}
      <main className="flex-1 max-w-4xl mx-auto px-6 py-16 space-y-12">
        <div className="text-center space-y-4">
          <span className="text-xs font-semibold tracking-widest text-[#3b82f6] uppercase">
            Paso a Paso
          </span>
          <h1 className="text-4xl font-extrabold text-slate-900">
            ¿Cómo funciona SocialCors?
          </h1>
          <p className="text-slate-500 text-sm max-w-xl mx-auto">
            Automatiza tu gestión de redes sociales impulsada por Inteligencia Artificial en 3 sencillos pasos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-3 shadow-sm hover:shadow-md hover:border-[#3b82f6]/30 transition-all">
            <div className="w-10 h-10 rounded-xl bg-[#3b82f6]/10 text-[#3b82f6] font-bold flex items-center justify-center text-lg">1</div>
            <h3 className="font-bold text-slate-900 text-lg">Analiza</h3>
            <p className="text-xs text-slate-500">Analizamos tus fotos, tu identidad visual, tu marca y el comportamiento de tu audiencia.</p>
          </div>

          <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-3 shadow-sm hover:shadow-md hover:border-[#3b82f6]/30 transition-all">
            <div className="w-10 h-10 rounded-xl bg-[#3b82f6]/10 text-[#3b82f6] font-bold flex items-center justify-center text-lg">2</div>
            <h3 className="font-bold text-slate-900 text-lg">Crea</h3>
            <p className="text-xs text-slate-500">Generamos textos, hashtags y vídeos adaptados al tono de tu negocio.</p>
          </div>

          <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-3 shadow-sm hover:shadow-md hover:border-[#3b82f6]/30 transition-all">
            <div className="w-10 h-10 rounded-xl bg-[#3b82f6]/10 text-[#3b82f6] font-bold flex items-center justify-center text-lg">3</div>
            <h3 className="font-bold text-slate-900 text-lg">Publica</h3>
            <p className="text-xs text-slate-500">Publicamos de forma automática en Instagram y redes sin que tengas que mover un dedo.</p>
          </div>
        </div>

        <div className="text-center pt-8">
          <Link
            href="/socialflow/planes"
            className="px-8 py-3 bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] hover:brightness-110 text-white font-semibold rounded-xl shadow-lg transition-all inline-block"
          >
            Ver Planes y Empezar →
          </Link>
        </div>
      </main>
    </div>
  );
}
