
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
        name: "Socialcors",
        tagline: "El sistema operativo para la comunicación de marca.",
        badge: "Socialcors v1.0",
        hero: {
            title: "Tu marca no debería depender de quién está de turno hoy.",
            subtitle: "Socialcors es el sistema operativo que estandariza, protege y escala la comunicación digital de tu empresa. Deja de apagar fuegos y empieza a construir activos.",
            cta: "Solicitar piloto",
            ctaSecondary: "Ver vídeo de producto", // Less prominent, actionable
            trustedBy: "Operando críticas en tiempo real para:"
        },
        problem: {
            title: "El caos operativo es el enemigo de la marca.",
            subtitle: "La falta de control no es neutra: genera coste. Equipos pierden entre 10 y 20 horas semanales en tareas repetitivas y un error de tono puede costar semanas de reputación.",
            cards: [
                {
                    icon: "🔥",
                    title: "Riesgo Reputacional",
                    text: "Un error de tono o una respuesta improvisada pueden destruir años de construcción de marca en minutos."
                },
                {
                    icon: "📉",
                    title: "Ineficiencia Operativa",
                    text: "Validar un copy toma 3 días. Responder una crisis toma 4 horas. La burocracia interna asfixia la relevancia."
                },
                {
                    icon: "🌑",
                    title: "Ceguera de Datos",
                    text: "Sin trazabilidad, no hay mejora. Los reportes manuales en PDF ocultan la realidad de la operación."
                }
            ]
        },
        realFunctionality: {
            title: "Qué hace Socialcors en la práctica",
            subtitle: "Funcionalidad real para problemas diarios. Sin humo.",
            features: [
                {
                    title: "Inbox Multicanal Unificado",
                    desc: "Centraliza comentarios, DMs y menciones de LinkedIn, X e Instagram en una sola cola de trabajo priorizada."
                },
                {
                    title: "Respuestas Asistidas con Guardarrieles",
                    desc: "La IA redacta borradores basándose estrictamente en tu manual de estilo. Tú apruebas o editas, pero nunca empiezas de cero."
                },
                {
                    title: "Flujos de Aprobación Jerárquicos",
                    desc: "Define quién puede publicar qué. Los juniors redactan, los seniors validan. Nada sale sin el 'ok' correcto."
                },
                {
                    title: "Historial de Auditoría Forense",
                    desc: "Registro inmutable de cada interacción: quién escribió, quién aprobó y cuándo se publicó. Trazabilidad total."
                },
                {
                    title: "Automatización de Reglas de Negocio",
                    desc: "Configura 'triggers': si es una duda frecuente, responde solo. Si detecta enfado, escala a soporte humano inmediatamente."
                }
            ]
        },
        icp: {
            title: "Para quién es Socialcors",
            for: [
                "Equipos de marketing con alto volumen de interacción diaria.",
                "Empresas reguladas (Fintech, Salud, Legal) donde el error es costoso.",
                "Marcas B2B que necesitan coherencia total en todos sus canales.",
                "Equipos distribuidos que necesitan ordenar su proceso de publicación."
            ],
            notFor: [
                "Freelancers o marcas personales pequeñas.",
                "Proyectos en fase inicial sin volumen de comunicación.",
                "Equipos que buscan viralidad rápida sin importar el riesgo."
            ]
        },
        integrations: {
            title: "Se integra con los canales que ya usas",
            subtitle: "Conectamos con tu ecosistema actual. Sin migraciones dolorosas.",
            items: ["LinkedIn", "X (Twitter)", "Instagram", "Salesforce", "HubSpot", "Slack", "Zendesk"]
        },
        pilot: {
            badge: "Cupo Limitado Q4",
            title: "Programa Piloto: Validación Operativa",
            subtitle: "No queremos venderte software. Queremos arreglar tu flujo de trabajo. Danos 4 semanas para demostrar el impacto con tus propios datos.",
            price: "Setup único de calibración",
            features: [
                "Configuración técnica completa (Auth + Integraciones)",
                "Fine-tuning del modelo con tu Brand Book y tono histórico",
                "Acceso ilimitado para 3 usuarios durante 30 días",
                "Canal privado de Slack con nuestro equipo de ingeniería"
            ],
            cta: "Solicitar plaza en el piloto",
            guarantee: "Garantía de ROI: Si no reducimos tu tiempo de gestión un 30% en el primer mes, te devolvemos el 100% del coste de setup."
        },
        solution: {
            title: "Ingeniería aplicada a la conversación.",
            subtitle: "No es una herramienta de publicación. Es un entorno de control de calidad y eficiencia.",
            features: [
                {
                    title: "Guardianes de Marca IA",
                    desc: "Configuramos modelos de lenguaje con tu manual de estilo. Socialcors revisa cada borrador antes de que salga, sugiriendo correcciones de tono, gramática y cumplimiento normativo en tiempo real.",
                    icon: "🛡️"
                },
                {
                    title: "Flujos de Aprobación Líquidos",
                    desc: "El sistema sabe quién debe aprobar qué. El contenido de bajo riesgo pasa rápido; las comunicaciones corporativas escalan automáticamente a los responsables correctos.",
                    icon: "🌊"
                },
                {
                    title: "Inbox Unificado Inteligente",
                    desc: "Centraliza todas las conversaciones. La IA pre-redacta respuestas basadas en tu base de conocimiento y categoriza automáticamente cada interacción por sentimiento y urgencia.",
                    icon: "⚡"
                },
                {
                    title: "Analítica de Sentimiento Real",
                    desc: "Más allá de los likes. Entendemos cómo se siente tu audiencia. Detectamos anomalías negativas antes de que se conviertan en crisis de relaciones públicas.",
                    icon: "📊"
                }
            ]
        },
        howItWorks: {
            title: "Cómo se integra en tu operación",
            steps: [
                {
                    num: "01",
                    title: "Conexión y Calibración",
                    text: "Conectamos tus canales y alimentamos el modelo con tu histórico de mejores publicaciones y guías de estilo. En 48 horas, Socialcors 'habla' como tu mejor copywriter."
                },
                {
                    num: "02",
                    title: "Adopción del Equipo",
                    text: "Tu equipo sigue trabajando donde prefiere (Slack, Teams o nuestra interfaz). Socialcors actúa como una capa invisible que asiste, no que interrumpe."
                },
                {
                    num: "03",
                    title: "Automatización Progresiva",
                    text: "Empezamos asistiendo borradores. A medida que ganas confianza, activas el piloto automático para tareas repetitivas, manteniendo supervisión humana solo donde aporta valor."
                }
            ]
        },
        impact: {
            title: "ROI medible en eficiencia y riesgo.",
            text: "Nuestros clienpiloaalFloVpmodocumantaciónLo usan porque los números cuadran.",
            metrics: [
                { value: "-40%", label: "Tiempo en gestión operativa", desc: "Menos copiar-pegar, más estrategia." },
                { value: "0", label: "Incidentes de marca", desc: "Bloqueo preventivo de contenido fuera de tono." },
                { value: "+3x", label: "Velocidad de respuesta", desc: "Atención al cliente en tiempo real, 24/7." },
                { value: "100%", label: "Trazabilidad", desc: "Auditoría completa de quién dijo qué y cuándo." }
            ]
        },
        caseStudy: {
            title: "Caso Real: FinTech Logística",
            subtitle: "Cómo una empresa B2B escaló su soporte en Twitter sin duplicar equipo.",
            before: {
                title: "Antes de Socialcors",
                items: ["4 horas de tiempo de respuesta promedio", "Tono inconsistente entre agentes", "Sin datos de motivos de contacto"]
            },
            after: {
                title: "Con Socialcors",
                items: ["15 minutos de tiempo de respuesta", "Tono unificado y profesional", "Detección automática de incidencias técnicas"]
            },
            quote: "Socialcors nos permitió triplicar el volumen de interacciones manteniendo el mismo equipo. Es la única herramienta que se ha pagado sola el primer mes."
        },
        faq: {
            title: "Preguntas Frecuentes",
            items: [
                {
                    q: "¿Socialcors reemplaza a mi equipo de marketing?",
                    a: "No. Socialcors elimina el trabajo robótico (programar, revisar erratas, etiquetar tickets) para que tu equipo se dedique a la estrategia, la creatividad y las relaciones complejas. Es un exoesqueleto, no un sustituto."
                },
                {
                    q: "¿Cuánto tarda en aprender mi tono de voz?",
                    a: "El 'cold start' toma aproximadamente 48-72 horas de análisis de tu histórico. A partir de ahí, el ajuste fino es continuo basado en las correcciones que hace tu equipo sobre las sugerencias."
                },
                {
                    q: "¿Es seguro conectar mis cuentas corporativas?",
                    a: "Absolutamente. Usamos APIs oficiales con tokens encriptados. Nunca almacenamos contraseñas y nuestros permisos de escritura son estrictamente controlados. Cumplimos con GDPR y estándares de seguridad empresarial."
                },
                {
                    q: "¿Puedo usarlo para múltiples marcas?",
                    a: "Sí. Socialcors es multi-tenant nativo. Puedes gestionar distintos tonos de voz, equipos y permisos para cada marca o región sin que se mezclen los datos ni los estilos."
                }
            ]
        },
        ctaFinal: {
            title: "¿Listo para profesionalizar tu operación?",
            subtitle: "Deja de tratar tus redes sociales como un hobby y empieza a gestionarlas como un activo empresarial crítico.",
            buttons: ["Solicitar acceso anticipado", "Agendar demo técnica"]
        }
      },
      future: {
        title: "En construcción",
        description: "Estamos desarrollando nuevas líneas de producto enfocadas en logística, análisis financiero y gestión de talento. Siempre bajo la misma premisa: IA aplicada a problemas reales.",
        items: [
          { title: "Logística Inteligente", desc: "Optimización de rutas y stock en tiempo real.", color: "bg-orange-500" },
          { title: "Finanzas Predictivas", desc: "Detección de anomalías y proyección de flujo.", color: "bg-emerald-500" },
          { title: "Talento & Cultura", desc: "Matching de skills y análisis de sentimiento.", color: "bg-cyan-500" }
        ]
      },
      cta: {
        title: "¿Tu operación necesita esto?",
        button: "Hablemos de ingeniería"
      },
      items: [
        {
          name: "Socialcors",
          tagline: "El sistema operativo para la comunicación de marca.",
          problem: "Gestión manual caótica, errores de tono y respuestas lentas que dañan la marca.",
          solution: "Un entorno unificado donde la IA redacta, supervisa y protege cada interacción pública de tu empresa.",
          impact: "Escala tu capacidad de respuesta sin aumentar el equipo y blinda tu reputación 24/7.",
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
      ],
      cta: {
        title: "Construyamos ese futuro.",
        button: "Unirse a Drako"
      }
    },
    about: {
      title: "Sobre Drako",
      subtitle: "Constructores, no consultores.",
      content: [
        "Drako Systems nace de la frustración con el estado actual del software empresarial. Vimos demasiadas promesas vacías y demasiadas herramientas complejas que nadie usaba.",
        "Somos un equipo híbrido de ingenieros, diseñadores y estrategas obsesionados con la utilidad. Nos mueve la curiosidad técnica y el pragmatismo operativo. No buscamos el aplauso de la industria, buscamos que nuestros clientes duerman tranquilos sabiendo que sus sistemas funcionan.",
        "Operamos como un holding de producto: identificamos oportunidades, asignamos recursos y construimos startups verticales que resuelven problemas específicos con la profundidad que merecen."
      ],
      valuesTitle: "Nuestros Valores",
      values: [
        { title: "Pragmatismo Radical", desc: "Construimos lo que funciona, no lo que está de moda." },
        { title: "Velocidad y Calidad", desc: "No elegimos una. Exigimos ambas en cada entrega." },
        { title: "Transparencia Total", desc: "Sin cajas negras. Entiendes lo que construimos." }
      ],
      cta: {
        title: "Trabaja con nosotros",
        button: "Ver posiciones abiertas"
      }
    },
    contact: {
      title: "Hablemos de tu operación",
      subtitle: "Si sientes que tu equipo podría trabajar mejor, probablemente tengas razón.",
      intro: "No tenemos comerciales agresivos. Si nos escribes, hablarás con alguien que entiende de producto y negocio. Cuéntanos qué te preocupa, dónde ves fricción o qué idea quieres materializar.",
      form: {
        name: "Tu nombre",
        email: "Tu correo electrónico",
        role: "Tu rol o cargo",
        interest: "¿Qué estás buscando?",
        interests: [
            "Solicitar Piloto Socialcors",
            "Consultoría de Operaciones", 
            "Explorar otros productos", 
            "Hablar con ingeniería"
        ],
        message: "Cuéntanos el reto o la idea",
        submit: "Iniciar conversación"
      },
      note: "Leemos y respondemos personalmente a cada mensaje que tiene sentido."
    }
  };

  return content;
}
