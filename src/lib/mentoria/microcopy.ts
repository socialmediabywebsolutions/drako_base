import type { LearningProfile } from "@/lib/mentoria/learning-profile";

export type MicrocopyStage = "primary" | "eso" | "bachillerato";

export type MicrocopyContext =
  | "encouragement"
  | "explanation_intro"
  | "error_feedback"
  | "success_feedback"
  | "planner_message"
  | "onboarding_message"
  | "dashboard_message"
  | "focus_message"
  | "parent_message";

export const MENTORIA_PARENT_SLOT_A = "Parent A" as const;
export const MENTORIA_PARENT_SLOT_B = "Parent B" as const;
export const MENTORIA_SCHOOL_YEAR_OPTIONS = [
  "1 primaria",
  "2 primaria",
  "3 primaria",
  "4 primaria",
  "5 primaria",
  "6 primaria",
  "1 ESO",
  "2 ESO",
  "3 ESO",
  "4 ESO",
  "1 bachillerato",
  "2 bachillerato",
] as const;

const microcopy: Record<MicrocopyStage, Record<MicrocopyContext, string>> = {
  primary: {
    encouragement: "Vamos paso a paso, que esto lo puedes sacar.",
    explanation_intro: "Te lo cuento de forma clara y sencilla.",
    error_feedback: "No pasa nada, vamos a probarlo otra vez con una pista mejor.",
    success_feedback: "Muy bien, se nota que la idea ya va encajando.",
    planner_message: "Tu semana va a tener pasos cortitos para avanzar con buena base.",
    onboarding_message: "Vamos a conocerte para preparar una ayuda que encaje contigo.",
    dashboard_message: "Aqui tienes tu espacio para avanzar con calma y ver como vas creciendo.",
    focus_message: "Vamos a concentrarnos un ratito y luego miramos lo que has conseguido.",
    parent_message: "La familia puede seguir el progreso de forma clara y sin agobiar.",
  },
  eso: {
    encouragement: "Vamos a ordenarlo bien y veras que sale mejor.",
    explanation_intro: "Te lo organizo con una estructura clara para que lo sigas facil.",
    error_feedback: "Hay una parte que conviene revisar; vamos a reconstruir el razonamiento.",
    success_feedback: "Buen trabajo, vas consolidando la idea con bastante criterio.",
    planner_message: "Tu plan semanal busca equilibrio entre refuerzo, practica y autonomia.",
    onboarding_message: "Vamos a ajustar Mentoria a tu ritmo, tus materias y tu forma de aprender.",
    dashboard_message: "Este es tu espacio para estudiar con guia clara y ver tu progreso de forma ordenada.",
    focus_message: "Vamos a entrar en modo foco para avanzar sin distraernos y mantener el ritmo.",
    parent_message: "La familia puede ver avance, ritmo y acompanamiento sin invadir el proceso.",
  },
  bachillerato: {
    encouragement: "Vamos al nucleo del problema y lo resolvemos con criterio.",
    explanation_intro: "Voy directo a la idea clave y al razonamiento que la sostiene.",
    error_feedback: "La respuesta necesita afinar el razonamiento; revisemos la justificacion.",
    success_feedback: "Buen avance, la base conceptual esta bien encaminada.",
    planner_message: "Tu plan prioriza analisis, autonomia y transferencia de aprendizaje.",
    onboarding_message: "Vamos a configurar una experiencia precisa y adaptada a tu nivel academico.",
    dashboard_message: "Este espacio centraliza tu progreso, tu plan y tus decisiones de estudio con criterio.",
    focus_message: "Entramos en una sesion de trabajo concentrado para sostener analisis y continuidad.",
    parent_message: "La familia dispone de una vista sintetica del avance, el plan y las necesidades de acompanamiento.",
  },
};

const fallbackStage: MicrocopyStage = "eso";

export function getMicrocopy(stage: MicrocopyStage, context: MicrocopyContext): string {
  return microcopy[stage]?.[context] ?? microcopy[fallbackStage]?.[context] ?? "";
}

type OnboardingStepCopy = {
  title: string;
  description: string;
};

type OnboardingUiCopy = {
  badge: string;
  title: string;
  description: string;
  loading: string;
  validationError: string;
  submitError: string;
  back: string;
  next: string;
  finish: string;
  saving: string;
  step1: OnboardingStepCopy & {
    fullNamePlaceholder: string;
    agePlaceholder: string;
    schoolYearPlaceholder: string;
  };
  step2: OnboardingStepCopy & {
    levels: Record<"me_cuesta_mucho" | "voy_normal" | "se_me_da_bien", string>;
    objectives: Record<
      "improve_understanding" | "pass_subject" | "build_habit" | "gain_confidence",
      { title: string; text: string }
    >;
  };
  step3: OnboardingStepCopy & {
    prompts: Record<"frustration" | "concentration" | "motivation", string>;
    options: Record<"low" | "medium" | "high", string>;
    confidenceTitle: string;
    confidenceOptions: Record<"low" | "medium" | "high", string>;
  };
  step4: OnboardingStepCopy & {
    options: Record<"practical_examples" | "step_by_step" | "quick_summaries", { title: string; text: string }>;
    launchAction: string;
    enterAction: string;
    wowMessage: string;
    summaryObjective: string;
    summaryConfidence: string;
    firstSessionLabel: string;
    dailyPlanLabel: string;
    nextActionsLabel: string;
  };
  step5: OnboardingStepCopy & {
    fullNamePlaceholder: string;
    emailPlaceholder: string;
    dailyMinutesPlaceholder: string;
    supervisionOptions: Record<"light" | "balanced" | "close", string>;
  };
  step6: OnboardingStepCopy & {
    summaryStudent: string;
    summarySubjects: string;
    summaryStyle: string;
  };
};

