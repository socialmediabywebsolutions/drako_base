/**
 * Home Page i18n Dictionary — ES/EN
 * Premium B2B Copy, No Emojis.
 */

export type HomeLang = "es" | "en";

export interface HomeTexts {
    nav: {
        panel: string;
        templates: string;
        support: string;
        start: string;
    };
    hero: {
        title: string;
        subtitle: string;
        ctaPrimary: string;
        ctaSecondary: string;
    };
    howItWorks: {
        badge: string;
        title: string;
        steps: { icon: string; title: string; desc: string }[];
    };
    departments: {
        badge: string;
        title: string;
        subtitle: string;
        items: { id: string; icon: string; name: string; desc: string }[];
        footer: string;
    };
    results: {
        badge: string;
        title: string;
        items: { icon: string; title: string; desc: string }[];
    };
    forWhom: {
        badge: string;
        title: string;
        profiles: { icon: string; title: string; desc: string }[];
    };
    finalCta: {
        title: string;
        subtitle: string;
        button: string;
    };
    footer: {
        copy: string;
        legal: string;
        contact: string;
    };
}

const es: HomeTexts = {
    nav: {
        panel: "Mi Panel",
        templates: "Plantillas",
        support: "Soporte",
        start: "Empezar",
    },
    hero: {
        title: "Lo difícil lo hacemos fácil.",
        subtitle:
            "Tu idea está a un click de ser real: analizamos tu negocio, detectamos oportunidades y activamos agentes de IA que trabajan por ti.",
        ctaPrimary: "Empezar análisis",
        ctaSecondary: "Ver cómo funciona",
    },
    howItWorks: {
        badge: "Así funciona",
        title: "De la idea a la acción en 3 pasos",
        steps: [
            {
                icon: "",
                title: "1. Negocio",
                desc: "Describe tu actividad en un formulario rápido de 5 minutos.",
            },
            {
                icon: "",
                title: "2. Diagnóstico",
                desc: "Nuestros agentes analizan tu sector y competencia en tiempo real.",
            },
            {
                icon: "",
                title: "3. Activación",
                desc: "Activamos los departamentos de IA necesarios para tu crecimiento.",
            },
        ],
    },
    departments: {
        badge: "Departamentos",
        title: "Tu equipo digital de élite",
        subtitle:
            "Agentes de IA especializados que operan tu negocio 24/7.",
        items: [
            { id: "marketing", icon: "", name: "Marketing", desc: "Captación y contenido." },
            { id: "sales", icon: "", name: "Ventas", desc: "Leads y cierres de contratos." },
            { id: "support", icon: "", name: "Soporte", desc: "Atención al cliente inteligente." },
            { id: "finance", icon: "", name: "Finanzas", desc: "Gestión de facturas e informes." },
            { id: "ops", icon: "", name: "Operaciones", desc: "Procesos y logística digital." },
            { id: "dev", icon: "", name: "Automatización", desc: "Ingeniería de procesos." },
        ],
        footer: "Drako.Systems: El sistema operativo de la nueva economía.",
    },
    results: {
        badge: "Impacto",
        title: "Resultados inmediatos",
        items: [
            { icon: "", title: "Velocidad", desc: "Ejecución inmediata de tareas complejas." },
            { icon: "", title: "Escala", desc: "Crece sin aumentar tus costes fijos." },
            { icon: "", title: "Control", desc: "Todo centralizado en un solo panel." },
            { icon: "", title: "Ahorro", desc: "Reduce gastos operativos drásticamente." },
        ],
    },
    forWhom: {
        badge: "Perfil",
        title: "Diseñado para la excelencia",
        profiles: [
            { icon: "", title: "Empresas locales", desc: "Digitalización sin fricciones." },
            { icon: "", title: "SaaS & Tech", desc: "Potenciado por agentes expertos." },
            { icon: "", title: "Consultoras", desc: "Automatiza la entrega de valor." },
        ],
    },
    finalCta: {
        title: "Drako Systems",
        subtitle: "La inteligencia que tu negocio merece.",
        button: "Explorar ahora",
    },
    footer: {
        copy: "© 2026 DRÂKO SYSTEMS",
        legal: "Privacidad · Términos",
        contact: "hola@drako.systems",
    },
};

const en: HomeTexts = {
    ...es,
    nav: {
        panel: "Dashboard",
        templates: "Templates",
        support: "Support",
        start: "Get Started",
    },
    hero: {
        title: "We make the hard stuff easy.",
        subtitle: "Analyze, Detect, Activate. Your business scaled by IA.",
        ctaPrimary: "Start analysis",
        ctaSecondary: "How it works",
    }
};

const dictionaries: Record<HomeLang, HomeTexts> = { es, en };

export function getHomeTexts(lang: HomeLang = "es"): HomeTexts {
    return dictionaries[lang] ?? dictionaries.es;
}
