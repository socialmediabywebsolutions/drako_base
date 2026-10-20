import { Suspense } from 'react';
import Link from 'next/link';
import { LOGO_HEADER_URL } from '@/app/socialflows/_components/landing-config';
import SocialFlowAuthExperience from './_components/socialflow-auth-experience';

export default function SocialFlowAuthPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      {/* Barra de navegación superior fija */}
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
            <Link href="/socialflow/como-funciona" className="hover:text-slate-900 transition-colors">
              Cómo funciona
            </Link>
            <Link href="/socialflow/planes" className="hover:text-slate-900 transition-colors">
              Planes
            </Link>
            <Link href="/socialflow/auth" className="text-[#3b82f6] font-semibold">
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

      {/* Contenido principal de autenticación */}
      <main className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-5xl bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[600px]">

          {/* Columna Izquierda: Branding */}
          <div className="lg:col-span-6 bg-gradient-to-br from-[#3b82f6]/5 via-white to-[#06b6d4]/5 p-8 md:p-12 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-100">
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-[#3b82f6]">SocialCors</h2>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-tight">
                SocialCors analiza, crea, publica y aprende por ti.
              </h1>
            </div>
            <div className="space-y-3 text-sm text-slate-600">
              <p>• <strong className="text-slate-900">Analiza:</strong> Tus fotos, marca y audiencia.</p>
              <p>• <strong className="text-slate-900">Crea:</strong> Textos y hashtags adaptados a tu estilo.</p>
              <p>• <strong className="text-slate-900">Publica:</strong> Directamente en tus redes sociales sin esfuerzo.</p>
            </div>
            <div className="text-xs text-slate-400">© 2026 SocialCors</div>
          </div>

          {/* Columna Derecha: Formulario */}
          <div className="lg:col-span-6 p-6 md:p-12 flex items-center justify-center bg-slate-50/50">
            <div className="w-full max-w-sm">
              <Suspense fallback={<div className="text-slate-500 text-xs">Cargando...</div>}>
                <SocialFlowAuthExperience />
              </Suspense>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
