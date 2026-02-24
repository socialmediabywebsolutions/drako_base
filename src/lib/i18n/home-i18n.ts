/**
 * Home Page i18n Dictionary — ES/EN
 * No "SaaS" in ES copy. Simple, non-technical language.
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
                title: "1. Cuéntanos tu negocio",
                desc: "Un formulario rápido de 5 minutos. Sin letra pequeña, sin compromisos.",
            },
            {
                icon: "",
                title: "2. Diagnóstico inteligente",
                desc: "Nuestros agentes analizan tu sector, competencia y oportunidades de crecimiento.",
            },
            {
                icon: "",
                title: "3. Activación de departamentos",
                desc: "Se activan los departamentos que necesitas: marketing, ventas, atención al cliente y más.",
            },
        ],
    },
    departments: {
        badge: "Departamentos",
        title: "Tu equipo digital, listo para trabajar",
        subtitle:
            "Cada departamento es un equipo de agentes de IA especializados. Elige lo que necesitas hoy; Drako mejora y crea agentes continuamente.",
        items: [
            {
                id: "marketing",
                icon: "",
                name: "Marketing",
                desc: "Campañas, contenido y estrategia de captación.",
            },
            {
                id: "sales",
                icon: "",
                name: "Ventas y CRM",
                desc: "Seguimiento de leads, propuestas y cierre.",
            },
            {
                id: "support",
                icon: "",
                name: "Atención al cliente",
                desc: "Respuestas automáticas, tickets y satisfacción.",
            },
            {
                id: "finance",
                icon: "",
                name: "Finanzas",
                desc: "Facturación, gastos, informes y previsiones.",
            },
            {
                id: "operations",
                icon: "",
                name: "Operaciones",
                desc: "Procesos internos, inventario y logística.",
            },
            {
                id: "content",
                icon: "",
                name: "Contenido y Redes",
                desc: "Posts, calendarios editoriales y diseño.",
            },
            {
                id: "automation",
                icon: "",
                name: "Automatización",
                desc: "Flujos automáticos que eliminan tareas repetitivas.",
            },
        ],
        footer:
            "Drako.Systems es el sistema operativo de tu negocio. Todo lo que necesitas, en un solo lugar.",
    },
    results: {
        badge: "Resultados",
        title: "Lo que verás desde el primer día",
        items: [
            {
                icon: "",
                title: "Reportes inteligentes",
                desc: "Informes automáticos de rendimiento, competencia y oportunidades.",
            },
            {
                icon: "",
                title: "Panel de control",
                desc: "Todo tu negocio en una vista: métricas, tareas y alertas.",
            },
            {
                icon: "",
                title: "Tareas priorizadas",
                desc: "Acciones concretas ordenadas por impacto. Sin adivinar qué hacer.",
            },
            {
                icon: "",
                title: "Automatizaciones activas",
                desc: "Agentes trabajando 24/7: respuestas, seguimiento, publicaciones.",
            },
        ],
    },
    forWhom: {
        badge: "¿Para quién es?",
        title: "Pensado para negocios que quieren crecer",
        profiles: [
            {
                icon: "",
                title: "Negocios locales",
                desc: "Tiendas, restaurantes, clínicas, talleres... que quieren digitalizarse sin complicaciones.",
            },
            {
                icon: "",
                title: "Profesionales independientes",
                desc: "Consultores, coaches, diseñadores... que necesitan automatizar su día a día.",
            },
            {
                icon: "",
                title: "Equipos pequeños",
                desc: "Startups y pymes de 2–20 personas que quieren competir como las grandes.",
            },
        ],
    },
    finalCta: {
        title: "¿Listo para empezar?",
        subtitle:
            "5 minutos de tu tiempo. Sin compromiso. Sin tarjeta de crédito.",
        button: "Empezar análisis gratuito",
    },
    footer: {
        copy: "© 2026 DRĀKO SYSTEMS",
        legal: "Términos · Privacidad",
        contact: "hola@drako.systems",
    },
};

const en: HomeTexts = {
    nav: {
        panel: "My Dashboard",
        templates: "Templates",
        support: "Support",
        start: "Get Started",
    },
    hero: {
        title: "We make the hard stuff easy.",
        subtitle:
            "Your idea is one click away from becoming real: we analyze your business, detect opportunities, and activate AI agents that work for you.",
        ctaPrimary: "Start analysis",
        ctaSecondary: "See how it works",
    },
    howItWorks: {
        badge: "How it works",
        title: "From idea to action in 3 steps",
        steps: [
            {
                icon: "📋",
                title: "1. Tell us about your business",
                desc: "A quick 5-minute form. No fine print, no commitments.",
            },
            {
                icon: "🔍",
                title: "2. Smart diagnosis",
                desc: "Our agents analyze your sector, competition, and growth opportunities.",
            },
            {
                icon: "🚀",
                title: "3. Department activation",
                desc: "The departments you need are activated: marketing, sales, customer support, and more.",
            },
        ],
    },
    departments: {
        badge: "Departments",
        title: "Your digital team, ready to work",
        subtitle:
            "Each department is a team of specialized AI agents. Choose what you need today; Drako improves and creates agents continuously.",
        items: [
            {
                id: "marketing",
                icon: "📢",
                name: "Marketing",
                desc: "Campaigns, content, and acquisition strategy.",
            },
            {
                id: "sales",
                icon: "💼",
                name: "Sales & CRM",
                desc: "Lead tracking, proposals, and closing.",
            },
            {
                id: "support",
                icon: "🎧",
                name: "Customer Support",
                desc: "Automated responses, tickets, and satisfaction.",
            },
            {
                id: "finance",
                icon: "📊",
                name: "Finance",
                desc: "Invoicing, expenses, reports, and forecasts.",
            },
            {
                id: "operations",
                icon: "⚙️",
                name: "Operations",
                desc: "Internal processes, inventory, and logistics.",
            },
            {
                id: "content",
                icon: "✍️",
                name: "Content & Social",
                desc: "Posts, editorial calendars, and design.",
            },
            {
                id: "automation",
                icon: "🤖",
                name: "Automation",
                desc: "Automated workflows that eliminate repetitive tasks.",
            },
        ],
        footer:
            "Drako.Systems is your business operating system. Everything you need, in one place.",
    },
    results: {
        badge: "Results",
        title: "What you'll see from day one",
        items: [
            {
                icon: "📄",
                title: "Smart reports",
                desc: "Automatic performance, competition, and opportunity reports.",
            },
            {
                icon: "📱",
                title: "Control dashboard",
                desc: "Your entire business in one view: metrics, tasks, and alerts.",
            },
            {
                icon: "✅",
                title: "Prioritized tasks",
                desc: "Concrete actions sorted by impact. No guessing what to do.",
            },
            {
                icon: "⚡",
                title: "Active automations",
                desc: "Agents working 24/7: responses, follow-ups, posts.",
            },
        ],
    },
    forWhom: {
        badge: "Who is it for?",
        title: "Built for businesses that want to grow",
        profiles: [
            {
                icon: "🏪",
                title: "Local businesses",
                desc: "Shops, restaurants, clinics, workshops... that want to go digital without the hassle.",
            },
            {
                icon: "👩‍💻",
                title: "Independent professionals",
                desc: "Consultants, coaches, designers... who need to automate their daily work.",
            },
            {
                icon: "👥",
                title: "Small teams",
                desc: "Startups and SMBs of 2–20 people who want to compete with the big players.",
            },
        ],
    },
    finalCta: {
        title: "Ready to start?",
        subtitle: "5 minutes of your time. No commitment. No credit card.",
        button: "Start free analysis",
    },
    footer: {
        copy: "© 2026 DRĀKO SYSTEMS",
        legal: "Terms · Privacy",
        contact: "hello@drako.systems",
    },
};

const dictionaries: Record<HomeLang, HomeTexts> = { es, en };

export function getHomeTexts(lang: HomeLang = "es"): HomeTexts {
    return dictionaries[lang] ?? dictionaries.es;
}
