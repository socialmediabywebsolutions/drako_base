/**
 * Onboarding Wizard — i18n Dictionary
 * ES (default) + EN
 *
 * Usage: const t = getOnboardingTexts("es");
 *        t.step1.title → "Tu negocio"
 */

export type OnboardingLang = "es" | "en";

export interface OnboardingTexts {
    wizard: {
        progress: string;
        next: string;
        back: string;
        finish: string;
        saving: string;
        stepOf: (current: number, total: number) => string;
    };
    step1: {
        title: string;
        subtitle: string;
        microcopy: string;
        companyName: string;
        companyNamePlaceholder: string;
        businessStatus: string;
        statusOperating: string;
        statusLaunching: string;
        statusIdea: string;
        country: string;
        countryPlaceholder: string;
        city: string;
        cityPlaceholder: string;
        niche: string;
        nichePlaceholder: string;
    };
    step2: {
        title: string;
        subtitle: string;
        microcopy: string;
        hasWeb: string;
        hasWebYes: string;
        hasWebNo: string;
        webUrl: string;
        webUrlPlaceholder: string;
        currentSocials: string;
        desiredSocials: string;
        instagram: string;
        facebook: string;
        linkedin: string;
        tiktok: string;
        youtube: string;
        other: string;
    };
    step3: {
        title: string;
        subtitle: string;
        microcopy: string;
        competitor1: string;
        competitor1Url: string;
        competitor2: string;
        competitor2Url: string;
        competitor3: string;
        competitor3Url: string;
    };
    step4: {
        title: string;
        subtitle: string;
        microcopy: string;
        hasLocation: string;
        hasLocationYes: string;
        hasLocationNo: string;
        address: string;
        addressPlaceholder: string;
        guideText: string;
    };
    step5: {
        title: string;
        subtitle: string;
        microcopy: string;
        departments: {
            id: string;
            label: string;
            description: string;
        }[];
        otherPlaceholder: string;
    };
    summary: {
        title: string;
        understood: string;
        analyzing: string;
        suggestedActions: string;
    };
    sectors: string[];
}

