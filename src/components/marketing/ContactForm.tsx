"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ContactFormProps = {
  copy: {
    name: string;
    email: string;
    role: string;
    interest: string;
    interests: string[];
    message: string;
    submit: string;
  };
  initialInterest?: string;
};

export function ContactForm({ copy, initialInterest }: ContactFormProps) {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");

    const formData = new FormData(event.currentTarget);
    const data = {
      name: formData.get("name"),
      email: formData.get("email"),
      role: formData.get("role"),
      interest: formData.get("interest"),
      message: formData.get("message"),
    };

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to submit");
      }

      setStatus("success");
      // Optional: Redirect or reset form
      // event.currentTarget.reset();
    } catch (error) {
      console.error("Contact form error:", error);
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="card-premium bg-white p-12 text-center animate-in fade-in zoom-in duration-500">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-slate-900 mb-4">¡Mensaje recibido!</h3>
        <p className="text-slate-600 mb-8">
          Gracias por contactarnos. Hemos recibido tu solicitud y nuestro equipo técnico la revisará en breve. Te responderemos personalmente.
        </p>
        <button 
          onClick={() => setStatus("idle")}
          className="btn-premium btn-secondary"
        >
          Enviar otro mensaje
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card-premium bg-white p-8 md:p-12 space-y-8">
      <div className="grid grid-cols-1 gap-8">
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-bold uppercase tracking-widest text-slate-500">
            {copy.name}
          </label>
          <input 
            type="text" 
            id="name"
            name="name"
            required
            className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
            placeholder="Ej. Ana García"
          />
        </div>
        
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-bold uppercase tracking-widest text-slate-500">
            {copy.email}
          </label>
          <input 
            type="email" 
            id="email"
            name="email"
            required
            className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
            placeholder="Ej. ana@empresa.com"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="role" className="text-sm font-bold uppercase tracking-widest text-slate-500">
            {copy.role}
          </label>
          <input 
            type="text" 
            id="role"
            name="role"
            className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
            placeholder="Ej. Director de Operaciones"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="interest" className="text-sm font-bold uppercase tracking-widest text-slate-500">
            {copy.interest}
          </label>
          <select
            id="interest"
            name="interest"
            defaultValue={initialInterest}
            className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all appearance-none"
          >
            <option value="" disabled>Selecciona una opción</option>
            {copy.interests.map((interest, i) => (
              <option key={i} value={interest}>{interest}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="message" className="text-sm font-bold uppercase tracking-widest text-slate-500">
            {copy.message}
          </label>
          <textarea 
            id="message"
            name="message"
            required
            rows={5}
            className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all resize-none"
            placeholder="Cuéntanos brevemente qué buscas resolver..."
          />
        </div>
      </div>

      <div className="pt-4">
        <button 
          type="submit" 
          disabled={status === "submitting"}
          className="btn-premium btn-primary w-full md:w-auto text-lg px-8 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {status === "submitting" && (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          {copy.submit}
        </button>
        {status === "error" && (
          <p className="text-red-500 mt-4 text-center">Hubo un error al enviar el formulario. Por favor inténtalo de nuevo.</p>
        )}
      </div>
    </form>
  );
}