const onboardingUiCopy: Record<MicrocopyStage, OnboardingUiCopy> = {
  primary: {
    badge: "Bienvenida a Mentoria",
    title: "Vamos a preparar una ayuda hecha para ti",
    description: "Seran unos pasos cortitos para que el tutor y tu plan empiecen contigo desde el primer dia.",
    loading: "Preparando tu bienvenida...",
    validationError: "Completa este paso para seguir avanzando.",
    submitError: "No hemos podido terminar tu configuracion. Vamos a intentarlo otra vez.",
    back: "Volver",
    next: "Continuar",
    finish: "Entrar en mi espacio",
    saving: "Preparando tu plan...",
    step1: {
      title: "1. Vamos a empezar por ti",
      description: "Con esto sabremos como hablarte y que nivel preparar desde el principio.",
      fullNamePlaceholder: "Tu nombre",
      agePlaceholder: "Edad",
      schoolYearPlaceholder: "Selecciona tu curso",
    },
    step2: {
      title: "2. Dinos en que materias quieres ayuda",
      description: "Marca tus materias y cuentanos como te sientes en cada una.",
      levels: {
        me_cuesta_mucho: "Me cuesta mucho",
        voy_normal: "Voy normal",
        se_me_da_bien: "Se me da bien",
      },
      objectives: {
        improve_understanding: { title: "Entender mejor", text: "Quiero comprenderlo sin perderme." },
        pass_subject: { title: "Aprobar", text: "Quiero sacar adelante esta materia." },
        build_habit: { title: "Coger habito", text: "Quiero estudiar con mas ritmo." },
        gain_confidence: { title: "Sentirme seguro", text: "Quiero dejar de bloquearme tan rapido." },
      },
    },
    step3: {
      title: "3. Vamos a ajustar tu punto de arranque",
      description: "Solo necesitamos saber con cuanta confianza llegas para regular bien la primera ayuda.",
      prompts: {
        frustration: "Cuando no entiendes algo, te frustras...",
        concentration: "Mantener la concentracion te resulta...",
        motivation: "Empezar a estudiar se te hace...",
      },
      options: {
        low: "Facil",
        medium: "A veces",
        high: "Bastante",
      },
      confidenceTitle: "Ahora mismo, cuando piensas en estas materias, te sientes...",
      confidenceOptions: {
        low: "Inseguro",
        medium: "Mas o menos",
        high: "Con confianza",
      },
    },
    step4: {
      title: "4. Activamos tu primer avance",
      description: "Revisamos lo minimo y te devolvemos valor real al instante.",
      options: {
        practical_examples: { title: "Ejemplos practicos", text: "Entenderlo con cosas del dia a dia." },
        step_by_step: { title: "Paso a paso", text: "Ir poquito a poco y sin saltos." },
        quick_summaries: { title: "Resumenes rapidos", text: "Ver primero la idea principal." },
      },
      launchAction: "Activar mi ayuda ahora",
      enterAction: "Entrar en mi espacio",
      wowMessage: "En cuanto termines, te preparo un primer plan y una ayuda real para empezar hoy mismo.",
      summaryObjective: "Objetivo",
      summaryConfidence: "Confianza",
      firstSessionLabel: "Primera ayuda",
      dailyPlanLabel: "Plan de hoy",
      nextActionsLabel: "Siguientes pasos",
    },
    step5: {
      title: "5. Vamos a organizar quien te acompana",
      description: "Aqui dejamos claro quien estara pendiente y cuanto tiempo de estudio se espera cada dia.",
      fullNamePlaceholder: "Nombre completo",
      emailPlaceholder: "Email",
      dailyMinutesPlaceholder: "Minutos diarios",
      supervisionOptions: {
        light: "Supervision ligera",
        balanced: "Supervision equilibrada",
        close: "Supervision cercana",
      },
    },
    step6: {
      title: "6. Ya casi esta listo",
      description: "Vamos a guardar tu perfil y preparar tu primer plan semanal.",
      summaryStudent: "Alumno",
      summarySubjects: "Materias",
      summaryStyle: "Estilo",
    },
  },
  eso: {
    badge: "Bienvenida a Mentoria",
    title: "Vamos a preparar una ayuda que encaje contigo",
    description: "Son unos pasos cortos. Cuanto mejor te conozcamos, mejor te acompanan el tutor, el planner y el progreso.",
    loading: "Preparando tu bienvenida...",
    validationError: "Completa este paso para continuar.",
    submitError: "No pudimos completar tu configuracion.",
    back: "Volver",
    next: "Continuar",
    finish: "Entrar en mi espacio",
    saving: "Preparando tu plan...",
    step1: {
      title: "1. Cuentanos quien eres",
      description: "Empezamos por lo basico para adaptar el tono y el nivel desde el primer dia.",
      fullNamePlaceholder: "Tu nombre",
      agePlaceholder: "Edad",
      schoolYearPlaceholder: "Selecciona tu curso",
    },
    step2: {
      title: "2. En que materias quieres que te acompanemos",
      description: "Marca tus materias principales y dinos como te sientes en cada una.",
      levels: {
        me_cuesta_mucho: "Me cuesta mucho",
        voy_normal: "Voy normal",
        se_me_da_bien: "Se me da bien",
      },
      objectives: {
        improve_understanding: { title: "Entender mejor", text: "Quiero que por fin tenga sentido." },
        pass_subject: { title: "Aprobar", text: "Quiero remontar y llegar con seguridad." },
        build_habit: { title: "Coger habito", text: "Quiero estudiar sin depender del ultimo momento." },
        gain_confidence: { title: "Ganar confianza", text: "Quiero dejar de bloquearme cuando me atasco." },
      },
    },
    step3: {
      title: "3. Ajustamos el punto de salida",
      description: "Solo dinos con cuanta confianza llegas y afinamos la primera ayuda.",
      prompts: {
        frustration: "Cuando no entiendes algo, te frustras...",
        concentration: "Mantener la concentracion te resulta...",
        motivation: "Empezar a estudiar se te hace...",
      },
      options: {
        low: "Facil",
        medium: "A veces",
        high: "Bastante",
      },
      confidenceTitle: "Si tuvieras que empezar hoy, te sentirias...",
      confidenceOptions: {
        low: "Poco seguro",
        medium: "Con dudas normales",
        high: "Bastante seguro",
      },
    },
    step4: {
      title: "4. Activamos tu primer momento de valor",
      description: "Con esto cerramos el setup y arrancamos tu experiencia real.",
      options: {
        practical_examples: { title: "Ejemplos practicos", text: "Verlo con casos del dia a dia." },
        step_by_step: { title: "Paso a paso", text: "Ir poco a poco sin saltos." },
        quick_summaries: { title: "Resumenes rapidos", text: "Entender primero la idea general." },
      },
      launchAction: "Activar Mentoria ahora",
      enterAction: "Entrar al workspace",
      wowMessage: "En menos de dos minutos vas a tener tu primer plan del dia y una ayuda guiada lista para usar.",
      summaryObjective: "Objetivo",
      summaryConfidence: "Confianza",
      firstSessionLabel: "Primera ayuda guiada",
      dailyPlanLabel: "Plan del dia",
      nextActionsLabel: "Siguientes pasos",
    },
    step5: {
      title: "5. Configuracion familiar",
      description: "Aqui dejamos claro quien acompana el proceso y cuanto tiempo de estudio se espera cada dia.",
      fullNamePlaceholder: "Nombre completo",
      emailPlaceholder: "Email",
      dailyMinutesPlaceholder: "Minutos diarios",
      supervisionOptions: {
        light: "Supervision ligera",
        balanced: "Supervision equilibrada",
        close: "Supervision cercana",
      },
    },
    step6: {
      title: "6. Todo listo para empezar",
      description: "Vamos a guardar tu perfil, preparar tu punto de partida y crear tu primer plan semanal.",
      summaryStudent: "Alumno",
      summarySubjects: "Materias",
      summaryStyle: "Estilo",
    },
  },
  bachillerato: {
    badge: "Bienvenida a Mentoria",
    title: "Vamos a configurar una ayuda precisa para tu nivel",
    description: "Seran unos pasos breves para ajustar tono, exigencia y plan de estudio desde el inicio.",
    loading: "Preparando tu configuracion inicial...",
    validationError: "Completa este paso antes de continuar.",
    submitError: "No hemos podido cerrar la configuracion inicial.",
    back: "Volver",
    next: "Continuar",
    finish: "Entrar en mi espacio",
    saving: "Generando tu plan inicial...",
    step1: {
      title: "1. Identificamos tu punto de partida",
      description: "Necesitamos estos datos para ajustar el nivel academico y la forma de acompanarte.",
      fullNamePlaceholder: "Nombre completo",
      agePlaceholder: "Edad",
      schoolYearPlaceholder: "Selecciona tu curso",
    },
    step2: {
      title: "2. Selecciona tus materias clave",
      description: "Indica en que materias quieres apoyo y tu sensacion actual en cada una.",
      levels: {
        me_cuesta_mucho: "Me cuesta mucho",
        voy_normal: "Voy normal",
        se_me_da_bien: "Se me da bien",
      },
      objectives: {
        improve_understanding: { title: "Entender mejor", text: "Quiero afianzar la base conceptual." },
        pass_subject: { title: "Aprobar", text: "Quiero asegurar rendimiento en esta materia." },
        build_habit: { title: "Coger habito", text: "Quiero estudiar con continuidad real." },
        gain_confidence: { title: "Ganar confianza", text: "Quiero dejar de dudar en cada bloque." },
      },
    },
    step3: {
      title: "3. Ajustamos la confianza de salida",
      description: "Nos basta con esto para calibrar la primera ayuda y el ritmo inicial.",
      prompts: {
        frustration: "Cuando un contenido no sale, tu frustracion suele ser...",
        concentration: "Tu capacidad para mantener la concentracion suele ser...",
        motivation: "Tu facilidad para arrancar una sesion de estudio suele ser...",
      },
      options: {
        low: "Baja",
        medium: "Media",
        high: "Alta",
      },
      confidenceTitle: "Si empezaras ahora mismo, tu nivel de confianza seria...",
      confidenceOptions: {
        low: "Bajo",
        medium: "Medio",
        high: "Alto",
      },
    },
    step4: {
      title: "4. Activamos tu itinerario inicial",
      description: "Cerramos el setup y lanzamos tu primera ayuda con criterio desde el minuto uno.",
      options: {
        practical_examples: { title: "Ejemplos practicos", text: "Relacionar teoria con situaciones concretas." },
        step_by_step: { title: "Paso a paso", text: "Desarrollar el razonamiento de forma secuencial." },
        quick_summaries: { title: "Resumenes rapidos", text: "Ubicar primero la idea global y luego profundizar." },
      },
      launchAction: "Activar mi plan y empezar",
      enterAction: "Entrar al espacio academico",
      wowMessage: "Cerramos esto y te devolvemos un primer itinerario real con ayuda guiada desde el primer minuto.",
      summaryObjective: "Objetivo",
      summaryConfidence: "Confianza",
      firstSessionLabel: "Primera orientacion",
      dailyPlanLabel: "Ritmo del dia",
      nextActionsLabel: "Acciones inmediatas",
    },
    step5: {
      title: "5. Configuracion familiar",
      description: "Definimos acompanamiento, tiempo diario esperado y nivel de supervision.",
      fullNamePlaceholder: "Nombre completo",
      emailPlaceholder: "Email",
      dailyMinutesPlaceholder: "Minutos diarios",
      supervisionOptions: {
        light: "Supervision ligera",
        balanced: "Supervision equilibrada",
        close: "Supervision cercana",
      },
    },
    step6: {
      title: "6. Confirmacion inicial",
      description: "Guardaremos tu perfil, generaremos tu plan base y dejaremos listo tu punto de partida.",
      summaryStudent: "Alumno",
      summarySubjects: "Materias",
      summaryStyle: "Estilo",
    },
  },
};

