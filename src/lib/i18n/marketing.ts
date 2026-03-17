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
        system: "System",
        products: "Products",
        journal: "Journal",
        vision: "Vision",
        about: "About",
        contact: "Contact",
        localeSwitch: "ES",
      },
      home: {
        heroTitle: "Drako Systems — Holding of specialized SaaS",
        heroSubtitle: "We design, build, and operate SaaS with a shared factory, governance, and automation layer.",
        tags: ["Holding", "SaaS factory", "Governance", "Automation", "AI agents"],
        ctas: {
          products: "See products",
          system: "Explore the system",
          vision: "Read the vision",
          journal: "Go to journal",
        },
        whatIs: {
          title: "What is Drako Systems",
          body:
            "Drako Systems is the central house of the holding. We operate an internal system to create and run SaaS with automation, governance, and observability from day one.",
        },
        products: {
          title: "Ecosystem",
          subtitle: "SaaS built and operated by Drako.",
          sections: [
            {
              title: "Active",
              description: "Products operating with customers and internal agents.",
              body: "Live SaaS with governance, observability, and automation baked in.",
              items: [{ name: "SocialFlow", desc: "Social automation operated by agents with supervised workflows." }],
              empty: "We'll publish more live products soon.",
            },
            {
              title: "Building",
              description: "New SaaS lines under construction and internal pilots.",
              body: "We prioritize verticals where automation and governance give an unfair advantage. Each new product inherits Drako's factory, telemetry, and ops playbooks.",
              items: [],
              empty: "We will share new SaaS lines as they reach pilot stage.",
            },
            {
              title: "Research",
              description: "Exploring automation layers and autonomous operations.",
              body: "Research on self-operating SaaS, agents for reliability, and automated pipelines from build to production.",
              items: [],
              empty: "Research tracks will be shared publicly when ready.",
            },
          ],
        },
        system: {
          title: "The Drako system",
          blurb: "Internal factory and governance layer to launch and operate SaaS.",
          points: [
            "Reusable foundations: identity, security, billing, observability, and CI/CD",
            "Governance and data access baked in",
            "Operations with agents, playbooks, and telemetry",
            "Path toward self-operating SaaS",
          ],
        },
        journal: {
          title: "Journal",
          summary: "Editorial space for architecture, product progress, automation, and research across the holding.",
        },
        vision: {
          title: "Vision",
          body: "Build software that operates itself: SaaS with automation, agents, and guardrails to scale with minimal human loops.",
        },
        closing: {
          title: "Explore the ecosystem",
          body: "Discover our products, how we build them, and the vision guiding the holding.",
          ctas: {
            products: "Products",
            system: "System",
            journal: "Journal",
            vision: "Vision",
          },
        },
      },
      system: {
        title: "How we operate the holding",
        intro: "Internal infrastructure of the holding: factory, governance, observability, and automation to create and run SaaS. Not a product for sale.",
        pillars: [
          {
            title: "SaaS factory",
            body: "Repeatable pipelines with shared foundations: identity, billing, security, observability, CI/CD, and service templates versioned for every launch.",
          },
          {
            title: "Governance",
            body: "Guardrails for data, access, and compliance. Services start with RBAC, auditability, change review, and ownership encoded in code.",
          },
          {
            title: "Automation",
            body: "Agents and jobs orchestrate operations: deployments, health checks, remediation, and L2 support with playbooks and telemetry.",
          },
          {
            title: "Future vision",
            body: "SaaS that self-diagnose, self-remediate, and scale with minimal human intervention.",
          },
        ],
        practices: [
          "Service/front templates with built-in auth, logging, metrics, and tracing.",
          "Consistent environments per project with secrets, policies, and feature flags.",
          "Versioned playbooks for incidents, releases, and rollbacks.",
          "Unified telemetry for performance, reliability, cost, and compliance signals.",
        ],
      },
      products: {
        title: "Holding SaaS",
        subtitle: "Ecosystem of SaaS built and operated by Drako.",
        sections: [
          {
            title: "Active",
            description: "Products operating with customers and internal agents.",
            body: "Live SaaS with governance, observability, and automation baked in.",
            items: [{ name: "SocialFlow", desc: "Social automation operated by agents and supervised workflows." }],
            empty: "We'll publish more live products soon.",
          },
          {
            title: "Building",
            description: "New SaaS lines under construction and internal pilots.",
            body: "We prioritize verticals where automation and governance give an unfair advantage. Each new product inherits Drako's factory, telemetry, and ops playbooks.",
            items: [],
            empty: "We will share new SaaS lines as they reach pilot stage.",
          },
          {
            title: "Research",
            description: "Exploring automation layers and autonomous operations.",
            body: "Research on self-operating SaaS, agents for reliability, and automated pipelines from build to production.",
            items: [],
            empty: "Research tracks will be shared publicly when ready.",
          },
        ],
      },
      journal: {
        title: "Journal",
        subtitle: "Editorial space for Drako's engineering, product, and research narratives.",
        intro: "We document how we build and operate SaaS: architecture decisions, automation patterns, governance, and product learnings.",
        themes: [
          { title: "Architecture", desc: "How we design services, observability, and deployment pipelines across the holding." },
          { title: "Products", desc: "Progress and lessons from SocialFlow and future SaaS lines." },
          { title: "Research", desc: "Experiments on self-operating software, agents, and automated remediation." },
          { title: "Operations", desc: "Playbooks, reliability practices, and cost-performance insights." },
          { title: "Automation", desc: "Pipelines, agents, and workflows to operate products with minimal friction." },
        ],
        empty: "No public articles yet. We'll publish first entries here.",
      },
      vision: {
        title: "Towards self-operating SaaS",
        subtitle: "Build software that runs itself: automated operations, accountable agents, and governance by default.",
        pillars: [
          {
            title: "Deep automation",
            body: "Automate the critical path: build, deploy, observe, remediate. Everything auditable and reversible.",
          },
          {
            title: "Software that runs software",
            body: "Agents coordinate deployments, monitoring, cost control, and recovery so humans focus on intent and design.",
          },
          {
            title: "AI agents",
            body: "Domain-specialized, versioned, observable. Metrics, guardrails, and human-in-the-loop where needed.",
          },
          {
            title: "Self-managing SaaS",
            body: "Products that detect drift, apply fixes, and scale within policy without manual toil.",
          },
        ],
        roadmap: [
          "Telemetry → detection → automated action → review loops.",
          "Agents execute playbooks with human review only on risk or exceptions.",
          "Environments that auto-heal and prevent config drift.",
          "Governance and audit stitched into every automation path.",
        ],
      },
      about: {
        title: "About Drako Systems",
        intro: "Central house of the holding and technology lab. We build and operate SaaS with a shared factory, governance, and automation discipline.",
        blocks: [
          {
            title: "What it is",
            body: "The holding's factory and governance layer: infrastructure, pipelines, and playbooks to ship and run products reliably.",
          },
          {
            title: "Why it exists",
            body: "Born to launch specialized SaaS faster, with standards by default and less operational toil through automation and agents.",
          },
          {
            title: "Mission",
            body: "Build software that builds and operates software: products that can govern, remediate, and scale with minimal human loops.",
          },
          {
            title: "How we work",
            body: "Small teams, clear metrics, fast deploy cycles. Shared infra, observability, and runbooks across every product.",
          },
        ],
      },
      contact: {
        title: "Contact",
        subtitle: "Institutional channel for products, collaborations, partners, talent, or general inquiries.",
        reasonsTitle: "Reasons to contact",
        reasons: [
          { title: "Products", desc: "SocialFlow and future SaaS lines from the holding." },
          { title: "Collaboration", desc: "Alliances or joint work around automation and governance." },
          { title: "Partners", desc: "Infrastructure, security, or data partners aligned with our roadmap." },
          { title: "Talent", desc: "Engineering, product, or research profiles interested in the mission." },
          { title: "General", desc: "Other institutional conversations." },
        ],
        form: {
          name: "Name",
          email: "Email",
          reason: "Reason",
          message: "Message",
          submit: "Send",
          placeholderName: "Your name",
          placeholderEmail: "you@example.com",
          placeholderMessage: "Share context and how we can collaborate",
        },
        note: "We review each message manually. No automated promises; we reply when it makes sense for both sides.",
        footer: "You can also write to contacto@drako.systems.",
      },
    };
  }

  return {
    nav: {
      home: "Inicio",
      system: "Sistema",
      products: "Productos",
      journal: "Journal",
      vision: "Visión",
      about: "Sobre Drako",
      contact: "Contacto",
      localeSwitch: "EN",
    },
    home: {
      heroTitle: "Drako Systems — Holding de SaaS especializados",
      heroSubtitle: "Diseñamos, construimos y operamos SaaS con una factory común, gobernanza y automatización.",
      tags: ["Holding", "SaaS factory", "Gobernanza", "Automatización", "Agentes IA"],
      ctas: {
        products: "Ver productos",
        system: "Explorar sistema",
        vision: "Leer visión",
        journal: "Ir al journal",
      },
      whatIs: {
        title: "Qué es Drako Systems",
        body:
          "Drako Systems es la casa central del holding. Operamos un sistema interno para crear y operar SaaS con automatización, gobernanza y observabilidad desde el día uno.",
      },
      products: {
        title: "Ecosistema",
        subtitle: "SaaS creados y operados por Drako.",
        sections: [
          {
            title: "Activos",
            description: "Productos en operación con clientes y agentes internos.",
            body: "SaaS vivos con gobernanza, observabilidad y automatización integradas.",
            items: [{ name: "SocialFlow", desc: "Automatización de redes sociales operada por agentes y flujos supervisados." }],
            empty: "Publicaremos más productos activos pronto.",
          },
          {
            title: "Building",
            description: "Nuevas líneas SaaS en construcción y pilotos internos.",
            body: "Priorizamos verticales donde la automatización y la gobernanza aportan ventaja. Cada producto hereda la factory de Drako, telemetría y playbooks de operación.",
            items: [],
            empty: "Compartiremos nuevas líneas cuando entren en piloto.",
          },
          {
            title: "Research",
            description: "Exploración de capas de automatización y operación autónoma.",
            body: "Investigación en SaaS autogestionados, agentes para fiabilidad y pipelines automatizadas de build a producción.",
            items: [],
            empty: "Las líneas de research se compartirán cuando estén listas.",
          },
        ],
      },
      system: {
        title: "El sistema Drako",
        blurb: "Factory y capa de gobernanza interna para lanzar y operar SaaS.",
        points: [
          "Fundamentos reutilizables: identidad, seguridad, billing, observabilidad y CI/CD",
          "Gobernanza y acceso a datos incorporados",
          "Operaciones con agentes, playbooks y telemetría",
          "Camino hacia SaaS más autogestionados",
        ],
      },
      journal: {
        title: "Journal",
        summary: "Espacio editorial para arquitectura, avances de producto, automatización e investigación del holding.",
      },
      vision: {
        title: "Visión",
        body: "Construir software que se opera solo: SaaS con automatización, agentes y guardrails para escalar con mínima intervención.",
      },
      closing: {
        title: "Explora el ecosistema",
        body: "Conoce nuestros productos, el sistema que los impulsa y la visión que guía al holding.",
        ctas: {
          products: "Productos",
          system: "Sistema",
          journal: "Journal",
          vision: "Visión",
        },
      },
    },
    system: {
      title: "Cómo operamos el holding",
      intro: "Infraestructura interna del holding: factory, gobernanza, observabilidad y automatización para crear y operar SaaS. No es un producto a la venta.",
      pillars: [
        {
          title: "SaaS factory",
          body: "Pipelines reproducibles con bases compartidas: identidad, billing, seguridad, observabilidad, CI/CD y plantillas versionadas para cada lanzamiento.",
        },
        {
          title: "Gobernanza",
          body: "Guardrails de datos, acceso y cumplimiento. Los servicios nacen con RBAC, auditoría, revisión de cambios y ownership codificado.",
        },
        {
          title: "Automatización",
          body: "Agentes y jobs orquestan operaciones: despliegues, health checks, remediación y soporte L2 con playbooks y telemetría.",
        },
        {
          title: "Visión futura",
          body: "SaaS que se autodiagnostican, remediarán y escalarán con mínima intervención humana.",
        },
      ],
      practices: [
        "Plantillas de servicios/front con auth, logging, métricas y trazas integradas.",
        "Entornos consistentes con secretos, políticas y feature flags por proyecto.",
        "Playbooks versionados para incidentes, releases y rollbacks.",
        "Telemetría unificada para performance, fiabilidad, costos y cumplimiento.",
      ],
    },
    products: {
      title: "SaaS del holding",
      subtitle: "Ecosistema de SaaS creados y operados por Drako.",
      sections: [
        {
          title: "Activos",
          description: "Productos en operación con clientes y agentes internos.",
          body: "SaaS vivos con gobernanza, observabilidad y automatización integradas.",
          items: [{ name: "SocialFlow", desc: "Automatización de redes sociales operada por agentes y flujos supervisados." }],
          empty: "Publicaremos más productos activos pronto.",
        },
        {
          title: "Building",
          description: "Nuevas líneas SaaS en construcción y pilotos internos.",
          body: "Priorizamos verticales donde la automatización y la gobernanza aportan ventaja. Cada producto hereda la factory de Drako, telemetría y playbooks de operación.",
          items: [],
          empty: "Compartiremos nuevas líneas cuando entren en piloto.",
        },
        {
          title: "Research",
          description: "Exploración de capas de automatización y operación autónoma.",
          body: "Investigación en SaaS autogestionados, agentes para fiabilidad y pipelines automatizadas de build a producción.",
          items: [],
          empty: "Las líneas de research se compartirán cuando estén listas.",
        },
      ],
    },
    journal: {
      title: "Journal",
      subtitle: "Espacio editorial de Drako para arquitectura, producto y research.",
      intro: "Documentamos cómo construimos y operamos SaaS: decisiones técnicas, automatización, gobernanza y aprendizajes de producto.",
      themes: [
        { title: "Arquitectura", desc: "Diseño de servicios, observabilidad y despliegue en el holding." },
        { title: "Productos", desc: "Avances y lecciones de SocialFlow y futuras líneas SaaS." },
        { title: "Research", desc: "Experimentos sobre software que se opera solo, agentes y remediación automática." },
        { title: "Operaciones", desc: "Playbooks, prácticas de fiabilidad y eficiencia de costos." },
        { title: "Automatización", desc: "Pipelines, agentes y flujos para operar productos con mínima fricción." },
      ],
      empty: "Aún no hay artículos públicos. Publicaremos aquí los primeros avances.",
    },
    vision: {
      title: "Hacia SaaS que se operan solos",
      subtitle: "Construir software que se administra solo: operaciones automatizadas, agentes responsables y gobernanza por defecto.",
      pillars: [
        {
          title: "Automatización profunda",
          body: "Automatizar el camino crítico: build, deploy, observar, remediar. Todo auditable y reversible.",
        },
        {
          title: "Software que opera software",
          body: "Agentes coordinan despliegues, monitoreo, control de costos y recuperación; los humanos se enfocan en intención y diseño.",
        },
        {
          title: "Agentes IA",
          body: "Especializados por dominio, versionados y observables. Métricas, guardrails y human-in-the-loop donde importa.",
        },
        {
          title: "SaaS autogestionados",
          body: "Productos que detectan deriva, aplican fixes y escalan dentro de política, sin trabajo manual.",
        },
      ],
      roadmap: [
        "Telemetría → detección → acción automatizada → revisión.",
        "Agentes que ejecutan playbooks con revisión humana solo ante riesgo o excepciones.",
        "Entornos que se autoreparan y evitan deriva de configuración.",
        "Gobernanza y auditoría cosidas en cada automatización.",
      ],
    },
    about: {
      title: "Sobre Drako Systems",
      intro: "Casa central del holding y laboratorio tecnológico. Construimos y operamos SaaS con factory compartida, gobernanza y automatización disciplinada.",
      blocks: [
        {
          title: "Qué es",
          body: "La factory y capa de gobernanza del holding: infraestructura, pipelines y playbooks para lanzar y operar productos confiables.",
        },
        {
          title: "Por qué existe",
          body: "Nació para lanzar SaaS especializados más rápido, con estándares por defecto y menos carga operativa gracias a automatización y agentes.",
        },
        {
          title: "Misión",
          body: "Construir software que crea y opera software: productos capaces de gobernar, remediar y escalar con pocos loops humanos.",
        },
        {
          title: "Cómo trabajamos",
          body: "Equipos pequeños, métricas claras, ciclos rápidos. Infra compartida, observabilidad y runbooks comunes en cada producto.",
        },
      ],
    },
    contact: {
      title: "Contacto",
      subtitle: "Canal institucional para productos, colaboraciones, partners, talento o consultas generales.",
      reasonsTitle: "Motivos de contacto",
      reasons: [
        { title: "Productos", desc: "SocialFlow y futuras líneas SaaS del holding." },
        { title: "Colaboración", desc: "Alianzas o trabajo conjunto en automatización y gobernanza." },
        { title: "Partners", desc: "Partners de infraestructura, seguridad o datos alineados a nuestro roadmap." },
        { title: "Talento", desc: "Perfiles de ingeniería, producto o research interesados en la misión." },
        { title: "General", desc: "Otras conversaciones institucionales." },
      ],
      form: {
        name: "Nombre",
        email: "Email",
        reason: "Motivo",
        message: "Mensaje",
        submit: "Enviar",
        placeholderName: "Tu nombre",
        placeholderEmail: "tu@email.com",
        placeholderMessage: "Comparte contexto y cómo podemos colaborar",
      },
      note: "Revisamos cada mensaje de forma manual. Sin promesas automáticas; respondemos cuando tiene sentido para ambas partes.",
      footer: "También puedes escribir a contacto@drako.systems.",
    },
  };
}