const es: OnboardingTexts = {
    wizard: {
        progress: "Progreso",
        next: "Siguiente",
        back: "Atrás",
        finish: "Finalizar",
        saving: "Guardando...",
        stepOf: (c, t) => `Paso ${c} de ${t}`,
    },
    step1: {
        title: "Tu negocio",
        subtitle: "Cuéntanos lo básico sobre tu proyecto o empresa",
        microcopy: "Esto nos ayuda a configurar tu entorno inicial.",
        companyName: "Nombre del negocio o proyecto",
        companyNamePlaceholder: "Ej: Clínica Dental Sonrisa",
        businessStatus: "¿En qué etapa estás?",
        statusOperating: "Ya estoy funcionando",
        statusLaunching: "Preparando lanzamiento",
        statusIdea: "Es una idea",
        country: "País",
        countryPlaceholder: "Ej: España, México",
        city: "Ciudad",
        cityPlaceholder: "Ej: Madrid, CDMX",
        niche: "Nicho o especialidad",
        nichePlaceholder: "Ej: Ortodoncia, Yoga para embarazadas",
    },
    step2: {
        title: "Presencia digital",
        subtitle: "Cómo te encuentran tus clientes en internet",
        microcopy: "Si no tienes nada aún, no te preocupes, lo crearemos juntos.",
        hasWeb: "¿Tienes una página web?",
        hasWebYes: "Sí, tengo web",
        hasWebNo: "No tengo web",
        webUrl: "URL de tu web",
        webUrlPlaceholder: "https://tu-negocio.com",
        currentSocials: "Tus redes actuales (opcional)",
        desiredSocials: "Redes que quieres activar o mejorar",
        instagram: "Instagram",
        facebook: "Facebook",
        linkedin: "LinkedIn",
        tiktok: "TikTok",
        youtube: "YouTube",
        other: "Otra",
    },
    step3: {
        title: "Tu competencia",
        subtitle: "¿A quién admiras o quiénes son tus rivales directos?",
        microcopy: "Drako analizará a tus competidores para encontrar oportunidades.",
        competitor1: "Competidor 1 (Nombre)",
        competitor1Url: "URL del competidor 1 (si tiene)",
        competitor2: "Competidor 2 (Nombre)",
        competitor2Url: "URL del competidor 2 (si tiene)",
        competitor3: "Competidor 3 (Nombre)",
        competitor3Url: "URL del competidor 3 (si tiene)",
    },
    step4: {
        title: "Operación local",
        subtitle: "¿Atiendes clientes en un lugar físico?",
        microcopy: "Si tienes local comercial, la dirección es necesaria para el SEO local.",
        hasLocation: "¿Tienes local abierto al público?",
        hasLocationYes: "Sí, tengo local comercial",
        hasLocationNo: "No, trabajo 100% online o a domicilio",
        address: "Dirección completa (Calle, Número, CP)",
        addressPlaceholder: "Ej: Calle Mayor 10, 28013 Madrid",
        guideText: "Asegúrate de que la dirección sea exacta para que tus clientes te encuentren en Google Maps.",
    },
    step5: {
        title: "¿En qué áreas quieres ayuda?",
        subtitle: "Drako tiene 'departamentos' listos para trabajar por ti",
        microcopy: "Selecciona los que más te urgen. Podrás activar otros después.",
        departments: [
            { id: "marketing", label: "Marketing y Ventas", description: "Conseguir clientes y cerrar ventas" },
            { id: "social_media", label: "Redes Sociales", description: "Publicar contenido y ganar seguidores" },
            { id: "automation", label: "Automatización", description: "Ahorrar tiempo usando Inteligencia Artificial" },
            { id: "finance", label: "Control de Dinero", description: "Saber cuánto ganas y cuánto gastas cada día" },
            { id: "strategy", label: "Estrategia", description: "Saber qué pasos dar para crecer" },
            { id: "support", label: "Atención al Cliente", description: "Responder dudas por WhatsApp y Email" },
            { id: "web", label: "Tu Web", description: "Crear o mejorar tu página de internet" },
        ],
        otherPlaceholder: "¿Qué más necesitas?",
    },
    summary: {
        title: "¡Listo! Ya tenemos tu perfil",
        understood: "Esto es lo que hemos entendido de tu negocio",
        analyzing: "Esto vamos a analizar ahora",
        suggestedActions: "Primeras acciones sugeridas",
    },
    sectors: [
        "Restauración y hostelería",
        "Salud y bienestar",
        "Educación y formación",
        "Tecnología",
        "Comercio y retail",
        "Servicios profesionales",
        "Construcción y reformas",
        "Inmobiliaria",
        "Turismo y ocio",
        "Belleza y estética",
        "Deporte y fitness",
        "Alimentación",
        "Moda y textil",
        "Automoción",
        "Transporte y logística",
        "Artes y entretenimiento",
        "Agricultura",
        "Otro",
    ],
};

