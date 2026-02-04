"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { InfoTooltip } from "@/components/onboarding/info-tooltip";

type OnboardingData = {
  contactName: string;
  companyName: string;
  phone: string;
  address: string;
  sector: string;
  niche: string;
  websiteUrl: string;
  instagramUrl: string;
  facebookUrl: string;
  linkedinUrl: string;
  tiktokUrl: string;
  twitterUrl: string;
  problemStatement: string;
  targetCustomer: string;
  goals: string[];
};

const SECTORS = [
  "Restauración",
  "Salud y Bienestar",
  "Educación",
  "Tecnología",
  "Retail",
  "Servicios Profesionales",
  "Construcción",
  "Inmobiliaria",
  "Turismo y Hospitalidad",
  "Otro",
];

const GOALS = [
  { id: "increase_sales", label: "Aumentar ventas" },
  { id: "automate_processes", label: "Automatizar procesos" },
  { id: "improve_customer_service", label: "Mejorar atención al cliente" },
  { id: "expand_market", label: "Expandir mercado" },
  { id: "reduce_costs", label: "Reducir costos" },
  { id: "digital_transformation", label: "Transformación digital" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState<OnboardingData>({
    contactName: session?.user?.name || "",
    companyName: "",
    phone: "",
    address: "",
    sector: "",
    niche: "",
    websiteUrl: "",
    instagramUrl: "",
    facebookUrl: "",
    linkedinUrl: "",
    tiktokUrl: "",
    twitterUrl: "",
    problemStatement: "",
    targetCustomer: "",
    goals: [],
  });

  const updateField = (field: keyof OnboardingData, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleGoal = (goalId: string) => {
    setFormData((prev) => ({
      ...prev,
      goals: prev.goals.includes(goalId)
        ? prev.goals.filter((g) => g !== goalId)
        : [...prev.goals, goalId],
    }));
  };

  const canProceed = () => {
    if (currentStep === 1) return formData.contactName && formData.companyName;
    if (currentStep === 2) return formData.sector;
    if (currentStep === 3) return true;
    if (currentStep === 4) return formData.problemStatement;
    return false;
  };

  const handleNext = () => {
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        router.push("/site/panel");
      } else {
        alert("Error al guardar. Intenta de nuevo.");
      }
    } catch (error) {
      console.error("Error submitting onboarding:", error);
      alert("Error al guardar. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50 to-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <Image
            src="/logo-drako-full.png"
            alt="Drako Systems"
            width={200}
            height={80}
            className="mx-auto mb-6 h-12 w-auto object-contain"
          />
          <h1 className="text-3xl font-black text-slate-900 mb-2">Bienvenido a Drako</h1>
          <p className="text-slate-600">Completa tu perfil para personalizar tu experiencia</p>
        </div>

        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`flex-1 h-2 mx-1 rounded-full transition-all ${step <= currentStep ? "bg-sky-500" : "bg-slate-200"
                  }`}
              />
            ))}
          </div>
          <p className="text-sm text-slate-500 text-center">Paso {currentStep} de 4</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Información Básica</h2>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center">
                  Nombre del Responsable *
                  <InfoTooltip text="Para personalizar tu experiencia y dirigirnos a ti directamente en el análisis." />
                </label>
                <input
                  type="text"
                  value={formData.contactName}
                  onChange={(e) => updateField("contactName", e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                  placeholder="Juan Pérez"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center">
                  Nombre de la Empresa *
                  <InfoTooltip text="Identificaremos tu marca en el análisis competitivo y rastreo de mercado." />
                </label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => updateField("companyName", e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                  placeholder="Mi Empresa SL"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center">
                  Teléfono
                  <InfoTooltip text="Para contacto directo y soporte prioritario durante el análisis." />
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                  placeholder="+34 600 000 000"
                />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Ubicación y Mercado</h2>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center">
                  Dirección Física
                  <InfoTooltip text="🗺️ Analizaremos tus competidores en un radio de 5km usando Google Maps. Identificaremos su ubicación, rating y distancia a tu negocio." />
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => updateField("address", e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                  placeholder="Calle Mayor 1, Madrid"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center">
                  Sector *
                  <InfoTooltip text="📊 Compararemos tu industria con benchmarks del mercado para identificar oportunidades de crecimiento específicas." />
                </label>
                <select
                  value={formData.sector}
                  onChange={(e) => updateField("sector", e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                >
                  <option value="">Selecciona un sector</option>
                  {SECTORS.map((sector) => (
                    <option key={sector} value={sector}>{sector}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center">
                  Nicho Específico
                  <InfoTooltip text="🎯 Identificaremos tu ventaja competitiva única y qué te diferencia del resto del mercado." />
                </label>
                <input
                  type="text"
                  value={formData.niche}
                  onChange={(e) => updateField("niche", e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                  placeholder="Ej: Cafetería vegana, Fisioterapia deportiva..."
                />
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Presencia Digital</h2>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center">
                  Sitio Web
                  <InfoTooltip text="🌐 Extraeremos tus servicios y precios para comparar con la competencia." />
                </label>
                <input
                  type="url"
                  value={formData.websiteUrl}
                  onChange={(e) => updateField("websiteUrl", e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                  placeholder="https://tu-empresa.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center">
                    Instagram
                    <InfoTooltip text="📱 Analizaremos: frecuencia de posts, promedio de likes, engagement rate, y comparativa vs competidores." />
                  </label>
                  <input
                    type="url"
                    value={formData.instagramUrl}
                    onChange={(e) => updateField("instagramUrl", e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                    placeholder="https://instagram.com/..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center">
                    Facebook
                    <InfoTooltip text="📘 Analizaremos interacciones, frecuencia de publicación y sentimiento de comentarios." />
                  </label>
                  <input
                    type="url"
                    value={formData.facebookUrl}
                    onChange={(e) => updateField("facebookUrl", e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                    placeholder="https://facebook.com/..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center">
                    LinkedIn
                    <InfoTooltip text="💼 Evaluaremos tu presencia profesional y comparativa con empresas similares." />
                  </label>
                  <input
                    type="url"
                    value={formData.linkedinUrl}
                    onChange={(e) => updateField("linkedinUrl", e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                    placeholder="https://linkedin.com/..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">TikTok</label>
                  <input
                    type="url"
                    value={formData.tiktokUrl}
                    onChange={(e) => updateField("tiktokUrl", e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                    placeholder="https://tiktok.com/..."
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Visión del Proyecto</h2>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center">
                  ¿Qué problema resuelve tu SaaS? *
                  <InfoTooltip text="💡 Esto define tu propuesta de valor única. Lo usaremos para identificar tu posicionamiento vs competidores." />
                </label>
                <textarea
                  value={formData.problemStatement}
                  onChange={(e) => updateField("problemStatement", e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none resize-none"
                  placeholder="Describe el problema que tu SaaS resolverá..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center">
                  ¿Quién es tu cliente ideal?
                  <InfoTooltip text="👥 Segmentaremos el mercado para encontrar oportunidades no atendidas y nichos desaprovechados." />
                </label>
                <textarea
                  value={formData.targetCustomer}
                  onChange={(e) => updateField("targetCustomer", e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none resize-none"
                  placeholder="Describe a tu cliente objetivo..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">Objetivos Principales</label>
                <div className="space-y-2">
                  {GOALS.map((goal) => (
                    <label
                      key={goal.id}
                      className="flex items-center p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={formData.goals.includes(goal.id)}
                        onChange={() => toggleGoal(goal.id)}
                        className="w-5 h-5 text-sky-500 rounded focus:ring-2 focus:ring-sky-500"
                      />
                      <span className="ml-3 text-sm font-medium text-slate-700">{goal.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between mt-8 pt-6 border-t border-slate-200">
            <button
              onClick={handleBack}
              disabled={currentStep === 1}
              className="px-6 py-3 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Atrás
            </button>

            {currentStep < 4 ? (
              <button
                onClick={handleNext}
                disabled={!canProceed()}
                className="px-6 py-3 bg-sky-500 text-white font-semibold rounded-lg hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
              >
                Siguiente
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canProceed() || loading}
                className="px-8 py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold rounded-lg hover:from-sky-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
              >
                {loading ? "Guardando..." : "Comenzar 🚀"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
