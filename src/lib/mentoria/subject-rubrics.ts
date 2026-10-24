/**
 * Mentoría — Rúbricas de evaluación para materias subjetivas
 *
 * PROBLEMA: las materias STEM (Matemáticas, Física, Química) tienen evaluación
 * objetiva — la respuesta es correcta o incorrecta. Pero Lengua, Redacción,
 * Idiomas, Historia (ensayo), Música y Arte necesitan criterios propios porque
 * "bien" y "mal" dependen del contexto, el nivel y el objetivo.
 *
 * Sin rúbricas, los agentes tutor evalúan estas materias con criterios implícitos
 * inconsistentes. Este módulo los hace explícitos y estandarizados.
 *
 * DISEÑO:
 * - Cada materia tiene entre 3 y 5 dimensiones de evaluación.
 * - Cada dimensión tiene 4 niveles: insuficiente / básico / adecuado / sobresaliente.
 * - Las rúbricas están escritas desde la perspectiva del agente tutor:
 *   qué buscar, cómo detectarlo, qué feedback dar.
 * - NO son rúbricas de calificación numérica — son guías de feedback cualitativo.
 */

// ─── Tipos base ───────────────────────────────────────────────────────────────

export type RubricLevel = "insufficient" | "basic" | "adequate" | "outstanding";

export type RubricDimensionLevel = {
  level: RubricLevel;
  /** Qué caracteriza este nivel en esta dimensión */
  description: string;
  /** Qué feedback concreto dar al alumno en este nivel */
  feedbackHint: string;
};

export type RubricDimension = {
  id: string;
  name: string;
  description: string;
  levels: Record<RubricLevel, RubricDimensionLevel>;
  /** Peso relativo de esta dimensión (0-1, suma total = 1 por rúbrica) */
  weight: number;
};

export type SubjectRubric = {
  subjectSlug: string;
  subjectName: string;
  applicableStages: Array<"primary" | "eso" | "bachillerato">;
  dimensions: RubricDimension[];
  /** Instrucción para el agente sobre cómo usar esta rúbrica en el prompt */
  agentInstruction: string;
};

// ─── Rúbrica: Lengua y Literatura ─────────────────────────────────────────────

