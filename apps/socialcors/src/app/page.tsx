import Link from 'next/link';
import { LOGO_HEADER_URL } from '@/app/socialflows/_components/landing-config';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col">
      {/* Cabecera Superior */}
      <header className="w-full bg-[#07090e]/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50 px-6 py-4">
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

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <Link href="/socialflow/como-funciona" className="hover:text-white transition-colors">
              Cómo funciona
            </Link>
            <Link href="/socialflow/planes" className="hover:text-white transition-colors">
              Planes
            </Link>
            <Link href="/socialflow/planes" className="hover:text-white transition-colors">
              Iniciar sesión
            </Link>
          </nav>

          <div>
            <Link
              href="/socialflow/planes"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl shadow-lg transition-all"
            >
              Probar SocialCors
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Principal */}
      <main className="flex-1 max-w-5xl mx-auto px-6 py-20 text-center flex flex-col items-center justify-center space-y-8">
        <span className="text-xs font-bold tracking-widest text-indigo-400 uppercase">
          PARA AUTÓNOMOS, PROFESIONALES Y PEQUEÑOS NEGOCIOS
        </span>

        <h1 className="text-5xl md:text-6xl font-extrabold text-white tracking-tight leading-tight">
          Tú haces la foto.<br />
          <span className="text-indigo-400">SocialCors hace el resto.</span>
        </h1>

        <p className="text-lg text-slate-400 max-w-2xl leading-relaxed">
          Convierte tus fotos y vídeos en contenido para tus redes sociales, adaptado a tu negocio y preparado para publicar.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
          <Link
            href="/socialflow/planes"
            className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white text-base font-semibold rounded-xl shadow-lg transition-all"
          >
            Probar SocialCors
          </Link>

          <Link
            href="/socialflow/como-funciona"
            className="w-full sm:w-auto px-8 py-3.5 bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 text-base font-semibold rounded-xl transition-all"
          >
            Ver cómo funciona
          </Link>
        </div>

        <p className="text-xs text-slate-500 pt-2">
          15 días gratis · Sin tarjeta · Cancela cuando quieras
        </p>
      </main>
    </div>
  );
}
