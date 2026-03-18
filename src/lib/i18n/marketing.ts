export type MarketingLocale = "es" | "en";

export const supportedMarketingLocales: MarketingLocale[] = ["es", "en"];
export const defaultMarketingLocale: MarketingLocale = "es";

export const isSupportedMarketingLocale = (value?: string | null): value is MarketingLocale => {
  if (!value) return false;
  return supportedMarketingLocales.includes(value.toLowerCase() as MarketingLocale);
};

export const normalizeMarketingLocale = (value?: string | null): MarketingLocale => {
  if (!value) return defaultMarketingLocale;
  const normalized = value.toLowerCase();
  return isSupportedMarketingLocale(normalized) ? (normalized as MarketingLocale) : defaultMarketingLocale;
};

// Backwards compatibility for previous naming used across the app
export const resolveMarketingLocale = normalizeMarketingLocale;

export const getLocalizedPath = (locale: MarketingLocale, path: string): string => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (locale === defaultMarketingLocale) return cleanPath === "//" ? "/" : cleanPath;
  if (cleanPath === "/") return `/${locale}`;
  return `/${locale}${cleanPath}`;
};

export function extractLocaleFromPath(pathname: string): { locale: MarketingLocale; pathWithoutLocale: string; rawLocale?: string } {
  const segments = pathname.split("/").filter(Boolean);
  const candidate = segments[0];
  if (isSupportedMarketingLocale(candidate)) {
    const rest = segments.slice(1).join("/");
    const normalizedRest = rest ? `/${rest}` : "/";
    return { locale: normalizeMarketingLocale(candidate), pathWithoutLocale: normalizedRest, rawLocale: candidate };
  }
  return { locale: defaultMarketingLocale, pathWithoutLocale: pathname || "/", rawLocale: undefined };
}

export function resolveLocaleFromRequest(pathname: string, queryLocale?: string | null) {
  const pathInfo = extractLocaleFromPath(pathname);
  const locale = normalizeMarketingLocale(queryLocale || pathInfo.rawLocale);
  const pathWithoutLocale = pathInfo.pathWithoutLocale;
  return { locale, pathWithoutLocale };
}