export const RUBRIC_LENGUA: SubjectRubric = {
  subjectSlug: "lengua",
  subjectName: "Lengua y Literatura",
  applicableStages: ["primary", "eso", "bachillerato"],
  agentInstruction:
    "Al evaluar producción escrita o comprensión lectora del alumno, aplica estas dimensiones. " +
    "Identifica el nivel en cada una antes de dar feedback. Empieza siempre por lo que hizo bien, " +
    "luego indica una sola cosa a mejorar (la más importante para su nivel).",
  dimensions: [
    {
      id: "coherence",
      name: "Coherencia y organización",
      description: "Las ideas están ordenadas y se entiende el hilo del texto",
      weight: 0.30,
      levels: {
        insufficient: {
          level: "insufficient",
          description: "Las ideas no tienen orden aparente. Saltos abruptos entre párrafos o ideas.",
          feedbackHint: "Antes de escribir, haz un esquema con 3 ideas principales. ¿Cuál va primero?",
        },
        basic: {
          level: "basic",
          description: "Hay una estructura reconocible (intro/desarrollo/cierre) aunque con saltos.",
          feedbackHint: "La estructura se ve. Conecta las ideas con palabras de enlace (sin embargo, por tanto, además...).",
        },
        adequate: {
          level: "adequate",
          description: "El texto fluye lógicamente. El lector puede seguir el argumento sin perderse.",
          feedbackHint: "Buena organización. Revisa si la introducción anuncia lo que vas a decir.",
        },
        outstanding: {
          level: "outstanding",
          description: "El texto tiene cohesión interna clara, párrafos bien delimitados y progresión lógica.",
          feedbackHint: "Excelente estructura. Puedes trabajar en que cada párrafo tenga una idea central única.",
        },
      },
    },
    {
      id: "vocabulary",
      name: "Riqueza léxica",
      description: "Variedad y precisión del vocabulario usado",
      weight: 0.25,
      levels: {
        insufficient: {
          level: "insufficient",
          description: "Vocabulario muy limitado. Repetición frecuente de las mismas palabras.",
          feedbackHint: "¿Puedes sustituir esta palabra? Busca 2 sinónimos antes de continuar.",
        },
        basic: {
          level: "basic",
          description: "Vocabulario funcional pero poco variado. Algunas repeticiones evitables.",
          feedbackHint: "Bien. Ahora prueba a usar una palabra más específica para describir esto.",
        },
        adequate: {
          level: "adequate",
          description: "Buen rango léxico para su nivel. Usa vocabulario específico cuando es necesario.",
          feedbackHint: "Buen vocabulario. Cuida que las palabras técnicas estén bien usadas en contexto.",
        },
        outstanding: {
          level: "outstanding",
          description: "Vocabulario variado, preciso y adaptado al registro. Sin repeticiones innecesarias.",
          feedbackHint: "Vocabulario excelente. El siguiente nivel es el control del registro formal/informal.",
        },
      },
    },
    {
      id: "grammar",
      name: "Corrección gramatical y ortográfica",
      description: "Ausencia de errores de gramática, puntuación y ortografía",
      weight: 0.25,
      levels: {
        insufficient: {
          level: "insufficient",
          description: "Errores frecuentes que dificultan la comprensión. Puntuación ausente o incorrecta.",
          feedbackHint: "Lee el texto en voz alta. ¿Dónde haces pausa? Ahí va una coma o un punto.",
        },
        basic: {
          level: "basic",
          description: "Errores presentes pero no bloquean la comprensión. Puntuación inconsistente.",
          feedbackHint: "Bien. Revisa específicamente los signos de puntuación antes de entregar.",
        },
        adequate: {
          level: "adequate",
          description: "Pocos errores. Los que hay son de tipo ortográfico, no de estructura gramatical.",
          feedbackHint: "Casi sin errores. Revisa las tildes de las palabras esdrújulas.",
        },
        outstanding: {
          level: "outstanding",
          description: "Sin errores relevantes. Puntuación correcta y controlada.",
          feedbackHint: "Gramática impecable. Trabaja ahora en la complejidad sintáctica (oraciones subordinadas).",
        },
      },
    },
    {
      id: "comprehension",
      name: "Comprensión lectora",
      description: "Capacidad de extraer información explícita e implícita de un texto",
      weight: 0.20,
      levels: {
        insufficient: {
          level: "insufficient",
          description: "No identifica la idea principal. Confunde datos del texto con inferencias propias.",
          feedbackHint: "Lee solo el primer párrafo. ¿De qué trata? Escribe una frase antes de seguir.",
        },
        basic: {
          level: "basic",
          description: "Identifica información explícita pero no hace inferencias.",
          feedbackHint: "Bien, localizas los datos. Ahora: ¿qué quiere decir el autor con esto?",
        },
        adequate: {
          level: "adequate",
          description: "Entiende la idea principal y algunas implícitas. Puede hacer inferencias simples.",
          feedbackHint: "Buena comprensión. ¿Cuál es la intención del autor al escribir este texto?",
        },
        outstanding: {
          level: "outstanding",
          description: "Comprensión profunda. Identifica el propósito, la actitud del autor y el contexto.",
          feedbackHint: "Comprensión sobresaliente. Trabaja en analizar los recursos estilísticos que usa el autor.",
        },
      },
    },
  ],
};

// ─── Rúbrica: Idiomas (Inglés, Francés, etc.) ────────────────────────────────

