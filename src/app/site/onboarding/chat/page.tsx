"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  getOnboardingTexts,
  GOAL_KEYS,
  type GoalKey,
  type OnboardingLang,
} from "@/lib/i18n/onboarding-i18n";

/* ─── Types ─── */
interface CompanyProfile {
  company_name: string;
  sector: string | null;
  address: string | null;
  zone: string | null;
  structured_context: Record<string, unknown>;
}

/* ─── Goal & Department label resolvers ─── */
function goalLabel(key: string, t: ReturnType<typeof getOnboardingTexts>): string {
  const s = t.step4;
  const map: Record<string, string> = {};
  for (const k of GOAL_KEYS) map[k] = s[k];
  return map[key] ?? key;
}

function deptLabel(id: string, t: ReturnType<typeof getOnboardingTexts>): string {
  const dept = t.step5.departments.find((d) => d.id === id);
  return dept?.label ?? id;
}

function customerLabel(type: string, t: ReturnType<typeof getOnboardingTexts>): string {
  const s = t.step2;
  const map: Record<string, string> = {
    people: s.customerPeople,
    companies: s.customerCompanies,
    both: s.customerBoth,
  };
  return map[type] ?? type;
}

function statusLabel(status: string, t: ReturnType<typeof getOnboardingTexts>): string {
  const s = t.step1;
  const map: Record<string, string> = {
    operating: s.statusOperating,
    launching: s.statusLaunching,
    idea: s.statusIdea,
  };
  return map[status] ?? status;
}

/* ─── Suggested Actions Generator ─── */
function getSuggestedActions(
  ctx: Record<string, unknown>,
  profile: CompanyProfile,
  lang: OnboardingLang
): string[] {
  const actions: string[] = [];
  const isEs = lang === "es";

  const goal = ctx.primaryGoal as string;
  if (goal === "goalClients") {
    actions.push(
      isEs
        ? `Analizar los competidores cerca de ${profile.address || profile.zone || "tu zona"} para encontrar oportunidades`
        : `Analyze competitors near ${profile.address || profile.zone || "your area"} to find opportunities`
    );
  } else if (goal === "goalSocial") {
    actions.push(
      isEs
        ? "Auditar tus redes sociales actuales y crear un calendario de contenido"
        : "Audit your current social media and create a content calendar"
    );
  } else if (goal === "goalAutomate") {
    actions.push(
      isEs
        ? "Identificar las 3 tareas más repetitivas de tu negocio para automatizarlas"
        : "Identify the 3 most repetitive tasks in your business to automate them"
    );
  } else if (goal === "goalOrganize") {
    actions.push(
      isEs
        ? "Crear un panel de control con los indicadores clave de tu negocio"
        : "Create a dashboard with your business's key metrics"
    );
  } else if (goal === "goalFinance") {
    actions.push(
      isEs
        ? "Configurar el seguimiento de gastos e ingresos con reportes automáticos"
        : "Set up expense and income tracking with automated reports"
    );
  } else {
    actions.push(
      isEs
        ? `Estudiar tu sector (${profile.sector ?? "general"}) y preparar un análisis de oportunidades`
        : `Study your sector (${profile.sector ?? "general"}) and prepare an opportunity analysis`
    );
  }

  if (ctx.wantWebCreated) {
    actions.push(
      isEs
        ? "Crear tu página web básica con la información de tu negocio"
        : "Create your basic website with your business information"
    );
  } else if (ctx.hasWeb && ctx.websiteUrl) {
    actions.push(
      isEs
        ? `Analizar tu web actual (${ctx.websiteUrl}) y sugerir mejoras`
        : `Analyze your current website (${ctx.websiteUrl}) and suggest improvements`
    );
  } else {
    actions.push(
      isEs
        ? "Preparar los perfiles de redes sociales para maximizar tu visibilidad"
        : "Set up social media profiles to maximize your visibility"
    );
  }

  const deps = (ctx.departments as string[]) ?? [];
  if (deps.includes("marketing")) {
    actions.push(
      isEs
        ? "Diseñar tu primera campaña de captación de clientes"
        : "Design your first customer acquisition campaign"
    );
  } else if (deps.includes("strategy")) {
    actions.push(
      isEs
        ? "Generar un análisis competitivo detallado de tu zona y sector"
        : "Generate a detailed competitive analysis of your area and sector"
    );
  } else if (deps.includes("automation")) {
    actions.push(
      isEs
        ? "Configurar las primeras automatizaciones para ahorrarte tiempo"
        : "Set up the first automations to save you time"
    );
  } else {
    actions.push(
      isEs
        ? "Preparar un plan de acción personalizado para las próximas 4 semanas"
        : "Prepare a personalized action plan for the next 4 weeks"
    );
  }

  return actions.slice(0, 3);
}