type WorkspaceUiCopy = {
  productBadge: string;
  emptyWorkspaceTitle: string;
  greetingPrefix: string;
  defaultTopic: string;
  defaultMessage: string;
  genericSubjectLabel: string;
  fallbackSubjects: Array<{ slug: string; label: string }>;
  courseLabel: string;
  loading: string;
  tutorTitle: string;
  tutorAction: string;
  topicPlaceholder: string;
  tutorButton: string;
  plannerTitle: string;
  plannerAction: string;
  plannerEmpty: string;
  focusMinutesSuffix: string;
  exercisesTitle: string;
  exercisePlaceholder: string;
  exerciseAction: string;
  exerciseEmpty: string;
  hintPrefix: string;
  progressTitle: string;
  progressReinforcement: string;
  progressNextStep: string;
  progressNoAlerts: string;
  motivationTitle: string;
  streakLabel: string;
  effortLabel: string;
  levelLabel: string;
  pointsLabel: string;
  achievementsTitle: string;
  noAchievements: string;
  motivationFragileMessage: string;
  motivationStableMessage: string;
  motivationHighPerformerMessage: string;
  dailyPlanTitle: string;
  dailyPlanEmpty: string;
  dailyPlanDurationLabel: string;
  dailyPlanPriorityLabel: string;
  dailyPlanReasonLabel: string;
  dailyPlanProgressLabel: string;
  dailyPlanCompletedLabel: string;
  dailyPlanCompletedEmpty: string;
  dailyPlanDifficultyPrefix: string;
  dailyPlanTaskTypes: Record<"practice" | "review" | "challenge", string>;
  dailyPlanPriorityValues: Record<"low" | "medium" | "high", string>;
  billingTitle: string;
  billingPlanLabel: string;
  billingUsageLabel: string;
  billingUpgradeAction: string;
  billingManageAction: string;
  parentsTitle: string;
  parentsAction: string;
  focusStartNotesPrefix: string;
  focusCompleteNotes: string;
};

