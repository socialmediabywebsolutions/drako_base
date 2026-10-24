import type {
  DailyPlan,
  LearningSession,
  MentoriaSessionContract,
  MentoriaSessionInputKind,
  MentoriaSessionMode,
  MentoriaSessionModeOption,
  MentoriaStudentSubject,
  MentoriaWorkspaceEntry,
  StudentProfile,
} from "@/lib/mentoria/types";

export type ResolveMentoriaSessionModeInput = {
  student?: StudentProfile | null;
  entry?: MentoriaWorkspaceEntry | null;
  dailyPlan?: DailyPlan | null;
  latestSession?: LearningSession | null;
  selectedSubject?: MentoriaStudentSubject | null;
  activeTask?: DailyPlan["tasks"][number] | null;
  currentTopic?: string | null;
  currentMessage?: string | null;
  stateLabel?: string | null;
  suggestedPrompt?: string | null;
  suggestedInputKind?: MentoriaSessionInputKind | null;
  recentActivityLabel?: string | null;
};

const SESSION_MODE_CONTRACTS: Record<MentoriaSessionMode, Omit<MentoriaSessionContract, "entryKind" | "entryLabel">> = {
  task_resolution: {
    mode: "task_resolution",
    label: "resolver tarea",
    headline: "Modo tarea",
    subheadline: "La sesión nace de un deber concreto y lo convierte en trabajo guiado.",
    objective: "Resolver un deber real sin perder comprensión ni autonomía.",
    primaryCta: "Resolver con el tutor",
    chatBehavior: "Aclara el enunciado, decide el primer paso útil y evita resolverlo todo de golpe.",
    boardBehavior: "Carga el deber activo, descompone pasos y deja visible solo el siguiente movimiento.",
    progression: ["entender el encargo", "resolver un primer bloque", "comprobar", "cerrar o practicar"],
    tutorTone: "directo, claro y útil",
    completionRule: "Termina cuando el deber queda encaminado o resuelto, o cuando conviene pasar a práctica de consolidación.",
    familyRole: "Puede priorizar qué deber importa hoy, sin dirigir cada paso.",
    statusLabel: "deber en curso",
  },
  exam_preparation: {
    mode: "exam_preparation",
    label: "preparar examen",
    headline: "Modo examen",
    subheadline: "La sesión se organiza para repasar, priorizar y ensayar con intención.",
    objective: "Preparar una evaluación próxima con foco en lo que más impacto tiene hoy.",
    primaryCta: "Preparar examen",
    chatBehavior: "Prioriza temas, detecta huecos y propone secuencias de repaso y simulación.",
    boardBehavior: "Muestra mapa corto de examen, bloques de repaso y práctica tipo prueba.",
    progression: ["definir alcance", "priorizar temas", "repasar", "simular", "cerrar plan siguiente"],
    tutorTone: "estratégico y tranquilizador",
    completionRule: "Termina cuando queda un bloque útil cubierto y un siguiente repaso claro.",
    familyRole: "Puede señalar fecha o prioridad del examen, sin convertir la sesión en presión.",
    statusLabel: "preparación de examen",
  },
  subject_reinforcement: {
    mode: "subject_reinforcement",
    label: "reforzar materia",
    headline: "Modo refuerzo",
    subheadline: "La sesión nace de una necesidad de comprensión, aunque no haya deber pendiente.",
    objective: "Consolidar una materia o tema que hoy necesita apoyo extra.",
    primaryCta: "Reforzar materia",
    chatBehavior: "Detecta el punto de atasco conceptual y propone explicación más práctica guiada.",
    boardBehavior: "Abre una pizarra de comprensión y práctica breve centrada en un solo objetivo.",
    progression: ["detectar hueco", "explicar", "practicar", "comprobar", "decidir siguiente foco"],
    tutorTone: "paciente y pedagógico",
    completionRule: "Termina cuando el alumno recupera claridad suficiente para seguir con más confianza.",
    familyRole: "Puede sugerir materia prioritaria, sin imponer una agenda rígida.",
    statusLabel: "refuerzo activo",
  },
  study_routine: {
    mode: "study_routine",
    label: "cumplir rutina",
    headline: "Modo rutina",
    subheadline: "La sesión sirve para sostener hábito y continuidad, no solo apagar urgencias.",
    objective: "Cumplir una rutina diaria de estudio de forma viable, humana y mantenible.",
    primaryCta: "Entrar en rutina",
    chatBehavior: "Elige el mejor bloque de hoy, baja fricción de arranque y protege continuidad.",
    boardBehavior: "Convierte la rutina en un bloque claro con duración, foco y cierre concreto.",
    progression: ["arrancar", "sostener bloque", "cerrar", "dejar siguiente pista"],
    tutorTone: "constante y ligero",
    completionRule: "Termina cuando se cierra un bloque útil de estudio y queda sensación de continuidad.",
    familyRole: "Define ritmos y prioridades semanales, sin enfriar la experiencia.",
    statusLabel: "rutina en marcha",
  },
  soft_reentry: {
    mode: "soft_reentry",
    label: "volver suave",
    headline: "Modo vuelta suave",
    subheadline: "La sesión nace de cansancio, bloqueo o desconexión y protege el reenganche.",
    objective: "Recuperar confianza y ritmo con una entrada pequeña, clara y no amenazante.",
    primaryCta: "Volver con calma",
    chatBehavior: "Reduce carga, ofrece una primera victoria rápida y evita saturar con opciones.",
    boardBehavior: "Simplifica la pizarra, deja un único paso visible y premia continuidad sobre intensidad.",
    progression: ["reconectar", "cerrar micro-victoria", "evaluar energía", "subir o cerrar"],
    tutorTone: "calmo, contenedor y muy guiado",
    completionRule: "Termina cuando el alumno recupera tracción o está listo para cambiar a otro modo.",
    familyRole: "Aporta calma, presencia y expectativas pequeñas; no presión.",
    statusLabel: "reentrada protegida",
  },
};