export const RUBRIC_IDIOMAS: SubjectRubric = {
  subjectSlug: "idiomas",
  subjectName: "Idiomas",
  applicableStages: ["primary", "eso", "bachillerato"],
  agentInstruction:
    "Al evaluar producción oral o escrita en el idioma extranjero, aplica estas dimensiones. " +
    "Prioriza la comunicación sobre la perfección: si el alumno se hace entender, es un éxito. " +
    "Los errores son parte del aprendizaje — corrígelos una sola vez y de forma breve, " +
    "sin interrumpir el flujo comunicativo.",
  dimensions: [
    {
      id: "communicative_effectiveness",
      name: "Eficacia comunicativa",
      description: "¿El mensaje llega? ¿El receptor entiende lo que se quiere decir?",
      weight: 0.35,
      levels: {
        insufficient: {
          level: "insufficient",
          description: "El mensaje es muy difícil de entender incluso con esfuerzo.",
          feedbackHint: "Intenta de nuevo con palabras más sencillas que conozcas bien.",
        },
        basic: {
          level: "basic",
          description: "El mensaje llega con esfuerzo. Hay fallos que obstruyen parcialmente.",
          feedbackHint: "Se entiende la idea principal. Mira esta parte: ¿cómo lo dirías mejor?",
        },
        adequate: {
          level: "adequate",
          description: "El mensaje es claro aunque con algunos errores.",
          feedbackHint: "Comunicación efectiva. Ahora trabaja en sonar más natural.",
        },
        outstanding: {
          level: "outstanding",
          description: "El mensaje es claro, natural y apropiado al contexto.",
          feedbackHint: "Excelente. Prueba a añadir matices (probably, although, however...).",
        },
      },
    },
    {
      id: "grammar_structures",
      name: "Estructuras gramaticales",
      description: "Uso correcto de los tiempos verbales y estructuras del nivel",
      weight: 0.25,
      levels: {
        insufficient: {
          level: "insufficient",
          description: "Errores sistemáticos en las estructuras básicas del nivel.",
          feedbackHint: "Repasemos el tiempo verbal que deberías usar aquí. ¿Cuál es?",
        },
        basic: {
          level: "basic",
          description: "Domina las estructuras más simples. Errores frecuentes en las complejas.",
          feedbackHint: "Las estructuras básicas bien. Aquí usarías mejor [estructura]. ¿Por qué?",
        },
        adequate: {
          level: "adequate",
          description: "Usa bien las estructuras del nivel con errores ocasionales.",
          feedbackHint: "Buen uso gramatical. Atención a [punto concreto del nivel].",
        },
        outstanding: {
          level: "outstanding",
          description: "Manejo fluido de las estructuras del nivel, incluyendo las complejas.",
          feedbackHint: "Gramática sólida. Trabaja en estructuras del siguiente nivel.",
        },
      },
    },
    {
      id: "vocabulary_range",
      name: "Rango léxico",
      description: "Variedad y adecuación del vocabulario en el idioma extranjero",
      weight: 0.25,
      levels: {
        insufficient: {
          level: "insufficient",
          description: "Vocabulario muy limitado. Recurre constantemente a la L1.",
          feedbackHint: "¿Conoces otra palabra en [idioma] para decir esto?",
        },
        basic: {
          level: "basic",
          description: "Vocabulario funcional para las necesidades comunicativas básicas.",
          feedbackHint: "Bien. ¿Cómo lo dirías de otra manera sin usar esa palabra?",
        },
        adequate: {
          level: "adequate",
          description: "Vocabulario variado y apropiado para su nivel.",
          feedbackHint: "Buen léxico. Prueba a usar un phrasal verb aquí.",
        },
        outstanding: {
          level: "outstanding",
          description: "Vocabulario rico, variado e idiomático.",
          feedbackHint: "Léxico sobresaliente. Trabaja en expresiones coloquiales y registros formales.",
        },
      },
    },
    {
      id: "pronunciation_fluency",
      name: "Pronunciación y fluidez (oral)",
      description: "Solo para producción oral: ritmo, pausas y pronunciación",
      weight: 0.15,
      levels: {
        insufficient: {
          level: "insufficient",
          description: "Pausas muy largas o pronunciación que impide la comprensión.",
          feedbackHint: "Lee este fragmento en voz alta dos veces antes de responder.",
        },
        basic: {
          level: "basic",
          description: "Pronunciación inteligible con pausas frecuentes.",
          feedbackHint: "Se entiende bien. Para la fluidez: intenta no traducir en tu cabeza antes de hablar.",
        },
        adequate: {
          level: "adequate",
          description: "Buena fluidez para su nivel. Pronunciación correcta en general.",
          feedbackHint: "Buena fluidez. Presta atención a la entonación de las preguntas.",
        },
        outstanding: {
          level: "outstanding",
          description: "Habla con fluidez y entonación natural.",
          feedbackHint: "Fluidez natural. Trabaja en el acento de las sílabas tónicas.",
        },
      },
    },
  ],
};

// ─── Rúbrica: Música ──────────────────────────────────────────────────────────