const workspaceUiCopy: Record<MicrocopyStage, WorkspaceUiCopy> = {
  primary: {
    productBadge: "Mentoria IA",
    emptyWorkspaceTitle: "Tu espacio de aprendizaje",
    greetingPrefix: "Hola",
    defaultTopic: "fracciones",
    defaultMessage: "No entiendo por que tengo que sacar comun denominador.",
    genericSubjectLabel: "Materia",
    fallbackSubjects: [
      { slug: "matematicas", label: "Matematicas" },
      { slug: "lengua", label: "Lengua" },
      { slug: "ciencias", label: "Ciencias" },
      { slug: "historia", label: "Historia" },
      { slug: "ingles", label: "Ingles" },
    ],
    courseLabel: "Curso",
    loading: "Cargando tu espacio...",
    tutorTitle: "Tutor IA",
    tutorAction: "Generar ejercicio",
    topicPlaceholder: "Tema que quieres trabajar",
    tutorButton: "Hablar con el tutor",
    plannerTitle: "Plan de la semana",
    plannerAction: "Actualizar plan",
    plannerEmpty: "Todavia no hay plan semanal.",
    focusMinutesSuffix: "min de foco",
    exercisesTitle: "Ejercicios y pistas",
    exercisePlaceholder: "Escribe tu respuesta",
    exerciseAction: "Corregir respuesta",
    exerciseEmpty: "Genera un ejercicio desde el tutor para practicar ahora.",
    hintPrefix: "Pista",
    progressTitle: "Como vas",
    progressReinforcement: "Refuerzo",
    progressNextStep: "Siguiente paso",
    progressNoAlerts: "Sin alertas fuertes",
    motivationTitle: "Tu impulso",
    streakLabel: "Racha",
    effortLabel: "Esfuerzo",
    levelLabel: "Nivel",
    pointsLabel: "Puntos",
    achievementsTitle: "Logros reales",
    noAchievements: "Todavia no hay logros guardados.",
    motivationFragileMessage: "Hoy vamos a celebrar cada paso pequeno que completes.",
    motivationStableMessage: "Llevas un ritmo solido; sigue sumando avances claros.",
    motivationHighPerformerMessage: "Tu ritmo esta creciendo; toca convertirlo en un reto nuevo.",
    dailyPlanTitle: "Plan del dia",
    dailyPlanEmpty: "Todavia no hay plan diario generado.",
    dailyPlanDurationLabel: "Tiempo recomendado",
    dailyPlanPriorityLabel: "Prioridad",
    dailyPlanReasonLabel: "Por que hoy va asi",
    dailyPlanProgressLabel: "Avance del plan",
    dailyPlanCompletedLabel: "Tareas completadas",
    dailyPlanCompletedEmpty: "Cuando cierres un bloque, aparecera aqui.",
    dailyPlanDifficultyPrefix: "D",
    dailyPlanTaskTypes: {
      practice: "Practica",
      review: "Repaso",
      challenge: "Reto",
    },
    dailyPlanPriorityValues: {
      low: "Suave",
      medium: "Normal",
      high: "Cuidada",
    },
    billingTitle: "Tu plan",
    billingPlanLabel: "Plan actual",
    billingUsageLabel: "Uso de hoy",
    billingUpgradeAction: "Mejorar plan",
    billingManageAction: "Gestionar suscripcion",
    parentsTitle: "Familia vinculada",
    parentsAction: "Abrir panel de familia",
    focusStartNotesPrefix: "Sesion de",
    focusCompleteNotes: "Sesion completada",
  },
  eso: {
    productBadge: "Mentoria IA",
    emptyWorkspaceTitle: "Workspace del alumno",
    greetingPrefix: "Hola",
    defaultTopic: "fracciones",
    defaultMessage: "No entiendo por que tengo que sacar comun denominador.",
    genericSubjectLabel: "Materia",
    fallbackSubjects: [
      { slug: "matematicas", label: "Matematicas" },
      { slug: "lengua", label: "Lengua" },
      { slug: "ciencias", label: "Ciencias" },
      { slug: "historia", label: "Historia" },
      { slug: "ingles", label: "Ingles" },
    ],
    courseLabel: "Curso",
    loading: "Cargando Mentoria...",
    tutorTitle: "Tutor IA",
    tutorAction: "Generar ejercicio",
    topicPlaceholder: "Tema actual",
    tutorButton: "Hablar con el tutor",
    plannerTitle: "Planner semanal",
    plannerAction: "Regenerar",
    plannerEmpty: "Aun no hay plan semanal.",
    focusMinutesSuffix: "min focus",
    exercisesTitle: "Ejercicios y correcciones",
    exercisePlaceholder: "Escribe tu respuesta",
    exerciseAction: "Corregir respuesta",
    exerciseEmpty: "Genera un ejercicio desde el tutor para practicar de inmediato.",
    hintPrefix: "Pista",
    progressTitle: "Progreso",
    progressReinforcement: "Refuerzo",
    progressNextStep: "Siguiente paso",
    progressNoAlerts: "Sin alertas fuertes",
    motivationTitle: "Engagement",
    streakLabel: "Racha",
    effortLabel: "Esfuerzo",
    levelLabel: "Nivel",
    pointsLabel: "Puntos",
    achievementsTitle: "Logros",
    noAchievements: "Aun no hay logros registrados.",
    motivationFragileMessage: "Vamos a sostener el ritmo con metas pequenas y visibles.",
    motivationStableMessage: "Vas construyendo un buen ritmo; mantenlo con constancia.",
    motivationHighPerformerMessage: "Tu engagement es alto; es buen momento para subir un poco el reto.",
    dailyPlanTitle: "Plan del dia",
    dailyPlanEmpty: "Aun no hay plan diario generado.",
    dailyPlanDurationLabel: "Duracion recomendada",
    dailyPlanPriorityLabel: "Prioridad",
    dailyPlanReasonLabel: "Criterio adaptativo",
    dailyPlanProgressLabel: "Cumplimiento del plan",
    dailyPlanCompletedLabel: "Tareas cerradas",
    dailyPlanCompletedEmpty: "Las tareas completadas iran apareciendo aqui.",
    dailyPlanDifficultyPrefix: "D",
    dailyPlanTaskTypes: {
      practice: "Practica",
      review: "Repaso",
      challenge: "Reto",
    },
    dailyPlanPriorityValues: {
      low: "Ligera",
      medium: "Media",
      high: "Alta",
    },
    billingTitle: "Suscripcion",
    billingPlanLabel: "Plan actual",
    billingUsageLabel: "Uso de hoy",
    billingUpgradeAction: "Subir a premium",
    billingManageAction: "Gestionar plan",
    parentsTitle: "Padres vinculados",
    parentsAction: "Abrir panel de padres",
    focusStartNotesPrefix: "Sesion de",
    focusCompleteNotes: "Sesion completada",
  },
  bachillerato: {
    productBadge: "Mentoria IA",
    emptyWorkspaceTitle: "Espacio academico",
    greetingPrefix: "Bienvenido",
    defaultTopic: "limites",
    defaultMessage: "Entiendo la formula, pero no veo por que el razonamiento funciona.",
    genericSubjectLabel: "Materia",
    fallbackSubjects: [
      { slug: "matematicas", label: "Matematicas" },
      { slug: "lengua", label: "Lengua" },
      { slug: "ciencias", label: "Ciencias" },
      { slug: "historia", label: "Historia" },
      { slug: "ingles", label: "Ingles" },
    ],
    courseLabel: "Curso",
    loading: "Cargando tu entorno academico...",
    tutorTitle: "Tutor IA",
    tutorAction: "Generar ejercicio",
    topicPlaceholder: "Bloque o tema",
    tutorButton: "Trabajar con el tutor",
    plannerTitle: "Plan de estudio",
    plannerAction: "Recalcular plan",
    plannerEmpty: "Aun no hay plan de estudio generado.",
    focusMinutesSuffix: "min de trabajo",
    exercisesTitle: "Ejercicios y revision",
    exercisePlaceholder: "Redacta tu respuesta",
    exerciseAction: "Revisar respuesta",
    exerciseEmpty: "Genera un ejercicio desde el tutor para trabajar con aplicacion inmediata.",
    hintPrefix: "Clave",
    progressTitle: "Seguimiento",
    progressReinforcement: "Area a reforzar",
    progressNextStep: "Siguiente accion",
    progressNoAlerts: "Sin alertas prioritarias",
    motivationTitle: "Traccion",
    streakLabel: "Racha",
    effortLabel: "Esfuerzo",
    levelLabel: "Nivel",
    pointsLabel: "Puntos",
    achievementsTitle: "Logros acumulados",
    noAchievements: "Aun no hay logros acumulados.",
    motivationFragileMessage: "Conviene bajar friccion y volver a una secuencia de exito controlado.",
    motivationStableMessage: "La implicacion es estable; toca sostener regularidad y precision.",
    motivationHighPerformerMessage: "La traccion es alta; se puede abrir un reto con mas autonomia.",
    dailyPlanTitle: "Ritmo del dia",
    dailyPlanEmpty: "Aun no hay ritmo diario calculado.",
    dailyPlanDurationLabel: "Carga recomendada",
    dailyPlanPriorityLabel: "Prioridad",
    dailyPlanReasonLabel: "Razon adaptativa",
    dailyPlanProgressLabel: "Ejecucion diaria",
    dailyPlanCompletedLabel: "Bloques completados",
    dailyPlanCompletedEmpty: "Los bloques cerrados apareceran aqui.",
    dailyPlanDifficultyPrefix: "D",
    dailyPlanTaskTypes: {
      practice: "Practica",
      review: "Revision",
      challenge: "Desafio",
    },
    dailyPlanPriorityValues: {
      low: "Baja",
      medium: "Media",
      high: "Alta",
    },
    billingTitle: "Suscripcion",
    billingPlanLabel: "Plan activo",
    billingUsageLabel: "Uso diario",
    billingUpgradeAction: "Actualizar plan",
    billingManageAction: "Abrir portal de billing",
    parentsTitle: "Familia vinculada",
    parentsAction: "Abrir panel familiar",
    focusStartNotesPrefix: "Sesion de",
    focusCompleteNotes: "Sesion completada",
  },
};