function inferInputKind(input: ResolveMentoriaSessionModeInput): MentoriaSessionInputKind {
  if (input.suggestedInputKind) return input.suggestedInputKind;
  const normalizedTopic = `${input.currentTopic ?? ""} ${input.currentMessage ?? ""}`.toLowerCase();
  if (normalizedTopic.includes("examen") || normalizedTopic.includes("control") || normalizedTopic.includes("prueba")) {
    return "exam_photo";
  }
  if (input.activeTask) return "family_routine";
  if (input.selectedSubject) return "selected_subject";
  if (input.latestSession?.recommendedNextStep) return "recent_session";
  return "free_message";
}

export function resolveMentoriaSessionMode(input: ResolveMentoriaSessionModeInput): MentoriaSessionMode {
  const normalized = `${input.currentTopic ?? ""} ${input.currentMessage ?? ""} ${input.suggestedPrompt ?? ""}`.toLowerCase();
  const state = input.stateLabel?.toLowerCase() ?? "";

  if (normalized.includes("examen") || normalized.includes("control") || normalized.includes("prueba")) {
    return "exam_preparation";
  }

  if (state.includes("disconnect") || state.includes("reentry") || state.includes("desconect") || state.includes("bloque") || state.includes("overload")) {
    return "soft_reentry";
  }

  if (input.latestSession?.recommendedNextStep && (state.includes("recover") || input.recentActivityLabel === "ayer")) {
    return "soft_reentry";
  }

  if (input.activeTask && (normalized.includes("deber") || normalized.includes("tarea") || normalized.includes("homework"))) {
    return "task_resolution";
  }

  if (input.activeTask && input.dailyPlan?.tasks.length) {
    return "study_routine";
  }

  if (input.selectedSubject) {
    return "subject_reinforcement";
  }

  if (input.dailyPlan?.tasks.length) {
    return "study_routine";
  }

  return "subject_reinforcement";
}

export function buildMentoriaSessionContract(mode: MentoriaSessionMode, inputKind: MentoriaSessionInputKind): MentoriaSessionContract {
  const base = SESSION_MODE_CONTRACTS[mode];
  const entryLabel = inputKind === "task_photo"
    ? "foto de tarea"
    : inputKind === "exam_photo"
      ? "foto o contexto de examen"
      : inputKind === "pasted_text"
        ? "texto pegado"
        : inputKind === "selected_subject"
          ? "materia seleccionada"
          : inputKind === "orchestrator_recommendation"
            ? "recomendación del tutor"
            : inputKind === "family_routine"
              ? "rutina o prioridad familiar"
              : inputKind === "student_state_signal"
                ? "estado detectado del alumno"
                : inputKind === "recent_session"
                  ? "continuidad reciente"
                  : "mensaje libre";

  return {
    ...base,
    entryKind: inputKind,
    entryLabel,
  };
}

export function buildMentoriaSessionModeOptions(input: ResolveMentoriaSessionModeInput): MentoriaSessionModeOption[] {
  const subjectName = input.selectedSubject?.subject?.name ?? input.currentTopic ?? "la materia";
  const subjectSlug = input.selectedSubject?.subject?.slug ?? null;
  const taskSubject = input.activeTask?.subject ?? subjectName;
  const examTopic = input.currentTopic?.trim() || `Preparar ${subjectName}`;

  return [
    {
      mode: "task_resolution",
      label: "Resolver tarea",
      description: "Abrir un deber concreto y resolverlo paso a paso.",
      ctaLabel: "Resolver con el tutor",
      topic: `Tarea de ${taskSubject}`,
      prompt: `Quiero resolver una tarea de ${taskSubject} paso a paso sin que me lo hagas todo.`,
      inputKind: input.activeTask ? "family_routine" : "task_photo",
      subjectSlug,
    },
    {
      mode: "exam_preparation",
      label: "Preparar examen",
      description: "Organizar repaso, detectar huecos y practicar con foco.",
      ctaLabel: "Preparar examen",
      topic: examTopic,
      prompt: `Quiero preparar un examen de ${subjectName}. Ayudame a priorizar, repasar y practicar lo importante.`,
      inputKind: "exam_photo",
      subjectSlug,
    },
    {
      mode: "subject_reinforcement",
      label: "Reforzar materia",
      description: "Trabajar una materia aunque hoy no haya deber.",
      ctaLabel: "Reforzar materia",
      topic: `Refuerzo de ${subjectName}`,
      prompt: `Quiero reforzar ${subjectName} aunque no tenga tarea. Ayudame a entender lo que hoy me conviene practicar.`,
      inputKind: "selected_subject",
      subjectSlug,
    },
    {
      mode: "study_routine",
      label: "Cumplir rutina",
      description: "Entrar en el bloque de estudio que toca hoy y sostener hábito.",
      ctaLabel: "Entrar en rutina",
      topic: `Rutina de ${taskSubject}`,
      prompt: `Quiero cumplir mi rutina de estudio de hoy. Dime cuál es el mejor bloque para empezar y acompáñame.`,
      inputKind: "family_routine",
      subjectSlug,
    },
    {
      mode: "soft_reentry",
      label: "Volver suave",
      description: "Reenganchar sin presión después de bloqueo o cansancio.",
      ctaLabel: "Volver con calma",
      topic: `Vuelta suave en ${subjectName}`,
      prompt: `Hoy me cuesta arrancar. Quiero volver suave con ${subjectName}, con una primera victoria pequeña y clara.`,
      inputKind: "student_state_signal",
      subjectSlug,
    },
  ];
}