/* ─── Fetch with timeout ─── */
function fetchWithTimeout(url: string, ms = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

/* ─── Main Component ─── */
export default function OnboardingChatPage({ lang = "es" }: { lang?: OnboardingLang }) {
  const t = getOnboardingTexts(lang);
  const { data: session, status: sessionStatus } = useSession();
  const email = session?.user?.email ?? "";

  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait for session to finish loading
    if (sessionStatus === "loading") return;

    const loadFromStorage = (): CompanyProfile | null => {
      try {
        const raw = sessionStorage.getItem("drako_wizard_data");
        if (raw) return JSON.parse(raw) as CompanyProfile;
      } catch { /* ignore */ }
      return null;
    };

    // No email → try sessionStorage fallback
    if (!email) {
      setProfile(loadFromStorage());
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetchWithTimeout(
          `/api/company-profile?email=${encodeURIComponent(email)}`
        );
        if (res.ok) {
          const json = (await res.json()) as { profile: CompanyProfile | null };
          if (json.profile) {
            setProfile(json.profile);
          } else {
            // DB has no profile → fallback to sessionStorage
            setProfile(loadFromStorage());
          }
        } else {
          setProfile(loadFromStorage());
        }
      } catch {
        console.warn("[Chat] Could not load profile, trying sessionStorage");
        setProfile(loadFromStorage());
      }
      setLoading(false);
    })();
  }, [email, sessionStatus]);

  if (loading) {
    return (
      <div className="onboarding-wizard" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div className="ow-saving-spinner" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="onboarding-wizard">
        <div className="ow-step" style={{ textAlign: "center", paddingTop: 60 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 12 }}>
            {lang === "es" ? "No encontramos tu perfil" : "We couldn't find your profile"}
          </h2>
          <p style={{ color: "#6b7280", marginBottom: 24 }}>
            {lang === "es"
              ? "Parece que aún no has completado el formulario de registro."
              : "It seems you haven't completed the registration form yet."}
          </p>
          <Link
            href="/site/onboarding"
            style={{
              display: "inline-block",
              padding: "12px 28px",
              background: "#0ea5e9",
              color: "white",
              borderRadius: 12,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {lang === "es" ? "Ir al formulario" : "Go to the form"}
          </Link>
        </div>
      </div>
    );
  }

  const ctx = profile.structured_context ?? {};
  const socialNets = (ctx.socialNetworks as Record<string, string>) ?? {};
  const activeSocials = Object.entries(socialNets).filter(([, v]) => v);
  const desiredNets = (ctx.desiredSocialNetworks as string[]) ?? [];
  const departments = (ctx.departments as string[]) ?? [];
  const primaryGoal = (ctx.primaryGoal as string) ?? "";
  const secondaryGoals = (ctx.secondaryGoals as string[]) ?? [];
  const actions = getSuggestedActions(ctx, profile, lang);

  const isEs = lang === "es";

  return (
    <div className="onboarding-wizard">
      <div className="ow-summary">
        {/* ── Header ── */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>
            {t.summary.title}
          </h1>
          <p style={{ fontSize: 16, color: "#6b7280" }}>
            {isEs
              ? `Bienvenido, ${profile.company_name}. Esto es lo que hemos preparado.`
              : `Welcome, ${profile.company_name}. Here's what we've prepared.`}
          </p>
        </div>

        {/* ── Card 1: What we understood ── */}
        <div className="ow-summary-card">
          <h3>{t.summary.understood}</h3>
          <div className="ow-summary-item">
            <span className="ow-summary-key">{t.step1.companyName}</span>
            <span className="ow-summary-value">{profile.company_name}</span>
          </div>
          {ctx.businessStatus && (
            <div className="ow-summary-item">
              <span className="ow-summary-key">{t.step1.businessStatus}</span>
              <span className="ow-summary-value">{statusLabel(ctx.businessStatus as string, t)}</span>
            </div>
          )}
          {profile.sector && (
            <div className="ow-summary-item">
              <span className="ow-summary-key">{t.step2.sector}</span>
              <span className="ow-summary-value">{profile.sector}</span>
            </div>
          )}
          {ctx.offering && (
            <div className="ow-summary-item">
              <span className="ow-summary-key">{t.step2.offering}</span>
              <span className="ow-summary-value">{ctx.offering as string}</span>
            </div>
          )}
          {ctx.customerType && (
            <div className="ow-summary-item">
              <span className="ow-summary-key">{t.step2.customerType}</span>
              <span className="ow-summary-value">{customerLabel(ctx.customerType as string, t)}</span>
            </div>
          )}
          {(profile.address || profile.zone) && (
            <div className="ow-summary-item">
              <span className="ow-summary-key">{profile.address ? t.step1.address : t.step1.zone}</span>
              <span className="ow-summary-value">{profile.address || profile.zone}</span>
            </div>
          )}
          {activeSocials.length > 0 && (
            <div className="ow-summary-item">
              <span className="ow-summary-key">{t.step3.currentSocials}</span>
              <span className="ow-summary-value">{activeSocials.map(([k]) => k).join(", ")}</span>
            </div>
          )}
          {primaryGoal && (
            <div className="ow-summary-item">
              <span className="ow-summary-key">{t.step4.selectPrimary}</span>
              <span className="ow-summary-value">{goalLabel(primaryGoal, t)}</span>
            </div>
          )}
          {departments.length > 0 && (
            <div className="ow-summary-item">
              <span className="ow-summary-key">{t.step5.title}</span>
              <span className="ow-summary-value">
                {departments.map((d) => deptLabel(d, t)).join(", ")}
              </span>
            </div>
          )}
        </div>

        {/* ── Card 2: What we're analyzing ── */}
        <div className="ow-summary-card">
          <h3>{t.summary.analyzing}</h3>
          <ul className="ow-action-list">
            {profile.sector && (profile.address || profile.zone) && (
              <li>
                {isEs
                  ? `Competidores en tu zona (${profile.address || profile.zone}) dentro del sector ${profile.sector}`
                  : `Competitors in your area (${profile.address || profile.zone}) within the ${profile.sector} sector`}
              </li>
            )}
            {ctx.hasWeb && ctx.websiteUrl && (
              <li>
                {isEs
                  ? `Tu presencia web actual: ${ctx.websiteUrl}`
                  : `Your current web presence: ${ctx.websiteUrl}`}
              </li>
            )}
            {activeSocials.length > 0 && (
              <li>
                {isEs
                  ? `Tus perfiles en ${activeSocials.map(([k]) => k).join(", ")}`
                  : `Your profiles on ${activeSocials.map(([k]) => k).join(", ")}`}
              </li>
            )}
            {desiredNets.length > 0 && (
              <li>
                {isEs
                  ? `Oportunidades en las redes que quieres activar: ${desiredNets.join(", ")}`
                  : `Opportunities on networks you want to activate: ${desiredNets.join(", ")}`}
              </li>
            )}
            {secondaryGoals.length > 0 && (
              <li>
                {isEs
                  ? `Estrategias para: ${secondaryGoals.map((g) => goalLabel(g, t)).join(", ")}`
                  : `Strategies for: ${secondaryGoals.map((g) => goalLabel(g, t)).join(", ")}`}
              </li>
            )}
            {!(profile.sector && (profile.address || profile.zone)) &&
              activeSocials.length === 0 &&
              desiredNets.length === 0 && (
                <li>
                  {isEs
                    ? "Preparando tu análisis inicial basado en la información proporcionada"
                    : "Preparing your initial analysis based on the information provided"}
                </li>
              )}
          </ul>
        </div>

        {/* ── Card 3: Suggested first actions ── */}
        <div className="ow-summary-card">
          <h3>{t.summary.suggestedActions}</h3>
          <ul className="ow-action-list">
            {actions.map((action, i) => (
              <li key={i}>{action}</li>
            ))}
          </ul>
        </div>

        {/* ── CTA ── */}
        <div style={{ textAlign: "center", marginTop: 32 }}>
          <Link
            href="/site/panel"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "14px 32px",
              background: "#0ea5e9",
              color: "white",
              borderRadius: 12,
              fontWeight: 600,
              fontSize: 16,
              textDecoration: "none",
              transition: "all 200ms",
            }}
          >
            {isEs ? "Ir a mi panel →" : "Go to my dashboard →"}
          </Link>
          <p style={{ fontSize: 13, color: "#9ca3af", marginTop: 12 }}>
            {isEs
              ? "Desde el panel podrás seguir el progreso de todos los análisis."
              : "From the dashboard you can track the progress of all analyses."}
          </p>
        </div>
      </div>
    </div>
  );
}