type FocusUiCopy = {
  title: string;
  timerLabel: string;
  minutesSuffix: string;
  statusLabels: Record<"active" | "completed" | "cancelled", string>;
  streakLabel: string;
  effortLabel: string;
  levelLabel: string;
  encouragementFragile: string;
  encouragementStable: string;
  encouragementHighPerformer: string;
  startAction: string;
  completeAction: string;
};

const focusUiCopy: Record<MicrocopyStage, FocusUiCopy> = {
  primary: {
    title: "Momento de foco",
    timerLabel: "Temporizador",
    minutesSuffix: "min",
    statusLabels: {
      active: "Foco en marcha",
      completed: "Foco completado",
      cancelled: "Foco pausado",
    },
    streakLabel: "Racha",
    effortLabel: "Esfuerzo",
    levelLabel: "Nivel",
    encouragementFragile: "Haz solo este bloque y luego celebramos que lo has sacado.",
    encouragementStable: "Un bloque bien hecho hoy ayuda mucho a tu ritmo.",
    encouragementHighPerformer: "Buen momento para cerrar este bloque con calidad y abrir el siguiente.",
    startAction: "Empezar",
    completeAction: "Terminar",
  },
  eso: {
    title: "Focus mode",
    timerLabel: "Temporizador",
    minutesSuffix: "min",
    statusLabels: {
      active: "Focus activo",
      completed: "Focus completado",
      cancelled: "Focus pausado",
    },
    streakLabel: "Racha",
    effortLabel: "Esfuerzo",
    levelLabel: "Nivel",
    encouragementFragile: "Entramos en un bloque corto para recuperar ritmo sin agobio.",
    encouragementStable: "Mantener este bloque te ayuda a consolidar el habito.",
    encouragementHighPerformer: "Si sostienes este bloque, estas listo para un reto mayor despues.",
    startAction: "Iniciar",
    completeAction: "Completar",
  },
  bachillerato: {
    title: "Sesion de foco",
    timerLabel: "Temporizador",
    minutesSuffix: "min",
    statusLabels: {
      active: "Sesion activa",
      completed: "Sesion completada",
      cancelled: "Sesion cancelada",
    },
    streakLabel: "Racha",
    effortLabel: "Esfuerzo",
    levelLabel: "Nivel",
    encouragementFragile: "Conviene cerrar este bloque con una meta concreta y asumible.",
    encouragementStable: "Esta sesion sostiene una traccion academica saludable.",
    encouragementHighPerformer: "Este bloque puede convertirse en una sesion de alto rendimiento si mantienes precision.",
    startAction: "Iniciar sesion",
    completeAction: "Cerrar sesion",
  },
};