const en: OnboardingTexts = {
    wizard: {
        progress: "Progress",
        next: "Next",
        back: "Back",
        finish: "Finish",
        saving: "Saving...",
        stepOf: (c, t) => `Step ${c} of ${t}`,
    },
    step1: {
        title: "Your business",
        subtitle: "Tell us the basics about your project or company",
        microcopy: "This helps us set up your initial environment.",
        companyName: "Business or project name",
        companyNamePlaceholder: "E.g.: Smile Dental Clinic",
        businessStatus: "At what stage are you?",
        statusOperating: "Already up and running",
        statusLaunching: "Preparing for launch",
        statusIdea: "It's just an idea",
        country: "Country",
        countryPlaceholder: "E.g.: USA, United Kingdom",
        city: "City",
        cityPlaceholder: "E.g.: New York, London",
        niche: "Niche or specialty",
        nichePlaceholder: "E.g.: Orthodontics, Prenatal Yoga",
    },
    step2: {
        title: "Digital presence",
        subtitle: "How customers find you online",
        microcopy: "Don't worry if you have nothing yet, we'll build it together.",
        hasWeb: "Do you have a website?",
        hasWebYes: "Yes, I have one",
        hasWebNo: "No website",
        webUrl: "Your website URL",
        webUrlPlaceholder: "https://your-business.com",
        currentSocials: "Your current social media (optional)",
        desiredSocials: "Social networks you want to activate or improve",
        instagram: "Instagram",
        facebook: "Facebook",
        linkedin: "LinkedIn",
        tiktok: "TikTok",
        youtube: "YouTube",
        other: "Other",
    },
    step3: {
        title: "Your competition",
        subtitle: "Who do you admire or who are your direct rivals?",
        microcopy: "Drako will analyze your competitors to find opportunities.",
        competitor1: "Competitor 1 (Name)",
        competitor1Url: "Competitor 1 URL (if any)",
        competitor2: "Competitor 2 (Name)",
        competitor2Url: "Competitor 2 URL (if any)",
        competitor3: "Competitor 3 (Name)",
        competitor3Url: "Competitor 3 URL (if any)",
    },
    step4: {
        title: "Local operation",
        subtitle: "Do you serve customers at a physical location?",
        microcopy: "If you have a commercial location, the address is needed for local SEO.",
        hasLocation: "Do you have a physical presence open to the public?",
        hasLocationYes: "Yes, I have a commercial location",
        hasLocationNo: "No, I work 100% online or mobile",
        address: "Full address (Street, Number, Postal Code)",
        addressPlaceholder: "E.g.: 123 Main Street, London SW1A 1AA",
        guideText: "Ensure the address is exact so your customers can find you on Google Maps.",
    },
    step5: {
        title: "Where do you need help?",
        subtitle: "Drako has 'departments' ready to work for you",
        microcopy: "Select your most urgent areas. You can activate others later.",
        departments: [
            { id: "marketing", label: "Marketing & Sales", description: "Get customers and close deals" },
            { id: "social_media", label: "Social Media", description: "Publish content and gain followers" },
            { id: "automation", label: "Automation", description: "Save time using Artificial Intelligence" },
            { id: "finance", label: "Money Control", description: "Know what you earn and spend every day" },
            { id: "strategy", label: "Strategy", description: "Know what steps to take to grow" },
            { id: "support", label: "Customer Support", description: "Answer questions via WhatsApp and Email" },
            { id: "web", label: "Your Website", description: "Create or improve your online presence" },
        ],
        otherPlaceholder: "What else do you need?",
    },
    summary: {
        title: "All set! We have your profile",
        understood: "This is what we understand about your business",
        analyzing: "This is what we're analyzing now",
        suggestedActions: "Suggested first actions",
    },
    sectors: [
        "Food & hospitality",
        "Health & wellness",
        "Education & training",
        "Technology",
        "Retail & commerce",
        "Professional services",
        "Construction & renovation",
        "Real estate",
        "Tourism & leisure",
        "Beauty & aesthetics",
        "Sports & fitness",
        "Food & beverage",
        "Fashion & textiles",
        "Automotive",
        "Transport & logistics",
        "Arts & entertainment",
        "Agriculture",
        "Other",
    ],
};

const dictionaries: Record<OnboardingLang, OnboardingTexts> = { es, en };

export function getOnboardingTexts(lang: OnboardingLang = "es"): OnboardingTexts {
    return dictionaries[lang] ?? dictionaries.es;
}

export const GOAL_KEYS = [
    "goalClients",
    "goalOrganize",
    "goalAutomate",
    "goalSocial",
    "goalFinance",
    "goalAI",
    "goalOther",
] as const;

export type GoalKey = (typeof GOAL_KEYS)[number];