export const RUBRIC_MUSICA: SubjectRubric = {
  subjectSlug: "musica",
  subjectName: "Música",
  applicableStages: ["primary", "eso"],
  agentInstruction:
    "La música combina teoría (que es evaluable con precisión) y práctica (que es subjetiva). " +
    "Evalúa la teoría con rigor; evalúa la práctica con estas dimensiones. " +
    "Para trabajo teórico (lectura de notas, compases, teoría musical) usa criterios objetivos. " +
    "Para análisis auditivo o composición, usa estas rúbricas.",
  dimensions: [
    {
      id: "music_theory",
      name: "Comprensión teórica",
      description: "Conocimiento de elementos musicales: notas, ritmo, compases, figuras",
      weight: 0.40,
      levels: {
        insufficient: {
          level: "insufficient",
          description: "No identifica los elementos básicos (notas, figuras rítmicas).",
          feedbackHint: "Empecemos por las notas del pentagrama. ¿Puedes decirme qué nota es esta?",
        },
        basic: {
          level: "basic",
          description: "Identifica los elementos básicos pero comete errores en los compuestos.",
          feedbackHint: "Bien las notas básicas. Ahora: ¿cuántos tiempos tiene esta figura?",
        },
        adequate: {
          level: "adequate",
          description: "Maneja bien los conceptos del nivel. Identifica elementos con precisión.",
          feedbackHint: "Buena teoría. Trabaja en identificar la tonalidad de un fragmento.",
        },
        outstanding: {
          level: "outstanding",
          description: "Teoría sólida. Aplica los conceptos en análisis de piezas reales.",
          feedbackHint: "Excelente. ¿Puedes analizar la estructura de esta pieza?",
        },
      },
    },
    {
      id: "listening_analysis",
      name: "Análisis auditivo",
      description: "Capacidad de identificar instrumentos, géneros y características al escuchar",
      weight: 0.35,
      levels: {
        insufficient: {
          level: "insufficient",
          description: "Dificultad para identificar instrumentos o características básicas.",
          feedbackHint: "Escucha de nuevo. ¿Escuchas instrumentos de cuerda o de viento?",
        },
        basic: {
          level: "basic",
          description: "Identifica familias de instrumentos y géneros básicos.",
          feedbackHint: "Bien. ¿Cómo describirías el tempo de esta pieza? ¿Rápido o lento?",
        },
        adequate: {
          level: "adequate",
          description: "Identifica instrumentos específicos, tempo, dinámica y estilo.",
          feedbackHint: "Buen oído. Ahora identifica cuándo cambia la dinámica en este fragmento.",
        },
        outstanding: {
          level: "outstanding",
          description: "Análisis detallado: estructura, instrumentación, período histórico, compositor.",
          feedbackHint: "Análisis sobresaliente. ¿A qué período musical pertenece y por qué?",
        },
      },
    },
    {
      id: "musical_expression",
      name: "Expresión musical (composición / interpretación)",
      description: "Si el alumno crea o interpreta música: intención expresiva y creatividad",
      weight: 0.25,
      levels: {
        insufficient: {
          level: "insufficient",
          description: "La composición o interpretación no transmite ninguna intención.",
          feedbackHint: "¿Qué quieres expresar con esto? Empieza por decidir el carácter (alegre, tranquilo...)",
        },
        basic: {
          level: "basic",
          description: "Hay intención pero la ejecución no la refleja claramente.",
          feedbackHint: "Se nota que buscas algo concreto. ¿Cómo podrías cambiar el ritmo para lograrlo?",
        },
        adequate: {
          level: "adequate",
          description: "La intención expresiva es reconocible y está reflejada en las decisiones musicales.",
          feedbackHint: "Se entiende la emoción que quieres transmitir. Trabaja en la dinámica.",
        },
        outstanding: {
          level: "outstanding",
          description: "La composición o interpretación tiene identidad propia y es coherente.",
          feedbackHint: "Sobresaliente. ¿Puedes explicar tus decisiones musicales?",
        },
      },
    },
  ],
};

// ─── Rúbrica: Educación Artística / Plástica ─────────────────────────────────

