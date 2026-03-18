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
  const shared = {
    nav: {
      home: "Inicio",
      system: "Cómo trabajamos",
      products: "Productos",
      journal: "Journal",
      vision: "Visión",
      about: "Sobre Drako",
      contact: "Contacto",
      localeSwitch: locale === "en" ? "ES" : "EN",
    },
    home: {
      heroTitle: "Drako crea productos de IA que mejoran cómo trabajan los equipos.",
      heroSubtitle: "Automatizamos tareas reales, reducimos errores y ayudamos a que las decisiones se tomen mejor y más rápido.",
      ctas: {
        products: "Ver productos",
      },
      context: "Muchas empresas siguen funcionando con procesos lentos, trabajo manual y decisiones poco precisas. Nosotros construimos productos que cambian eso.",
      productsIntro: "Cada producto de Drako resuelve un problema concreto dentro de equipos reales.",
      productCards: [
        {
          name: "SocialFlow",
          description: "SocialFlow ayuda a equipos de marketing a gestionar contenido, respuestas y seguimiento sin perder tiempo en tareas repetitivas.",
          problem: "Publicar, responder mensajes y mantener la coherencia de marca consume más tiempo del que debería.",
          does: "Organiza publicaciones, respuestas y seguimiento en un flujo claro y centralizado.",
          changes: "Reduce el tiempo operativo, mejora la consistencia de la comunicación y permite al equipo centrarse en tareas más importantes.",
        },
      ],
    },
    system: {
      title: "Cómo trabajamos",
      subtitle: "Construimos productos que funcionan en la práctica, no en teoría.",
      blocks: [
        { title: "Entender el problema", body: "Antes de construir, entendemos bien qué está fallando y qué debería mejorar." },
        { title: "Aplicar IA con criterio", body: "Usamos inteligencia artificial donde realmente aporta valor, no donde suena bien." },
        { title: "Construir y mejorar", body: "Lanzamos rápido, aprendemos con uso real y ajustamos continuamente." },
        { title: "Cuidar el resultado", body: "Lo que construimos tiene que ser claro, útil y fiable." },
      ],
    },
    products: {
      intro: "Los productos de Drako están diseñados para resolver problemas reales en equipos que operan cada día.",
      items: [
        {
          name: "SocialFlow",
          description: "SocialFlow ayuda a equipos de marketing a gestionar contenido, respuestas y seguimiento sin perder tiempo en tareas repetitivas.",
          problem: "Publicar, responder mensajes y mantener la coherencia de marca consume más tiempo del que debería.",
          does: "Organiza publicaciones, respuestas y seguimiento en un flujo claro y centralizado.",
          changes: "Reduce el tiempo operativo, mejora la consistencia de la comunicación y permite al equipo centrarse en tareas más importantes.",
        },
      ],
    },
    journal: {
      title: "Journal",
      subtitle: "Un espacio donde compartimos cómo aplicamos la IA a problemas reales.",
      text: "Aquí reunimos ideas, avances de producto y aprendizajes que nacen del trabajo real. No es teoría. Es lo que vemos, lo que probamos y lo que funciona.",
      cta: "Leer artículos",
    },
    vision: {
      title: "Visión",
      subtitle: "Creemos que la IA puede mejorar cómo se trabaja y cómo se toman decisiones.",
      text: "La inteligencia artificial es una herramienta para hacer el trabajo más eficiente, más claro y más escalable. Nuestro objetivo es aplicarla donde realmente aporta valor: operaciones, comunicación y toma de decisiones.",
      pillars: [
        { title: "Utilidad", body: "Resolver problemas reales con impacto directo." },
        { title: "Claridad", body: "Hacer que el trabajo sea más comprensible y controlable." },
        { title: "Responsabilidad", body: "Aplicar tecnología sin perder el criterio humano." },
        { title: "Escala", body: "Construir soluciones que crecen con el tiempo." },
      ],
    },
    about: {
      title: "Sobre Drako",
      paragraphs: [
        "Drako es un holding que desarrolla productos de inteligencia artificial enfocados en resolver problemas reales en empresas.",
        "Nos centramos en construir herramientas que funcionan en el día a día, no en ideas que se quedan en presentaciones.",
        "Buscamos mejorar cómo trabajan los equipos: menos fricción, más claridad y mejores decisiones.",
      ],
    },
    contact: {
      title: "Contacto",
      subtitle: "Cuéntanos qué estás intentando mejorar. Si podemos ayudarte, lo hablamos.",
      options: ["Productos", "Colaboraciones", "Partners", "Talento", "Otros"],
      note: "Leemos cada mensaje con atención.",
      form: {
        name: "Nombre",
        email: "Email",
        reason: "Motivo",
        message: "Mensaje",
        submit: "Enviar",
        placeholderName: "Tu nombre",
        placeholderEmail: "tu@ejemplo.com",
        placeholderMessage: "Escribe los detalles",
      },
    },
  };

  return shared;
}
