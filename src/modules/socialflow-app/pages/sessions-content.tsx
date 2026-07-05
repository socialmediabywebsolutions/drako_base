'use client';

export function SessionsContent() {
  return (
    <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">
        Socialcors runtime boundary
      </div>
      <p className="mt-3 leading-6">
        Sessions is unavailable here because the previous implementation imported Mentoría components and
        called a Mentoría API surface. Socialcors now fails closed at this boundary until sessions can be
        rebuilt with product-native usage and billing contracts.
      </p>
    </section>
  );
}