export const RUBRIC_ARTE: SubjectRubric = {
  subjectSlug: "arte",
  subjectName: "Educación Artística",
  applicableStages: ["primary", "eso"],
  agentInstruction:
    "El arte no tiene respuestas únicas correctas. Evalúa el proceso, la intención y el desarrollo, " +
    "no el resultado comparado con un ideal externo. El objetivo es que el alumno entienda por qué " +
    "tomó las decisiones que tomó y cómo puede mejorar en su propio camino. " +
    "Nunca compares con 'cómo debería verse'. Compara con versiones anteriores del mismo alumno.",
  dimensions: [
    {
      id: "technique",
      name: "Dominio técnico",
      description: "Control del material y la técnica usados (dibujo, pintura, collage...)",
      weight: 0.30,
      levels: {
        insufficient: {
          level: "insufficient",
          description: "Dificultad básica con el material. El resultado no refleja la intención.",
          feedbackHint: "¿Qué es lo que más te cuesta con este material? Practicamos solo eso.",
        },
        basic: {
          level: "basic",
          description: "Manejo funcional de la técnica. El resultado es reconocible.",
          feedbackHint: "Buen manejo básico. ¿Qué parte de la técnica quieres mejorar?",
        },
        adequate: {
          level: "adequate",
          description: "Dominio claro de la técnica para su nivel. Los errores son conscientemente asumidos.",
          feedbackHint: "Buena técnica. Prueba a variar la presión o la velocidad.",
        },
        outstanding: {
          level: "outstanding",
          description: "La técnica está al servicio de la expresión. Se nota un camino propio.",
          feedbackHint: "Técnica sobresaliente. ¿Cómo podrías llevarla más lejos?",
        },
      },
    },
    {
      id: "creative_intention",
      name: "Intención creativa",
      description: "¿El alumno sabe qué quiere decir con su obra?",
      weight: 0.35,
      levels: {
        insufficient: {
          level: "insufficient",
          description: "No hay intención articulada. El alumno no puede explicar sus decisiones.",
          feedbackHint: "Antes de continuar: ¿qué quieres que sienta quien lo vea?",
        },
        basic: {
          level: "basic",
          description: "Hay una idea pero no está completamente desarrollada.",
          feedbackHint: "Bien, tienes una idea. ¿Qué decisión (color, forma, posición) te acerca más a ella?",
        },
        adequate: {
          level: "adequate",
          description: "La intención es clara y hay decisiones conscientes que la reflejan.",
          feedbackHint: "Se ve la intención. ¿Hay algún elemento que no la esté apoyando?",
        },
        outstanding: {
          level: "outstanding",
          description: "La obra tiene coherencia entre intención, decisiones técnicas y resultado.",
          feedbackHint: "Obra coherente. ¿Qué cambiarías si pudieras volver a empezar?",
        },
      },
    },
    {
      id: "art_knowledge",
      name: "Conocimiento artístico",
      description: "Conocimiento de artistas, movimientos, períodos e historia del arte",
      weight: 0.35,
      levels: {
        insufficient: {
          level: "insufficient",
          description: "No relaciona lo que hace con ningún referente artístico.",
          feedbackHint: "¿Conoces algún artista que pinte algo parecido a lo que tú quieres hacer?",
        },
        basic: {
          level: "basic",
          description: "Conoce algunos artistas pero no establece conexiones profundas.",
          feedbackHint: "Bien. ¿En qué se parece tu trabajo al de ese artista?",
        },
        adequate: {
          level: "adequate",
          description: "Relaciona su trabajo con referentes y conoce las características básicas del movimiento.",
          feedbackHint: "Buena cultura artística. ¿En qué período histórico encajaría tu obra?",
        },
        outstanding: {
          level: "outstanding",
          description: "Contextualiza su trabajo con profundidad. Cita referentes con criterio.",
          feedbackHint: "Excelente conocimiento. Analiza cómo la técnica de ese artista refleja su contexto histórico.",
        },
      },
    },
  ],
};

// ─── Registro de rúbricas ─────────────────────────────────────────────────────

const RUBRIC_REGISTRY: Record<string, SubjectRubric> = {
  lengua: RUBRIC_LENGUA,
  "lengua-castellana": RUBRIC_LENGUA,
  "lengua-y-literatura": RUBRIC_LENGUA,
  ingles: RUBRIC_IDIOMAS,
  frances: RUBRIC_IDIOMAS,
  aleman: RUBRIC_IDIOMAS,
  idiomas: RUBRIC_IDIOMAS,
  musica: RUBRIC_MUSICA,
  arte: RUBRIC_ARTE,
  "educacion-artistica": RUBRIC_ARTE,
  plastica: RUBRIC_ARTE,
};

/**
 * Obtiene la rúbrica para una materia por su slug.
 * Devuelve null si la materia no tiene rúbrica específica (p.ej. Matemáticas — evaluación objetiva).
 */
export function getRubricForSubject(subjectSlug: string): SubjectRubric | null {
  const normalized = subjectSlug.toLowerCase().replace(/\s+/g, "-");
  return RUBRIC_REGISTRY[normalized] ?? null;
}

/**
 * Genera la instrucción de rúbrica para el prompt del agente.
 * Si la materia no tiene rúbrica específica, devuelve string vacío.
 */
export function buildRubricInstruction(subjectSlug: string): string {
  const rubric = getRubricForSubject(subjectSlug);
  if (!rubric) return "";

  const dimensionNames = rubric.dimensions.map((d) => d.name).join(", ");
  return [
    rubric.agentInstruction,
    `Al evaluar, considera estas dimensiones: ${dimensionNames}.`,
    `Antes de dar feedback, identifica internamente en qué nivel está el alumno en cada dimensión.`,
    `El feedback debe mencionar 1 fortaleza y 1 sola área de mejora.`,
  ].join(" ");
}

/**
 * Obtiene las materias que tienen rúbricas subjetivas registradas.
 */
export function getSubjectiveSubjectSlugs(): string[] {
  return [...new Set(Object.keys(RUBRIC_REGISTRY))];
}
