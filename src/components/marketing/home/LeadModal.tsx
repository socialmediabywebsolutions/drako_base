"use client";

import { useState } from "react";

type LeadModalProps = {
  open: boolean;
  onClose: () => void;
};

const BUDGET_OPTIONS = [
  "Menos de 5.000 €",
  "5.000 € – 15.000 €",
  "15.000 € – 50.000 €",
  "Más de 50.000 €",
  "Aún no lo sé",
];

export function LeadModal({ open, onClose }: LeadModalProps) {
  const [step, setStep] = useState<"form" | "success">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    project: "",
    budget: "",
  });

  if (!open) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.project) {
      setError("Por favor rellena los campos obligatorios.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          role: form.company || undefined,
          interest: form.budget || "Proyecto a medida",
          message: `Empresa: ${form.company || "—"}\nTeléfono: ${form.phone || "—"}\nPresupuesto: ${form.budget || "—"}\n\nProyecto:\n${form.project}`,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) throw new Error(data.error ?? "Error desconocido");
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setStep("form");
      setForm({ name: "", company: "", email: "", phone: "", project: "", budget: "" });
      setError(null);
    }, 300);
  };

  return (
    <>
      <style>{`
        #lead-overlay {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(10,15,30,.55);
          backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          padding: 1rem;
          animation: lo-in .18s ease;
        }
        @keyframes lo-in { from { opacity:0 } to { opacity:1 } }
        #lead-modal {
          background: #fff;
          border-radius: 16px;
          width: 100%; max-width: 520px;
          padding: 2.5rem 2.5rem 2rem;
          position: relative;
          animation: lm-in .2s ease;
          max-height: 90vh;
          overflow-y: auto;
        }
        @keyframes lm-in { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:none } }
        #lead-close {
          position: absolute; top: 1.25rem; right: 1.25rem;
          background: #f1f5f9; border: none; border-radius: 8px;
          width: 32px; height: 32px;
          cursor: pointer; font-size: 1.1rem; color: #64748b;
          display: flex; align-items: center; justify-content: center;
          transition: background .15s;
        }
        #lead-close:hover { background: #e2e8f0; }
        #lead-modal h3 {
          font-size: 1.4rem; font-weight: 700;
          color: #0a0f1e; margin-bottom: .4rem;
        }
        #lead-modal .lead-sub {
          font-size: .9rem; color: #64748b; margin-bottom: 1.75rem;
        }
        .lead-row {
          display: grid; grid-template-columns: 1fr 1fr; gap: .75rem;
          margin-bottom: .75rem;
        }
        @media(max-width:480px) { .lead-row { grid-template-columns: 1fr; } }
        .lead-field {
          display: flex; flex-direction: column; gap: .35rem;
          margin-bottom: .75rem;
        }
        .lead-field label {
          font-size: .8rem; font-weight: 600; color: #374151;
          letter-spacing: .01em;
        }
        .lead-field .req { color: #3b82f6; }
        .lead-field input,
        .lead-field textarea,
        .lead-field select {
          border: 1.5px solid #e2e8f0; border-radius: 8px;
          padding: .65rem .85rem;
          font-size: .92rem; font-family: inherit; color: #0a0f1e;
          background: #fff;
          transition: border-color .15s, box-shadow .15s;
          outline: none;
        }
        .lead-field input:focus,
        .lead-field textarea:focus,
        .lead-field select:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59,130,246,.12);
        }
        .lead-field textarea { resize: vertical; min-height: 100px; }
        .lead-field select { cursor: pointer; appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2364748b' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right .85rem center;
          padding-right: 2.5rem;
        }
        .lead-error {
          background: #fef2f2; border: 1px solid #fecaca;
          border-radius: 8px; padding: .65rem 1rem;
          font-size: .85rem; color: #dc2626;
          margin-bottom: .75rem;
        }
        #lead-submit {
          width: 100%; padding: .85rem;
          background: #3b82f6; color: #fff;
          border: none; border-radius: 10px;
          font-size: 1rem; font-weight: 600; font-family: inherit;
          cursor: pointer; margin-top: .5rem;
          transition: background .15s, transform .1s;
        }
        #lead-submit:hover:not(:disabled) { background: #2563eb; }
        #lead-submit:active:not(:disabled) { transform: scale(.98); }
        #lead-submit:disabled { opacity: .6; cursor: not-allowed; }
        #lead-success {
          text-align: center; padding: 2rem 0 1rem;
        }
        #lead-success .ls-icon {
          width: 56px; height: 56px; border-radius: 50%;
          background: #eff6ff;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 1.25rem;
          font-size: 1.6rem;
        }
        #lead-success h3 { font-size: 1.35rem; margin-bottom: .5rem; }
        #lead-success p { font-size: .92rem; color: #64748b; line-height: 1.6; }
        #lead-ok-btn {
          margin-top: 1.5rem;
          padding: .7rem 2rem;
          background: #f1f5f9; border: none; border-radius: 8px;
          font-size: .95rem; font-weight: 600; font-family: inherit;
          cursor: pointer; color: #374151;
          transition: background .15s;
        }
        #lead-ok-btn:hover { background: #e2e8f0; }
      `}</style>

      <div id="lead-overlay" onClick={(e) => e.target === e.currentTarget && handleClose()}>
        <div id="lead-modal" role="dialog" aria-modal="true" aria-labelledby="lead-title">
          <button id="lead-close" onClick={handleClose} aria-label="Cerrar">✕</button>

          {step === "form" ? (
            <form onSubmit={handleSubmit} noValidate>
              <h3 id="lead-title">Cuéntanos tu proyecto</h3>
              <p className="lead-sub">
                Te respondemos en menos de 24 horas con una valoración inicial sin compromiso.
              </p>

              <div className="lead-row">
                <div className="lead-field">
                  <label htmlFor="lf-name">Nombre <span className="req">*</span></label>
                  <input
                    id="lf-name" name="name" type="text"
                    placeholder="Tu nombre"
                    value={form.name} onChange={handleChange}
                    autoComplete="name"
                  />
                </div>
                <div className="lead-field">
                  <label htmlFor="lf-company">Empresa</label>
                  <input
                    id="lf-company" name="company" type="text"
                    placeholder="Nombre de tu empresa"
                    value={form.company} onChange={handleChange}
                    autoComplete="organization"
                  />
                </div>
              </div>

              <div className="lead-row">
                <div className="lead-field">
                  <label htmlFor="lf-email">Email <span className="req">*</span></label>
                  <input
                    id="lf-email" name="email" type="email"
                    placeholder="tu@empresa.com"
                    value={form.email} onChange={handleChange}
                    autoComplete="email"
                  />
                </div>
                <div className="lead-field">
                  <label htmlFor="lf-phone">Teléfono</label>
                  <input
                    id="lf-phone" name="phone" type="tel"
                    placeholder="+34 600 000 000"
                    value={form.phone} onChange={handleChange}
                    autoComplete="tel"
                  />
                </div>
              </div>

              <div className="lead-field">
                <label htmlFor="lf-project">
                  ¿Qué quieres automatizar? <span className="req">*</span>
                </label>
                <textarea
                  id="lf-project" name="project"
                  placeholder="Describe brevemente tu proceso, qué hace tu empresa y qué te gustaría que la IA hiciera por ti..."
                  value={form.project} onChange={handleChange}
                />
              </div>

              <div className="lead-field">
                <label htmlFor="lf-budget">Presupuesto aproximado</label>
                <select id="lf-budget" name="budget" value={form.budget} onChange={handleChange}>
                  <option value="">Selecciona un rango</option>
                  {BUDGET_OPTIONS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              {error && <div className="lead-error">{error}</div>}

              <button id="lead-submit" type="submit" disabled={loading}>
                {loading ? "Enviando…" : "Enviar solicitud →"}
              </button>
            </form>
          ) : (
            <div id="lead-success">
              <div className="ls-icon">✓</div>
              <h3>¡Solicitud recibida!</h3>
              <p>
                Hemos recibido tu proyecto. Te contactaremos en menos de 24 horas
                con una valoración inicial y los próximos pasos.
              </p>
              <button id="lead-ok-btn" onClick={handleClose}>Cerrar</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
