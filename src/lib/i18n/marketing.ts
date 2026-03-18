
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
  // Shared ES/EN for now as requested to generate specific Spanish copy
  const content = {
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
      hero: {
        title: "Construimos proyectos con inteligencia artificial que resuelven problemas reales y generan valor.",
        subtitle: "Drako no es una herramienta, es un sistema de creación de soluciones. Entramos en operaciones reales, mejoramos procesos y convertimos ideas en productos que funcionan.",
        description: "Vivimos en un momento donde la tecnología avanza más rápido que nuestra capacidad para adoptarla. Las empresas acumulan herramientas, pero pierden eficiencia. Drako existe para cerrar esa brecha. No somos consultores que dejan un powerpoint; somos constructores que implantan sistemas inteligentes en el corazón de tu operación. Analizamos el flujo de trabajo, detectamos la fricción y desplegamos soluciones de IA que liberan a tu equipo de la carga manual para que puedan dedicarse a lo que realmente importa: aportar valor, estrategia y creatividad.",
        cta: "Explorar nuestros productos",
      },
      problem: {
        title: "El problema no es la falta de talento, es cómo está diseñado el trabajo.",
        description: "Vemos equipos brillantes atrapados en bucles de tareas administrativas, corrección de errores evitables y gestión de datos fragmentados. La carga cognitiva de mantener los sistemas funcionando impide la innovación. Cuando el trabajo se diseña mal, la tecnología se convierte en un obstáculo en lugar de un acelerador. Nosotros rediseñamos ese flujo desde la base, eliminando lo superfluo y automatizando lo esencial.",
      },
      whatIs: {
        title: "Drako no crea software por crear. Construye sistemas que funcionan.",
        description: "Nuestra aproximación es radicalmente pragmática. No empezamos con la tecnología, empezamos con el dolor. Identificamos procesos rotos y construimos soluciones a medida que se integran orgánicamente. Utilizamos modelos de lenguaje y automatización avanzada no para reemplazar a las personas, sino para darles superpoderes operativos. Cada línea de código que escribimos tiene un propósito: reducir el ruido y aumentar la señal en tu negocio.",
      },
      productsPreview: {
        title: "Proyectos que ya están funcionando",
        cta: "Ver todos los productos",
      }
    },
    products: {
      title: "Productos",
      subtitle: "Soluciones operativas diseñadas para el mundo real.",
      intro: "Nuestros productos no son experimentos. Son plataformas robustas que operan hoy en empresas reales, gestionando miles de interacciones y decisiones críticas. Cada uno nace de una necesidad específica y evoluciona con el uso diario.",
      socialFlow: {
        name: "SocialFlow",
        tagline: "El sistema operativo para la comunicación de marca.",
        problem: "Los equipos de marketing modernos están saturados. Gestionar múltiples canales, mantener la coherencia de voz en cada respuesta y analizar el rendimiento en tiempo real se ha convertido en una tarea imposible de escalar manualmente. El resultado es un equipo reactivo, agotado y propenso a errores que dañan la marca.",
        solution: "SocialFlow centraliza y eleva la operación de marketing. Utiliza IA para entender el contexto profundo de tu marca, sugerir contenidos alineados y automatizar respuestas con supervisión humana. Transforma el caos de notificaciones en un flujo de trabajo sereno y controlado.",
        impact: "Transformamos departamentos de marketing estresados en redacciones ágiles. Reducimos el tiempo operativo significativamente, aseguramos que cada interacción pública refleje los valores de la empresa y liberamos a los creativos para que hagan lo que mejor saben hacer: estrategia y narrativa.",
      },
      future: {
        title: "En construcción",
        description: "Estamos desarrollando nuevas líneas de producto enfocadas en logística, análisis financiero y gestión de talento. Siempre bajo la misma premisa: IA aplicada a problemas reales."
      },
      items: [
        {
          name: "SocialFlow",
          tagline: "El sistema operativo para la comunicación de marca.",
          problem: "Los equipos de marketing modernos están saturados. Gestionar múltiples canales, mantener la coherencia de voz en cada respuesta y analizar el rendimiento en tiempo real se ha convertido en una tarea imposible de escalar manualmente. El resultado es un equipo reactivo, agotado y propenso a errores que dañan la marca.",
          solution: "SocialFlow centraliza y eleva la operación de marketing. Utiliza IA para entender el contexto profundo de tu marca, sugerir contenidos alineados y automatizar respuestas con supervisión humana. Transforma el caos de notificaciones en un flujo de trabajo sereno y controlado.",
          impact: "Transformamos departamentos de marketing estresados en redacciones ágiles. Reducimos el tiempo operativo significativamente, aseguramos que cada interacción pública refleje los valores de la empresa y liberamos a los creativos para que hagan lo que mejor saben hacer: estrategia y narrativa.",
        }
      ]
    },
    system: {
      title: "Cómo trabajamos",
      subtitle: "De la observación del problema a la solución escalable.",
      intro: "No creemos en las soluciones mágicas. Creemos en el rigor, la iteración y la ingeniería sólida. Nuestro proceso está diseñado para minimizar el riesgo y maximizar la utilidad desde el primer día.",
      steps: [
        {
          title: "1. Inmersión y Diagnóstico",
          description: "No asumimos nada. Entramos en tu operativa, hablamos con los equipos y medimos los puntos de dolor. Entendemos el 'por qué' antes de pensar en el 'cómo'. Buscamos la raíz del problema, no solo sus síntomas."
        },
        {
          title: "2. Diseño de la Solución IA",
          description: "Definimos cómo la inteligencia artificial puede aportar valor real. No aplicamos IA a todo, solo donde aporta eficiencia, precisión o escala. Diseñamos la arquitectura técnica y el flujo de interacción humano-máquina."
        },
        {
          title: "3. Construcción y Despliegue",
          description: "Desarrollamos con velocidad y solidez. Priorizamos la funcionalidad crítica y lanzamos en entornos reales lo antes posible. Nuestros sistemas están vivos: monitorizamos su desempeño y ajustamos los modelos constantemente."
        },
        {
          title: "4. Iteración y Escala",
          description: "Un producto nunca está terminado. Recogemos feedback directo de los usuarios, analizamos métricas de impacto y refinamos la solución. Escalamos la capacidad del sistema a medida que tu negocio crece."
        }
      ]
    },
    journal: {
      title: "Journal",
      subtitle: "Pensamiento en proceso.",
      intro: "Documentamos nuestros aprendizajes, errores y descubrimientos. Este no es un blog corporativo para venderte nada. Es nuestra bitácora de ingeniería y producto, donde compartimos cómo estamos resolviendo los retos de aplicar IA en el mundo real.",
      cta: "Leer las entradas"
    },
    vision: {
      title: "Visión",
      subtitle: "Hacia una simbiosis operativa.",
      content: [
        "Creemos en un futuro donde el trabajo no es una carga, sino un espacio de creación. La inteligencia artificial no viene a reemplazarnos, viene a liberarnos de la mediocridad operativa.",
        "Imaginamos empresas donde la burocracia se gestiona sola, donde los datos encuentran a las personas que los necesitan y donde las decisiones se toman con claridad absoluta. Drako construye los ladrillos de ese futuro.",
        "Nuestra responsabilidad es asegurar que esta tecnología se despliegue con ética, transparencia y control humano. No construimos cajas negras; construimos herramientas de luz."
      ],
      pillars: [
        {
            title: "Utilidad",
            body: "Resolver problemas reales con impacto directo. Si no mejora una métrica o reduce un dolor, no nos interesa."
        },
        {
            title: "Claridad",
            body: "Hacer que el trabajo sea más comprensible y controlable. La IA debe explicar sus decisiones, no ocultarlas."
        },
        {
            title: "Responsabilidad",
            body: "Aplicar tecnología sin perder el criterio humano. Automatizamos la tarea, no la responsabilidad."
        },
        {
            title: "Escala",
            body: "Construir soluciones que crecen con el tiempo. Sistemas que aprenden y mejoran cuanto más se usan."
        }
      ]
    },
    about: {
      title: "Sobre Drako",
      subtitle: "Constructores, no consultores.",
      content: [
        "Drako Systems nace de la frustración con el estado actual del software empresarial. Vimos demasiadas promesas vacías y demasiadas herramientas complejas que nadie usaba.",
        "Somos un equipo híbrido de ingenieros, diseñadores y estrategas obsesionados con la utilidad. Nos mueve la curiosidad técnica y el pragmatismo operativo. No buscamos el aplauso de la industria, buscamos que nuestros clientes duerman tranquilos sabiendo que sus sistemas funcionan.",
        "Operamos como un holding de producto: identificamos oportunidades, asignamos recursos y construimos startups verticales que resuelven problemas específicos con la profundidad que merecen."
      ]
    },
    contact: {
      title: "Hablemos de tu operación",
      subtitle: "Si sientes que tu equipo podría trabajar mejor, probablemente tengas razón.",
      intro: "No tenemos comerciales agresivos. Si nos escribes, hablarás con alguien que entiende de producto y negocio. Cuéntanos qué te preocupa, dónde ves fricción o qué idea quieres materializar.",
      form: {
        name: "Tu nombre",
        email: "Tu correo electrónico",
        role: "Tu rol o cargo",
        message: "Cuéntanos el reto o la idea",
        submit: "Iniciar conversación"
      },
      note: "Leemos y respondemos personalmente a cada mensaje que tiene sentido."
    }
  };

  return content;
}