type ParentHubUiCopy = {
  badge: string;
  emptyTitle: string;
  headingPrefix: string;
  metricsTitle: string;
  alertsTitle: string;
  recommendationsTitle: string;
  noAlerts: string;
  noRecommendations: string;
  severityLabel: string;
  evolutionSummaryTitle: string;
  frustrationLabel: string;
  consistencyStateLabel: string;
  progressionLabel: string;
  motivationTitle: string;
  motivationProfileLabel: string;
  motivationProfileValues: Record<"fragile" | "stable" | "high_performer", string>;
  streakLabel: string;
  effortLabel: string;
  levelLabel: string;
  rewardPointsLabel: string;
  achievementsTitle: string;
  noAchievements: string;
  dailyPlanTitle: string;
  dailyPlanComplianceLabel: string;
  dailyPlanDurationLabel: string;
  dailyPlanPriorityLabel: string;
  dailyPlanReasonLabel: string;
  dailyPlanConsistencyLabel: string;
  dailyPlanCompletedLabel: string;
  dailyPlanEmpty: string;
  dailyPlanCompletedEmpty: string;
  dailyPlanDifficultyPrefix: string;
  dailyPlanTaskTypes: Record<"practice" | "review" | "challenge", string>;
  dailyPlanPriorityValues: Record<"low" | "medium" | "high", string>;
  billingTitle: string;
  billingUpgradeAction: string;
  billingManageAction: string;
  subjectFallbackLabel: string;
  configuredUseTitle: string;
  weeklyPlanLabel: string;
  noPlan: string;
  blockDurationSuffix: string;
  backAction: string;
  configureTitle: string;
  saveAction: string;
  parentViewManage: string;
  parentViewReadOnly: string;
  confidenceLabel: string;
  sessionsLabel: string;
  exercisesLabel: string;
  parentSlotA: string;
  parentSlotB: string;
  fullNamePlaceholder: string;
  emailPlaceholder: string;
  growthTitle: string;
  referralCodeLabel: string;
  invitePlaceholder: string;
  inviteAction: string;
  inviteReadyLabel: string;
  shareProgressTitle: string;
  shareProgressAction: string;
  shareLinkLabel: string;
  copyAction: string;
  rewardDaysLabel: string;
  convertedReferralsLabel: string;
  recommendedInviteLabel: string;
  recommendedShareLabel: string;
};