export function getMarketingCopy(locale: MarketingLocale) {
  if (locale === "en") {
    return {
      nav: {
        home: "Home",
        system: "How we work",
        products: "Products",
        journal: "Journal",
        vision: "Vision",
        about: "About",
        contact: "Contact",
        localeSwitch: "ES",
      },
      home: {
        heroTitle: "Drako runs AI products for problems you can't ignore.",
        heroSubtitle: "We step into real operations to cut lag, steady decisions, and keep teams moving.",
        tags: ["AI products", "Real impact", "Applied AI", "Decision intelligence"],
        ctas: {
          products: "See products",
          system: "How we work",
          vision: "Read the vision",
          journal: "Go to journal",
        },
        whatIs: {
          title: "What we do",
          body: "We build and operate AI products that land inside demanding companies and stay running.",
        },
        products: {
          title: "Ecosystem",
          subtitle: "AI products from Drako.",
          sections: [
            {
              title: "Active",
              description: "Products solving real problems today.",
              body: "Live products that keep work moving and decisions sharp.",
              items: [{ name: "SocialFlow", desc: "Marketing teams reduce manual coordination; publishing, replies, and reporting stay on track." }],
              empty: "More live products soon.",
            },
            {
              title: "Building",
              description: "Lines in build stage with clear outcomes.",
              body: "Products in build, each tied to a specific role and result.",
              items: [],
              empty: "New lines will be shared at pilot stage.",
            },
            {
              title: "Research",
              description: "Applied research on autonomy and responsible AI.",
              body: "Experiments to make AI more useful and accountable for future products.",
              items: [],
              empty: "Tracks will be shared when ready.",
            },
          ],
        },
        system: {
          title: "How we build AI solutions",
          blurb: "We name the real problem, ship fast, and keep people in the loop.",
          points: [
            "Problem first: name the pain and the metric to move",
            "AI where it saves hours or reduces risk",
            "Pace: ship weekly, learn from real use",
            "Assurance: care in delivery without exposing the plumbing",
          ],
        },
        journal: {
          title: "Journal",
          summary: "Ideas, progress, and applied learnings on bringing AI to real problems.",
        },
        vision: {
          title: "AI that makes work unmistakably better.",
          body: "Autonomy where it speeds you up, oversight where it matters most.",
        },
        closing: {
          title: "Explore the ecosystem",
          body: "See the products we build and how we approach new problems.",
          ctas: {
            products: "Products",
            system: "How we work",
            journal: "Journal",
            vision: "Vision",
          },
        },
      },
      system: {
        title: "How we build AI solutions",
        intro: "Clarity on the problem, useful automation, fast and responsible delivery.",
        pillars: [
          {
            title: "Clarity",
            body: "We define the problem and the metric that must move.",
          },
          {
            title: "Useful automation",
            body: "We apply AI where it removes friction and errors for people.",
          },
          {
            title: "Pace",
            body: "Short cycles, frequent releases, and feedback from real use.",
          },
          {
            title: "Reliability",
            body: "Quality and care in delivery without exposing internal machinery.",
          },
        ],
        practices: [
          "Problem-first scopes tied to an outcome.",
          "Prototypes to measurable results quickly.",
          "Feedback loops with real users, iterate fast.",
          "Safeguards and responsibility built into delivery.",
        ],
      },
      products: {
        title: "AI products from Drako",
        subtitle: "AI products built to remove bottlenecks and bad calls.",
        sections: [
          {
            title: "Active",
            description: "Products solving real problems today.",
            body: "Live products that keep work moving and decisions sharp.",
            items: [{ name: "SocialFlow", desc: "Marketing teams reduce manual coordination; publishing, replies, and reporting stay on track." }],
            empty: "More live products soon.",
          },
          {
            title: "Building",
            description: "Lines in build stage with clear outcomes.",
            body: "Products in build, each tied to a specific role and result.",
            items: [],
            empty: "New lines will be shared at pilot stage.",
          },
          {
            title: "Research",
            description: "Applied research on autonomy and responsible AI.",
            body: "Experiments to make AI more useful and accountable for future products.",
            items: [],
            empty: "Tracks will be shared when ready.",
          },
        ],
      },
      journal: {
        title: "Journal",
        subtitle: "Ideas, progress, and applied learnings.",
        intro: "We share how we bring AI to real problems: design decisions, lessons, and vision in motion.",
        themes: [
          { title: "Cases", desc: "What we learned solving real problems." },
          { title: "Product", desc: "Progress and decisions in our products." },
          { title: "Applied research", desc: "Experiments and findings in AI." },
          { title: "Responsible operation", desc: "How we balance autonomy and care." },
          { title: "Delivery", desc: "Rhythm, feedback, and iteration." },
        ],
        empty: "No public articles yet. We'll publish first entries here.",
      },
      vision: {
        title: "AI to improve work and critical services.",
        subtitle: "More autonomy where it helps, more responsibility where it matters.",
        pillars: [
          {
            title: "Utility",
            body: "AI that makes a real impact and improves work.",
          },
          {
            title: "Trust",
            body: "Decisions traced and cared for, especially when people are impacted.",
          },
          {
            title: "Responsible future",
            body: "Automation without losing human oversight where it matters.",
          },
          {
            title: "Scale",
            body: "Bring these improvements to more industries and contexts.",
          },
        ],
        roadmap: [
          "Apply AI to real problems, measure outcomes.",
          "Expand to new sectors with clear safeguards.",
          "Improve decisioning transparency and user control.",
          "Scale responsibly with better checks and accountability.",
        ],
      },
      about: {
        title: "About Drako",
        intro: "We are Drako: a team allergic to wasted effort. We build AI products that fix real work and stand up to pressure.",
        blocks: [
          {
            title: "Who we are",
            body: "People who prefer shipping over talking and measure themselves by outcomes.",
          },
          {
            title: "Why we exist",
            body: "We use AI to remove friction in critical work, not to chase hype.",
          },
          {
            title: "Mission",
            body: "Put AI to work on problems that matter and prove it with outcomes.",
          },
          {
            title: "How we work",
            body: "Small teams, clear ownership, fast cycles, and tight loops with users.",
          },
        ],
      },
      contact: {
        title: "Contact",
        subtitle: "Tell us the problem you want to solve. Let's see if we can help.",
        reasonsTitle: "Reasons to contact",
        reasons: [
          { title: "Products", desc: "Our products and how they might help you." },
          { title: "Collaborations", desc: "Building together around applied AI." },
          { title: "Partners", desc: "Allies in data or security." },
          { title: "Talent", desc: "Profiles in engineering, product, or research." },
          { title: "Other", desc: "Any conversation where we can add value." },
        ],
        form: {
          name: "Name",
          email: "Email",
          reason: "Reason",
          message: "Message",
          submit: "Send",
          placeholderName: "Your name",
          placeholderEmail: "you@example.com",
          placeholderMessage: "Share the problem and how we can help",
        },
        note: "We read every message with care.",
        footer: "You can also write to contacto@drako.systems.",
      },
    };
  }

  return {
    nav: {
      home: "Inicio",
      system: "Cómo trabajamos",
      products: "Productos",
      journal: "Journal",
      vision: "Visión",
      about: "Sobre Drako",
      contact: "Contacto",
      localeSwitch: "EN",
    },
    home: {
      heroTitle: "Drako opera productos de IA para problemas que no admiten excusas.",
      heroSubtitle: "Entramos en operaciones reales para cortar demoras, afinar decisiones y mantener a los equipos en ritmo.",
      tags: ["Productos de IA", "Impacto real", "IA aplicada", "Decisiones precisas"],
      ctas: {
        products: "Ver productos",
        system: "Cómo trabajamos",
        vision: "Leer visión",
        journal: "Ir al journal",
      },
      whatIs: {
        title: "Qué hacemos",
        body: "Creamos y operamos productos de IA que se integran en empresas exigentes y se quedan funcionando.",
      },
      products: {
        title: "Ecosistema",
        subtitle: "Productos de IA de Drako.",
        sections: [
          {
            title: "Activos",
            description: "Productos que ya resuelven problemas reales.",
            body: "Productos en vivo que mantienen el trabajo en ritmo y las decisiones precisas.",
            items: [{ name: "SocialFlow", desc: "Equipos de marketing reducen coordinación manual; publicaciones, respuestas y reporting se mantienen al día." }],
            empty: "Más activos pronto.",
          },
          {
            title: "Building",
            description: "Líneas en construcción con resultados claros.",
            body: "Productos en construcción, cada uno ligado a un rol y un resultado.",
            items: [],
            empty: "Nuevas líneas al entrar en piloto.",
          },
          {
            title: "Research",
            description: "Investigación aplicada sobre autonomía y IA responsable.",
            body: "Experimentos para que la IA sea útil y responsable en futuros productos.",
            items: [],
            empty: "Se publicará cuando esté listo.",
          },
        ],
      },
      system: {
        title: "Cómo construimos soluciones de IA",
        blurb: "Nombramos el problema real, entregamos rápido y mantenemos a las personas en control.",
        points: [
          "Problema primero: nombrar el dolor y la métrica a mover",
          "IA donde ahorra horas o reduce riesgo",
          "Ritmo: entregas semanales, aprendizaje en uso real",
          "Confianza: cuidado en la entrega sin mostrar la cocina",
        ],
      },
      journal: {
        title: "Journal",
        summary: "Ideas, avances y aprendizajes aplicados.",
      },
      vision: {
        title: "IA que mejora el trabajo sin dudas.",
        body: "Autonomía donde acelera, supervisión donde más importa.",
      },
      closing: {
        title: "Explora el ecosistema",
        body: "Conoce los productos que creamos y cómo abordamos nuevos problemas.",
        ctas: {
          products: "Productos",
          system: "Cómo trabajamos",
          journal: "Journal",
          vision: "Visión",
        },
      },
    },
    system: {
      title: "Cómo construimos soluciones de IA",
      intro: "Claridad en el problema, IA útil, entrega rápida y responsable.",
      pillars: [
        {
          title: "Claridad",
          body: "Definimos el problema y la métrica que debe moverse.",
        },
        {
          title: "IA útil",
          body: "Aplicamos IA donde hace un impacto real para las personas.",
        },
        {
          title: "Ritmo",
          body: "Ciclos cortos, releases frecuentes y feedback real.",
        },
        {
          title: "Fiabilidad",
          body: "Calidad y cuidado en la entrega sin exponer la cocina interna.",
        },
      ],
      practices: [
        "Alcances ligados a un resultado medible.",
        "Prototipos a resultados rápidos.",
        "Feedback con usuarios reales, iteración veloz.",
        "Salvaguardas y responsabilidad en cada entrega.",
      ],
    },
    products: {
      title: "Productos de IA de Drako",
      subtitle: "Productos de IA para eliminar cuellos de botella y malas decisiones.",
      sections: [
        {
          title: "Activos",
          description: "Productos que ya resuelven problemas reales.",
          body: "Productos en vivo que mantienen el trabajo en ritmo y las decisiones precisas.",
          items: [{ name: "SocialFlow", desc: "Equipos de marketing reducen coordinación manual; publicaciones, respuestas y reporting se mantienen al día." }],
          empty: "Más activos pronto.",
        },
        {
          title: "Building",
          description: "Líneas en construcción con resultados claros.",
          body: "Productos en construcción, cada uno ligado a un rol y un resultado.",
          items: [],
          empty: "Nuevas líneas al entrar en piloto.",
        },
        {
          title: "Research",
          description: "Investigación aplicada sobre autonomía y IA responsable.",
          body: "Experimentos para que la IA sea útil y responsable en futuros productos.",
          items: [],
          empty: "Se publicará cuando esté listo.",
        },
      ],
    },
    journal: {
      title: "Journal",
      subtitle: "Ideas, avances y aprendizajes aplicados.",
      intro: "Compartimos cómo llevamos IA a problemas reales: decisiones de diseño, aprendizajes y visión en progreso.",
      themes: [
        { title: "Casos", desc: "Qué aprendimos resolviendo problemas reales." },
        { title: "Producto", desc: "Avances y decisiones en nuestros productos." },
        { title: "Investigación aplicada", desc: "Experimentos y hallazgos en IA aplicada." },
        { title: "Operación responsable", desc: "Cómo equilibramos autonomía y cuidado." },
        { title: "Entrega", desc: "Ritmo, feedback e iteración." },
      ],
      empty: "Aún no hay artículos públicos. Publicaremos las primeras entradas aquí.",
    },
    vision: {
      title: "IA para mejorar trabajo y servicios críticos.",
      subtitle: "Más autonomía donde aporta, más responsabilidad donde importa.",
      pillars: [
        {
          title: "Utilidad",
          body: "IA que hace un impacto real y mejora el trabajo.",
        },
        {
          title: "Confianza",
          body: "Decisiones trazables y cuidadas, sobre todo cuando impactan a personas.",
        },
        {
          title: "Futuro responsable",
          body: "Automatizar sin perder supervisión humana donde es crítico.",
        },
        {
          title: "Escala",
          body: "Llevar estas mejoras a más industrias y contextos.",
        },
      ],
      roadmap: [
        "Aplicar IA a problemas reales, medir resultados.",
        "Expandir a nuevos sectores con salvaguardas claras.",
        "Mejorar transparencia de decisiones y control del usuario.",
        "Escalar con responsabilidad y mejores checks.",
      ],
    },
    about: {
      title: "Sobre Drako",
      intro: "Somos Drako: un equipo alérgico al esfuerzo desperdiciado. Construimos productos de IA que arreglan el trabajo y aguantan presión.",
      blocks: [
        {
          title: "Quiénes somos",
          body: "Gente que prefiere entregar antes que hablar y se mide por resultados.",
        },
        {
          title: "Por qué existimos",
          body: "Usamos IA para quitar fricción en trabajo crítico, no por moda.",
        },
        {
          title: "Misión",
          body: "Poner la IA a trabajar en problemas que importan y demostrarlo con resultados.",
        },
        {
          title: "Cómo trabajamos",
          body: "Equipos pequeños, ownership claro, ciclos rápidos y feedback cercano con usuarios.",
        },
      ],
    },
    contact: {
      title: "Contacto",
      subtitle: "Cuéntanos el problema que quieres resolver. Hablemos si podemos aportar.",
      reasonsTitle: "Motivos de contacto",
      reasons: [
        { title: "Productos", desc: "Nuestros productos y cómo pueden ayudarte." },
        { title: "Colaboraciones", desc: "Construir juntos con IA aplicada." },
        { title: "Partners", desc: "Aliados en datos o seguridad." },
        { title: "Talento", desc: "Perfiles de ingeniería, producto o research." },
        { title: "Otros", desc: "Cualquier conversación donde podamos aportar." },
      ],
      form: {
        name: "Nombre",
        email: "Email",
        reason: "Motivo",
        message: "Mensaje",
        submit: "Enviar",
        placeholderName: "Tu nombre",
        placeholderEmail: "tu@ejemplo.com",
        placeholderMessage: "Cuéntanos el problema y cómo ayudar",
      },
      note: "Leemos cada mensaje con atención.",
      footer: "También puedes escribir a contacto@drako.systems.",
    },
  };
}
