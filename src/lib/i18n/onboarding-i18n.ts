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
        hasLocation: string;
        hasLocationYes: string;
        hasLocationNo: string;
        address: string;
        addressPlaceholder: string;
        schedule: string;
        schedulePlaceholder: string;
        zone: string;
        zonePlaceholder: string;
    };
    step2: {
        title: string;
        subtitle: string;
        microcopy: string;
        offering: string;
        offeringPlaceholder: string;
        sector: string;
        sectorPlaceholder: string;
        niche: string;
        nichePlaceholder: string;
        customerType: string;
        customerPeople: string;
        customerPeopleExample: string;
        customerCompanies: string;
        customerCompaniesExample: string;
        customerBoth: string;
        salesChannels: string;
        salesOnline: string;
        salesInPerson: string;
        salesBoth: string;
    };
    step3: {
        title: string;
        subtitle: string;
        microcopy: string;
        hasWeb: string;
        hasWebYes: string;
        hasWebNo: string;
        webUrl: string;
        webUrlPlaceholder: string;
        wantWebCreated: string;
        currentSocials: string;
        desiredSocials: string;
        instagram: string;
        facebook: string;
        linkedin: string;
        tiktok: string;
        youtube: string;
        other: string;
    };
    step4: {
        title: string;
        subtitle: string;
        microcopy: string;
        selectPrimary: string;
        selectSecondary: string;
        goalClients: string;
        goalOrganize: string;
        goalAutomate: string;
        goalSocial: string;
        goalFinance: string;
        goalAI: string;
        goalOther: string;
        goalOtherPlaceholder: string;
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
        microcopy: "Esto nos ayuda a analizar tu mercado local y tu competencia real.",
        companyName: "Nombre del negocio o proyecto",
        companyNamePlaceholder: "Ej: Clínica Dental Sonrisa",
        businessStatus: "¿Ya está funcionando?",
        statusOperating: "Sí, ya estoy operando",
        statusLaunching: "Estoy preparando el lanzamiento",
        statusIdea: "Solo es una idea por ahora",
        hasLocation: "¿Tienes un local abierto al público?",
        hasLocationYes: "Sí, tengo local",
        hasLocationNo: "No, trabajo sin local",
        address: "Dirección del local",
        addressPlaceholder: "Ej: Calle Gran Vía 28, Madrid",
        schedule: "Horario de apertura (opcional)",
        schedulePlaceholder: "Ej: Lunes a viernes 9:00–18:00",
        zone: "Zona donde trabajas",
        zonePlaceholder: "Ej: Madrid capital, Zona sur",
    },
    step2: {
        title: "Qué haces y para quién",
        subtitle: "Describe tu actividad y tus clientes",
        microcopy: "Con esto afinamos el análisis de competencia y oportunidades.",
        offering: "¿Qué ofreces?",
        offeringPlaceholder: "Ej: Clases de yoga, Reparación de móviles, Consultoría fiscal",
        sector: "Sector",
        sectorPlaceholder: "Buscar sector...",
        niche: "Nicho o especialidad",
        nichePlaceholder: "Ej: Yoga prenatal, Pantallas de iPhone, Autónomos",
        customerType: "¿Tus clientes son…?",
        customerPeople: "Personas",
        customerPeopleExample: "clientes particulares",
        customerCompanies: "Empresas",
        customerCompaniesExample: "negocios, pymes, equipos",
        customerBoth: "Ambos",
        salesChannels: "¿Cómo vendes?",
        salesOnline: "Online",
        salesInPerson: "Presencial",
        salesBoth: "Ambas",
    },
    step3: {
        title: "Tu presencia digital",
        subtitle: "Lo que tienes hoy y lo que quieres conseguir",
        microcopy: "Si no tienes web, podemos crear una base y luego mejorarla.",
        hasWeb: "¿Tienes una página web?",
        hasWebYes: "Sí, tengo web",
        hasWebNo: "No tengo web",
        webUrl: "URL de tu web",
        webUrlPlaceholder: "https://tu-negocio.com",
        wantWebCreated: "Quiero que Drako me cree una página básica",
        currentSocials: "Tus redes actuales (opcional)",
        desiredSocials: "Redes que quieres activar",
        instagram: "Instagram",
        facebook: "Facebook",
        linkedin: "LinkedIn",
        tiktok: "TikTok",
        youtube: "YouTube",
        other: "Otra",
    },
    step4: {
        title: "¿Qué quieres conseguir?",
        subtitle: "Elige tu prioridad principal y hasta 2 secundarias",
        microcopy: "Esto define el primer plan de acción que Drako preparará para ti.",
        selectPrimary: "Tu prioridad principal",
        selectSecondary: "Puedes seleccionar hasta 2 más (opcional)",
        goalClients: "Conseguir más clientes",
        goalOrganize: "Organizar mi negocio",
        goalAutomate: "Automatizar tareas repetitivas",
        goalSocial: "Mejorar redes sociales y contenido",
        goalFinance: "Controlar gastos e ingresos",
        goalAI: "Crear procesos y equipos con IA",
        goalOther: "Otra",
        goalOtherPlaceholder: "Describe qué quieres conseguir...",
    },
    step5: {
        title: "¿En qué áreas quieres ayuda?",
        subtitle: "Selecciona las que te interesen ahora",
        microcopy: "Selecciona lo que te interesa ahora; luego podrás añadir más.",
        departments: [
            { id: "marketing", label: "Marketing", description: "Captación, campañas, anuncios" },
            { id: "social_media", label: "Redes sociales", description: "Contenido y publicación" },
            { id: "clients", label: "Clientes", description: "Seguimiento, relaciones, pipeline" },
            { id: "automation", label: "Automatización", description: "Ahorrar tiempo con IA" },
            { id: "finance", label: "Finanzas", description: "Gastos, ingresos, reportes" },
            { id: "strategy", label: "Análisis y estrategia", description: "Competencia, oportunidades" },
            { id: "support", label: "Soporte al cliente", description: "Respuestas, WhatsApp, emails" },
            { id: "web", label: "Web y presencia online", description: "Mejorar o crear tu web" },
            { id: "other", label: "Otro", description: "Algo que no está en la lista" },
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
        microcopy: "This helps us analyze your local market and real competition.",
        companyName: "Business or project name",
        companyNamePlaceholder: "E.g.: Smile Dental Clinic",
        businessStatus: "Is it already running?",
        statusOperating: "Yes, I'm already operating",
        statusLaunching: "I'm preparing the launch",
        statusIdea: "It's just an idea for now",
        hasLocation: "Do you have a physical location open to the public?",
        hasLocationYes: "Yes, I have a location",
        hasLocationNo: "No, I work without one",
        address: "Location address",
        addressPlaceholder: "E.g.: 123 Main Street, London",
        schedule: "Opening hours (optional)",
        schedulePlaceholder: "E.g.: Mon–Fri 9:00–18:00",
        zone: "Area where you work",
        zonePlaceholder: "E.g.: Central London, South zone",
    },
    step2: {
        title: "What you do and for whom",
        subtitle: "Describe your activity and your customers",
        microcopy: "This helps us fine-tune competition analysis and opportunities.",
        offering: "What do you offer?",
        offeringPlaceholder: "E.g.: Yoga classes, Phone repairs, Tax consulting",
        sector: "Sector",
        sectorPlaceholder: "Search sector...",
        niche: "Niche or specialty",
        nichePlaceholder: "E.g.: Prenatal yoga, iPhone screens, Freelancers",
        customerType: "Your customers are…?",
        customerPeople: "Individuals",
        customerPeopleExample: "private customers",
        customerCompanies: "Businesses",
        customerCompaniesExample: "companies, SMEs, teams",
        customerBoth: "Both",
        salesChannels: "How do you sell?",
        salesOnline: "Online",
        salesInPerson: "In person",
        salesBoth: "Both",
    },
    step3: {
        title: "Your digital presence",
        subtitle: "What you have today and what you want to achieve",
        microcopy: "If you don't have a website, we can create a basic one and improve it later.",
        hasWeb: "Do you have a website?",
        hasWebYes: "Yes, I have one",
        hasWebNo: "No, I don't",
        webUrl: "Your website URL",
        webUrlPlaceholder: "https://your-business.com",
        wantWebCreated: "I want Drako to create a basic website for me",
        currentSocials: "Your current social media (optional)",
        desiredSocials: "Social networks you want to activate",
        instagram: "Instagram",
        facebook: "Facebook",
        linkedin: "LinkedIn",
        tiktok: "TikTok",
        youtube: "YouTube",
        other: "Other",
    },
    step4: {
        title: "What do you want to achieve?",
        subtitle: "Choose your main priority and up to 2 secondary ones",
        microcopy: "This defines the first action plan Drako will prepare for you.",
        selectPrimary: "Your main priority",
        selectSecondary: "You can select up to 2 more (optional)",
        goalClients: "Get more customers",
        goalOrganize: "Organize my business",
        goalAutomate: "Automate repetitive tasks",
        goalSocial: "Improve social media and content",
        goalFinance: "Track expenses and income",
        goalAI: "Create processes and teams with AI",
        goalOther: "Other",
        goalOtherPlaceholder: "Describe what you want to achieve...",
    },
    step5: {
        title: "Where do you need help?",
        subtitle: "Select the areas you're interested in now",
        microcopy: "Pick what interests you now; you can add more later.",
        departments: [
            { id: "marketing", label: "Marketing", description: "Acquisition, campaigns, ads" },
            { id: "social_media", label: "Social media", description: "Content and publishing" },
            { id: "clients", label: "Clients", description: "Follow-up, relationships, pipeline" },
            { id: "automation", label: "Automation", description: "Save time with AI" },
            { id: "finance", label: "Finance", description: "Expenses, income, reports" },
            { id: "strategy", label: "Analysis & strategy", description: "Competition, opportunities" },
            { id: "support", label: "Customer support", description: "Responses, WhatsApp, emails" },
            { id: "web", label: "Web & online presence", description: "Improve or create your website" },
            { id: "other", label: "Other", description: "Something not on the list" },
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