const parentHubUiCopy: Record<MicrocopyStage, ParentHubUiCopy> = {
  primary: {
    badge: "Panel de familia",
    emptyTitle: "Panel de familia",
    headingPrefix: "Seguimiento de",
    metricsTitle: "Resumen sencillo",
    alertsTitle: "Alertas activas",
    recommendationsTitle: "Que conviene hacer ahora",
    noAlerts: "No hay alertas activas ahora mismo.",
    noRecommendations: "No hay recomendaciones urgentes por ahora.",
    severityLabel: "Nivel",
    evolutionSummaryTitle: "Estado adaptativo",
    frustrationLabel: "Frustracion",
    consistencyStateLabel: "Constancia",
    progressionLabel: "Progresion",
    motivationTitle: "Motivacion",
    motivationProfileLabel: "Perfil",
    motivationProfileValues: {
      fragile: "Necesita refuerzo",
      stable: "Ritmo estable",
      high_performer: "Alto rendimiento",
    },
    streakLabel: "Racha",
    effortLabel: "Esfuerzo",
    levelLabel: "Nivel",
    rewardPointsLabel: "Puntos",
    achievementsTitle: "Logros",
    noAchievements: "Sin logros nuevos todavia.",
    dailyPlanTitle: "Ritmo diario",
    dailyPlanComplianceLabel: "Cumplimiento",
    dailyPlanDurationLabel: "Duracion",
    dailyPlanPriorityLabel: "Prioridad",
    dailyPlanReasonLabel: "Motivo de adaptacion",
    dailyPlanConsistencyLabel: "Constancia diaria",
    dailyPlanCompletedLabel: "Tareas completadas",
    dailyPlanEmpty: "Sin plan diario activo por ahora.",
    dailyPlanCompletedEmpty: "Las tareas cerradas apareceran aqui cuando se completen.",
    dailyPlanDifficultyPrefix: "D",
    dailyPlanTaskTypes: {
      practice: "Practica",
      review: "Repaso",
      challenge: "Reto",
    },
    dailyPlanPriorityValues: {
      low: "Suave",
      medium: "Normal",
      high: "Cuidada",
    },
    billingTitle: "Plan familiar",
    billingUpgradeAction: "Mejorar plan",
    billingManageAction: "Gestionar suscripcion",
    subjectFallbackLabel: "Materia",
    configuredUseTitle: "Uso configurado",
    weeklyPlanLabel: "Plan semanal",
    noPlan: "Sin plan generado",
    blockDurationSuffix: "min",
    backAction: "Volver al espacio del alumno",
    configureTitle: "Configurar Parent A / Parent B",
    saveAction: "Guardar accesos parentales",
    parentViewManage: "Puede ajustar el plan",
    parentViewReadOnly: "Vista de seguimiento",
    confidenceLabel: "Confianza",
    sessionsLabel: "Sesiones",
    exercisesLabel: "Ejercicios",
    parentSlotA: "Parent A",
    parentSlotB: "Parent B",
    fullNamePlaceholder: "Nombre completo",
    emailPlaceholder: "email@familia.com",
    growthTitle: "Crecimiento y comparticion",
    referralCodeLabel: "Codigo de invitacion",
    invitePlaceholder: "email@otrafamilia.com",
    inviteAction: "Crear invitacion",
    inviteReadyLabel: "Invitacion lista",
    shareProgressTitle: "Compartir progreso",
    shareProgressAction: "Crear resumen para compartir",
    shareLinkLabel: "Enlace compartible",
    copyAction: "Copiar mensaje",
    rewardDaysLabel: "Dias premium ganados",
    convertedReferralsLabel: "Referidos convertidos",
    recommendedInviteLabel: "Sugerencia para invitar",
    recommendedShareLabel: "Sugerencia para compartir",
  },
  eso: {
    badge: "Parent Hub",
    emptyTitle: "Panel de familia",
    headingPrefix: "Seguimiento de",
    metricsTitle: "Metricas basicas",
    alertsTitle: "Alertas activas",
    recommendationsTitle: "Recomendaciones accionables",
    noAlerts: "No hay alertas activas en este momento.",
    noRecommendations: "No hay recomendaciones prioritarias ahora mismo.",
    severityLabel: "Nivel",
    evolutionSummaryTitle: "Estado adaptativo",
    frustrationLabel: "Frustracion",
    consistencyStateLabel: "Constancia",
    progressionLabel: "Progresion",
    motivationTitle: "Motivacion",
    motivationProfileLabel: "Perfil",
    motivationProfileValues: {
      fragile: "Fragil",
      stable: "Estable",
      high_performer: "Alto rendimiento",
    },
    streakLabel: "Racha",
    effortLabel: "Esfuerzo",
    levelLabel: "Nivel",
    rewardPointsLabel: "Puntos",
    achievementsTitle: "Logros",
    noAchievements: "Todavia no hay logros destacados.",
    dailyPlanTitle: "Ritmo diario",
    dailyPlanComplianceLabel: "Cumplimiento",
    dailyPlanDurationLabel: "Duracion",
    dailyPlanPriorityLabel: "Prioridad",
    dailyPlanReasonLabel: "Motivo de adaptacion",
    dailyPlanConsistencyLabel: "Constancia diaria",
    dailyPlanCompletedLabel: "Tareas completadas",
    dailyPlanEmpty: "No hay plan diario activo en este momento.",
    dailyPlanCompletedEmpty: "Las tareas cerradas apareceran aqui cuando se completen.",
    dailyPlanDifficultyPrefix: "D",
    dailyPlanTaskTypes: {
      practice: "Practica",
      review: "Repaso",
      challenge: "Reto",
    },
    dailyPlanPriorityValues: {
      low: "Ligera",
      medium: "Media",
      high: "Alta",
    },
    billingTitle: "Suscripcion",
    billingUpgradeAction: "Subir plan",
    billingManageAction: "Gestionar suscripcion",
    subjectFallbackLabel: "Materia",
    configuredUseTitle: "Uso configurado",
    weeklyPlanLabel: "Plan semanal",
    noPlan: "Sin planner generado",
    blockDurationSuffix: "min",
    backAction: "Volver al workspace del alumno",
    configureTitle: "Configurar Parent A / Parent B",
    saveAction: "Guardar accesos parentales",
    parentViewManage: "Puede ajustar planner",
    parentViewReadOnly: "Vista de seguimiento",
    confidenceLabel: "Confianza",
    sessionsLabel: "Sesiones",
    exercisesLabel: "Ejercicios",
    parentSlotA: "Parent A",
    parentSlotB: "Parent B",
    fullNamePlaceholder: "Nombre completo",
    emailPlaceholder: "email@familia.com",
    growthTitle: "Crecimiento organico",
    referralCodeLabel: "Codigo de referido",
    invitePlaceholder: "email@otrafamilia.com",
    inviteAction: "Crear invitacion",
    inviteReadyLabel: "Invitacion preparada",
    shareProgressTitle: "Compartir progreso",
    shareProgressAction: "Generar resumen compartible",
    shareLinkLabel: "Enlace listo para enviar",
    copyAction: "Copiar mensaje",
    rewardDaysLabel: "Dias premium ganados",
    convertedReferralsLabel: "Conversiones",
    recommendedInviteLabel: "Recomendacion de invitacion",
    recommendedShareLabel: "Recomendacion de comparticion",
  },
  bachillerato: {
    badge: "Panel familiar",
    emptyTitle: "Panel familiar",
    headingPrefix: "Seguimiento de",
    metricsTitle: "Indicadores clave",
    alertsTitle: "Intervenciones activas",
    recommendationsTitle: "Acciones recomendadas",
    noAlerts: "No hay intervenciones activas en este momento.",
    noRecommendations: "No hay acciones prioritarias pendientes.",
    severityLabel: "Nivel",
    evolutionSummaryTitle: "Estado adaptativo",
    frustrationLabel: "Frustracion",
    consistencyStateLabel: "Constancia",
    progressionLabel: "Progresion",
    motivationTitle: "Motivacion",
    motivationProfileLabel: "Perfil",
    motivationProfileValues: {
      fragile: "Fragil",
      stable: "Estable",
      high_performer: "High performer",
    },
    streakLabel: "Racha",
    effortLabel: "Esfuerzo",
    levelLabel: "Nivel",
    rewardPointsLabel: "Puntos",
    achievementsTitle: "Logros",
    noAchievements: "Sin logros acumulados por ahora.",
    dailyPlanTitle: "Ritmo diario",
    dailyPlanComplianceLabel: "Cumplimiento",
    dailyPlanDurationLabel: "Carga",
    dailyPlanPriorityLabel: "Prioridad",
    dailyPlanReasonLabel: "Motivo de adaptacion",
    dailyPlanConsistencyLabel: "Constancia diaria",
    dailyPlanCompletedLabel: "Bloques completados",
    dailyPlanEmpty: "No hay ritmo diario activo.",
    dailyPlanCompletedEmpty: "Los bloques cerrados apareceran aqui cuando se completen.",
    dailyPlanDifficultyPrefix: "D",
    dailyPlanTaskTypes: {
      practice: "Practica",
      review: "Revision",
      challenge: "Desafio",
    },
    dailyPlanPriorityValues: {
      low: "Baja",
      medium: "Media",
      high: "Alta",
    },
    billingTitle: "Suscripcion",
    billingUpgradeAction: "Actualizar plan",
    billingManageAction: "Abrir portal de billing",
    subjectFallbackLabel: "Materia",
    configuredUseTitle: "Marco de uso",
    weeklyPlanLabel: "Plan de estudio",
    noPlan: "Sin plan activo",
    blockDurationSuffix: "min",
    backAction: "Volver al espacio academico",
    configureTitle: "Configurar Parent A / Parent B",
    saveAction: "Guardar configuracion parental",
    parentViewManage: "Puede ajustar seguimiento",
    parentViewReadOnly: "Vista informativa",
    confidenceLabel: "Confianza",
    sessionsLabel: "Sesiones",
    exercisesLabel: "Ejercicios",
    parentSlotA: "Parent A",
    parentSlotB: "Parent B",
    fullNamePlaceholder: "Nombre completo",
    emailPlaceholder: "email@familia.com",
    growthTitle: "Growth familiar",
    referralCodeLabel: "Codigo de referral",
    invitePlaceholder: "email@otrafamilia.com",
    inviteAction: "Crear invitacion",
    inviteReadyLabel: "Invitacion preparada",
    shareProgressTitle: "Compartir progreso",
    shareProgressAction: "Generar resumen externo",
    shareLinkLabel: "Enlace de progreso",
    copyAction: "Copiar mensaje",
    rewardDaysLabel: "Dias premium obtenidos",
    convertedReferralsLabel: "Conversiones",
    recommendedInviteLabel: "Recomendacion de crecimiento",
    recommendedShareLabel: "Recomendacion de comparticion",
  },
};

export function getStageMicrocopy(profile: Pick<LearningProfile, "stage">, context: MicrocopyContext): string {
  return getMicrocopy(profile.stage, context);
}

export function getOnboardingUiCopy(stage: MicrocopyStage): OnboardingUiCopy {
  return onboardingUiCopy[stage] ?? onboardingUiCopy[fallbackStage];
}

export function getWorkspaceUiCopy(stage: MicrocopyStage): WorkspaceUiCopy {
  return workspaceUiCopy[stage] ?? workspaceUiCopy[fallbackStage];
}

export function getFocusUiCopy(stage: MicrocopyStage): FocusUiCopy {
  return focusUiCopy[stage] ?? focusUiCopy[fallbackStage];
}

export function getParentHubUiCopy(stage: MicrocopyStage): ParentHubUiCopy {
  return parentHubUiCopy[stage] ?? parentHubUiCopy[fallbackStage];
}
