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
        heroTitle: "Infrastructure running",
        heroSubtitle: "Central control. Agents execute.",
        tags: ["Holding", "Operational infrastructure", "Governance", "Automation", "Agents"],
        ctas: {
          products: "See products",
          system: "Explore the system",
          vision: "Read the vision",
          journal: "Go to journal",
        },
        whatIs: {
          title: "What is Drako Systems",
          body: "Central house of the holding. SaaS operated with automation, governance, observability on.",
        },
        products: {
          title: "Ecosystem",
          subtitle: "SaaS operated by Drako.",
          sections: [
            {
              title: "Active",
              description: "Products in operation with agents.",
              body: "Live SaaS with governance, observability, automation built in.",
              items: [{ name: "SocialFlow", desc: "Social automation operated by agents with supervised workflows." }],
              empty: "More live products soon.",
            },
            {
              title: "Building",
              description: "SaaS lines integrating into the infrastructure.",
              body: "Each product plugs into control plane, telemetry, runbooks from day one.",
              items: [],
              empty: "New lines will be shared at pilot stage.",
            },
            {
              title: "Research",
              description: "Autonomous operation and control tracks.",
              body: "Research on self-operating SaaS, reliability agents, automated pipelines.",
              items: [],
              empty: "Tracks will be shared when ready.",
            },
          ],
        },
        system: {
          title: "The Drako system",
          blurb: "Operational infrastructure of the holding. Not for sale.",
          points: [
            "Shared foundations: identity, security, billing, observability, CI/CD",
            "Governance coded and enforced",
            "Autonomous deploy, QA, support",
            "Path to self-operating SaaS",
          ],
        },
        journal: {
          title: "Journal",
          summary: "Editorial space for architecture, product progress, automation, and research across the holding.",
        },
        vision: {
          title: "Vision",
          body: "Software that runs itself. Governance and agents by default.",
        },
        closing: {
          title: "Explore the ecosystem",
          body: "Discover the products under operation and the system behind them.",
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
        intro: "Internal infrastructure of the holding. Governance, observability, automation active. Not for sale.",
        pillars: [
          {
            title: "Control plane",
            body: "Standardized stack: identity, billing, security, observability, CI/CD, templates versioned for every launch.",
          },
          {
            title: "Governance",
            body: "Access and compliance encoded. RBAC, audit, change control, and ownership as code.",
          },
          {
            title: "Automation",
            body: "Autonomous deploy, health, remediation, L2 support under playbooks and telemetry.",
          },
          {
            title: "Future vision",
            body: "SaaS that self-diagnose, self-remediate, and scale within policy.",
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
        subtitle: "Ecosystem of SaaS operated by Drako.",
        sections: [
          {
            title: "Active",
            description: "Products in operation with agents.",
            body: "Live SaaS with governance, observability, automation built in.",
            items: [{ name: "SocialFlow", desc: "Social automation operated by agents and supervised workflows." }],
            empty: "More live products soon.",
          },
          {
            title: "Building",
            description: "SaaS lines integrating into the infrastructure.",
            body: "Each product plugs into control plane, telemetry, runbooks from day one.",
            items: [],
            empty: "New lines will be shared at pilot stage.",
          },
          {
            title: "Research",
            description: "Autonomous operation and control tracks.",
            body: "Research on self-operating SaaS, reliability agents, automated pipelines.",
            items: [],
            empty: "Tracks will be shared when ready.",
          },
        ],
      },
      journal: {
        title: "Journal",
        subtitle: "Editorial space for Drako's engineering, product, and research narratives.",
        intro: "We document how we operate SaaS: architecture decisions, automation patterns, governance, and product learnings.",
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
        subtitle: "Software that runs itself. Automated operations, accountable agents, governance by default.",
        pillars: [
          {
            title: "Deep automation",
            body: "Critical path automated: build, deploy, observe, remediate. Auditable, reversible.",
          },
          {
            title: "Software that runs software",
            body: "Agents coordinate deployment, monitoring, cost control, recovery. Humans set intent.",
          },
          {
            title: "AI agents",
            body: "Domain-specialized, versioned, observable. Metrics and guardrails enforced.",
          },
          {
            title: "Self-managing SaaS",
            body: "Products that detect drift, apply fixes, and scale within policy.",
          },
        ],
        roadmap: [
          "Telemetry → detection → automated action → review.",
          "Agents execute playbooks; humans review only on risk.",
          "Environments auto-heal and prevent drift.",
          "Governance and audit in every automation path.",
        ],
      },
      about: {
        title: "About Drako Systems",
        intro: "Central house of the holding and technology lab. We operate SaaS with shared infrastructure, governance, and automation.",
        blocks: [
          {
            title: "What it is",
            body: "The holding's operational layer: infrastructure, pipelines, and playbooks to run products reliably.",
          },
          {
            title: "Why it exists",
            body: "Built to operate specialized SaaS with standards by default and minimal toil.",
          },
          {
            title: "Mission",
            body: "Software that operates software: products that govern, remediate, scale with minimal human loops.",
          },
          {
            title: "How we work",
            body: "Small teams, clear metrics, fast deploy cycles. Shared infra, observability, and runbooks across products.",
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
      heroTitle: "Infraestructura en ejecución",
      heroSubtitle: "Control central. Agentes ejecutan.",
      tags: ["Holding operativo", "Infraestructura", "Gobernanza", "Automatización", "Agentes"],
      ctas: {
        products: "Ver productos",
        system: "Explorar sistema",
        vision: "Leer visión",
        journal: "Ir al journal",
      },
      whatIs: {
        title: "Qué es Drako Systems",
        body: "Casa central del holding. SaaS operados con automatización, gobernanza y observabilidad activas.",
      },
      products: {
        title: "Ecosistema",
        subtitle: "SaaS operados por Drako.",
        sections: [
          {
            title: "Activos",
            description: "Productos en operación con agentes.",
            body: "SaaS vivos con gobernanza, observabilidad y automatización integradas.",
            items: [{ name: "SocialFlow", desc: "Automatización de redes sociales operada por agentes y flujos supervisados." }],
            empty: "Más activos pronto.",
          },
          {
            title: "Building",
            description: "Líneas SaaS en integración y despliegue interno.",
            body: "Cada producto conectado desde el día cero a infraestructura, telemetría y runbooks del holding.",
            items: [],
            empty: "Nuevas líneas al entrar en piloto.",
          },
          {
            title: "Research",
            description: "Operación autónoma y control continuo.",
            body: "SaaS autooperados, agentes de fiabilidad, pipelines automatizadas.",
            items: [],
            empty: "Se publicará cuando esté listo.",
          },
        ],
      },
      system: {
        title: "El sistema Drako",
        blurb: "Infraestructura operativa del holding. No se vende.",
        points: [
          "Fundamentos compartidos: identidad, seguridad, billing, observabilidad, CI/CD",
          "Gobernanza codificada y acceso controlado",
          "Despliegue, QA y soporte autónomos",
          "Trayectoria hacia SaaS autooperados",
        ],
      },
      journal: {
        title: "Journal",
        summary: "Espacio editorial para arquitectura, avances de producto, automatización e investigación del holding.",
      },
      vision: {
        title: "Visión",
        body: "Software que se opera solo. Gobernanza y agentes por defecto.",
      },
      closing: {
        title: "Explora el ecosistema",
        body: "Conoce los productos en operación y el sistema que los gobierna.",
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
      intro: "Infraestructura interna. Gobernanza, observabilidad y automatización activas. No se vende.",
      pillars: [
        {
          title: "Plano de control",
          body: "Stack estandarizado: identidad, billing, seguridad, observabilidad, CI/CD, plantillas versionadas.",
        },
        {
          title: "Gobernanza",
          body: "Acceso y cumplimiento codificados. RBAC, auditoría, control de cambios y ownership como código.",
        },
        {
          title: "Automatización",
          body: "Despliegues, health, remediación, soporte L2 autónomos bajo playbooks y telemetría.",
        },
        {
          title: "Visión futura",
          body: "SaaS que se autodiagnostican, se remedian y escalan dentro de política.",
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
      subtitle: "Ecosistema de SaaS operados por Drako.",
      sections: [
        {
          title: "Activos",
          description: "Productos en operación con agentes.",
          body: "SaaS vivos con gobernanza, observabilidad y automatización integradas.",
          items: [{ name: "SocialFlow", desc: "Automatización de redes sociales operada por agentes y flujos supervisados." }],
          empty: "Más activos pronto.",
        },
        {
          title: "Building",
          description: "Líneas SaaS en integración y despliegue interno.",
          body: "Cada producto conectado desde el día cero a infraestructura, telemetría y runbooks del holding.",
          items: [],
          empty: "Nuevas líneas al entrar en piloto.",
        },
        {
          title: "Research",
          description: "Operación autónoma y control continuo.",
          body: "SaaS autooperados, agentes de fiabilidad, pipelines automatizadas.",
          items: [],
          empty: "Se publicará cuando esté listo.",
        },
      ],
    },
    journal: {
      title: "Journal",
      subtitle: "Espacio editorial de Drako para arquitectura, producto y research.",
      intro: "Documentamos cómo operamos SaaS: decisiones técnicas, automatización, gobernanza y aprendizajes de producto.",
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
      title: "SaaS que se operan solos",
      subtitle: "Software que se administra solo. Operaciones automatizadas, agentes responsables, gobernanza por defecto.",
      pillars: [
        {
          title: "Automatización profunda",
          body: "Camino crítico automatizado: build, deploy, observar, remediar. Auditable y reversible.",
        },
        {
          title: "Software que opera software",
          body: "Agentes coordinan despliegue, monitoreo, costos, recuperación; los humanos fijan intención.",
        },
        {
          title: "Agentes IA",
          body: "Especializados por dominio, versionados y observables. Métricas y guardrails cerrados.",
        },
        {
          title: "SaaS autogestionados",
          body: "Productos que detectan deriva, aplican fixes y escalan dentro de política.",
        },
      ],
      roadmap: [
        "Telemetría → detección → acción automatizada → revisión.",
        "Agentes ejecutan playbooks; humanos revisan solo ante riesgo.",
        "Entornos que se autoreparan y evitan deriva.",
        "Gobernanza y auditoría en cada automatización.",
      ],
    },
    about: {
      title: "Sobre Drako Systems",
      intro: "Casa central del holding y laboratorio tecnológico. Operamos SaaS con infraestructura compartida, gobernanza y automatización.",
      blocks: [
        {
          title: "Qué es",
          body: "Capa operativa del holding: infraestructura, pipelines, playbooks para ejecutar productos confiables.",
        },
        {
          title: "Por qué existe",
          body: "Nace para operar SaaS especializados con estándares por defecto y mínima carga operativa.",
        },
        {
          title: "Misión",
          body: "Software que opera software: productos que gobiernan, remediarán y escalarán con pocos loops humanos.",
        },
        {
          title: "Cómo trabajamos",
          body: "Equipos pequeños, métricas claras, ciclos rápidos. Infra compartida, observabilidad y runbooks comunes.",
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
