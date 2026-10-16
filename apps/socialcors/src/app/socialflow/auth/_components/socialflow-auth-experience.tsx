'use client';

import { useState, useTransition } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function SocialFlowAuthExperience() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const plan = searchParams.get('plan') || 'influencer-pro';
  const type = searchParams.get('type') || 'influencer';

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    startTransition(async () => {
      try {
        const res = await fetch('/api/socialflow/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, isLogin }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error((data as any).error || 'Error en la autenticación');
        }

        // Iniciar sesión de checkout en Stripe
        const checkoutRes = await fetch('/api/socialflow/billing/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan, context: 'onboarding' }),
        });
        const checkoutData = await checkoutRes.json() as { ok: boolean; url?: string; code?: string };

        if (!checkoutRes.ok || !checkoutData.url) {
          // Si no hay plan de pago configurado o el usuario ya tiene trial, ir al dashboard
          router.push('/socialflow');
          return;
        }

        // Redirigir a Stripe Checkout
        window.location.href = checkoutData.url;
      } catch (err: any) {
        setError(err.message || 'Ocurrió un error inesperado');
      }
    });
  };

  return (
    <div className="w-full max-w-sm bg-[#131b2e] border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
      <div className="space-y-2 text-left">
        <h2 className="text-xl font-bold tracking-tight text-white">Bienvenido a SocialCors</h2>
        <p className="text-xs text-slate-400">Tu Community Manager con Inteligencia Artificial</p>
      </div>

      <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-800">
        <button
          type="button"
          onClick={() => setIsLogin(true)}
          className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
            isLogin ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          onClick={() => setIsLogin(false)}
          className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
            !isLogin ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          Crear cuenta
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        {error && (
          <div className="p-3 text-xs bg-red-950/80 border border-red-800 text-red-200 rounded-lg">
            {error}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-300">Correo electrónico</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@empresa.com"
            className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-xs font-medium text-slate-300">Contraseña</label>
            {isLogin && (
              <a href="#" className="text-xs text-indigo-400 hover:underline">¿Olvidaste tu contraseña?</a>
            )}
          </div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Tu contraseña segura"
            className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isPending ? 'Procesando...' : isLogin ? 'Entrar en SocialCors →' : 'Crear cuenta y continuar →'}
        </button>
      </form>

      <div className="pt-2 border-t border-slate-800/80 flex justify-between items-center text-xs text-slate-500">
        <span>Plan: <strong className="text-indigo-400">{plan}</strong></span>
        <a href="/socialflow/planes" className="hover:underline text-slate-400">Ver planes ←</a>
      </div>
    </div>
  );
}
