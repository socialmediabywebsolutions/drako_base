export type AcquisitionPost = {
  id: string;
  content: string;
  hook: string;
  cta: string;
  channel: "linkedin" | "instagram" | "tiktok";
  category: "parent_frustration" | "problem_awareness" | "social_proof" | "educational";
  scheduledAt?: string;
  publishedAt?: string;
  clicks?: number;
  signups?: number;
};

const PARENT_FRUSTRATION_HOOKS = [
  "¿Cómo sé si mi hijo realmente está aprendiendo?",
  "Mi hijo dice que entiende, pero luego falla en el examen.",
  "Pago clases particulares pero no veo progreso real.",
  "¿Por qué mi hijo no quiere estudiar?",
  "Veo que estudia, pero los resultados no llegan.",
  "¿Cómo puedo ayudar si no entiendo la materia?",
  "Mi hijo se frustra rápido con los deberes.",
  "No sé si está en el camino correcto académicamente.",
];

const PROBLEM_AWARENESS_HOOKS = [
  "El 70% de los padres no saben cómo está realmente el aprendizaje de sus hijos.",
  "La mayoría de estudiantes aprenden de forma reactiva, no proactiva.",
  "Sin feedback real, es imposible mejorar.",
  "Los problemas de aprendizaje se detectan demasiado tarde.",
  "La educación genérica no funciona para todos.",
  "El estrés académico crece sin intervención temprana.",
  "Los estudiantes necesitan adaptación, no solo contenido.",
];

const PROBLEM_STATEMENTS = [
  "Tu hijo estudia, pero ¿realmente está aprendiendo?",
  "Los deberes son una lucha diaria sin progreso visible.",
  "No sabes si necesita refuerzo o si está en el camino correcto.",
  "La frustración crece, la confianza disminuye.",
  "Cada examen es una sorpresa desagradable.",
  "Inviertes tiempo y dinero, pero sin resultados claros.",
  "Tu hijo se siente perdido sin saber por qué.",
];

const SOLUTION_STATEMENTS = [
  "Mentoría detecta exactamente dónde está el problema.",
  "Sesiones personalizadas que se adaptan en tiempo real.",
  "Feedback inmediato: sabes exactamente cómo va tu hijo.",
  "Intervención temprana antes de que sea demasiado tarde.",
  "Confianza basada en datos, no en intuición.",
  "Progreso visible en cada sesión.",
  "Tu hijo aprende a su ritmo, con su estilo.",
];

const CTA_VARIATIONS = [
  "Prueba gratis 7 días → Mentoría",
  "Comienza la prueba gratuita de Mentoría",
  "Acceso gratis a Mentoría por 7 días",
  "Prueba Mentoría sin costo",
  "Descubre Mentoría: 7 días gratis",
  "Empieza hoy: prueba gratuita de Mentoría",
];

export function generateAcquisitionPost(input: {
  category: "parent_frustration" | "problem_awareness" | "social_proof" | "educational";
  channel: "linkedin" | "instagram" | "tiktok";
}): AcquisitionPost {
  const id = crypto.randomUUID();
  
  let hook: string;
  let problem: string;
  let solution: string;

  if (input.category === "parent_frustration") {
    hook = PARENT_FRUSTRATION_HOOKS[Math.floor(Math.random() * PARENT_FRUSTRATION_HOOKS.length)];
    problem = PROBLEM_STATEMENTS[Math.floor(Math.random() * PROBLEM_STATEMENTS.length)];
    solution = SOLUTION_STATEMENTS[Math.floor(Math.random() * SOLUTION_STATEMENTS.length)];
  } else if (input.category === "problem_awareness") {
    hook = PROBLEM_AWARENESS_HOOKS[Math.floor(Math.random() * PROBLEM_AWARENESS_HOOKS.length)];
    problem = PROBLEM_STATEMENTS[Math.floor(Math.random() * PROBLEM_STATEMENTS.length)];
    solution = SOLUTION_STATEMENTS[Math.floor(Math.random() * SOLUTION_STATEMENTS.length)];
  } else if (input.category === "social_proof") {
    hook = "Padres como tú ya confían en Mentoría";
    problem = "Ves que otros encuentran soluciones que tú no has encontrado.";
    solution = "Únete a cientos de familias que ya ven resultados reales.";
  } else {
    hook = "Educación personalizada es el futuro";
    problem = "La educación genérica no funciona para todos.";
    solution = "Mentoría adapta el aprendizaje a cada estudiante.";
  }

  const cta = CTA_VARIATIONS[Math.floor(Math.random() * CTA_VARIATIONS.length)];

  const content = buildPostContent({
    hook,
    problem,
    solution,
    cta,
    channel: input.channel,
  });

  return {
    id,
    content,
    hook,
    cta,
    channel: input.channel,
    category: input.category,
  };
}

function buildPostContent(input: {
  hook: string;
  problem: string;
  solution: string;
  cta: string;
  channel: "linkedin" | "instagram" | "tiktok";
}): string {
  if (input.channel === "linkedin") {
    return buildLinkedInPost(input);
  }
  if (input.channel === "instagram") {
    return buildInstagramPost(input);
  }
  return buildTikTokPost(input);
}

function buildLinkedInPost(input: { hook: string; problem: string; solution: string; cta: string }): string {
  return `${input.hook}

${input.problem}

Aquí está la realidad:
${input.solution}

Con Mentoría:
✓ Detectamos exactamente dónde está el problema
✓ Sesiones personalizadas que se adaptan en tiempo real
✓ Feedback inmediato sobre el progreso
✓ Intervención temprana antes de que sea demasiado tarde

${input.cta}

#Educación #Aprendizaje #Padres #Mentoría`;
}

function buildInstagramPost(input: { hook: string; problem: string; solution: string; cta: string }): string {
  return `${input.hook} 🎓

${input.problem}

${input.solution}

Con Mentoría:
✓ Detección automática de problemas
✓ Sesiones personalizadas
✓ Progreso visible

${input.cta}

#educación #aprendizaje #padres #mentoría`;
}

function buildTikTokPost(input: { hook: string; problem: string; solution: string; cta: string }): string {
  return `${input.hook}

${input.problem}

${input.solution}

${input.cta}`;
}

export function generateDailyContentBatch(count: number = 3): AcquisitionPost[] {
  const categories: Array<"parent_frustration" | "problem_awareness" | "social_proof" | "educational"> = [
    "parent_frustration",
    "problem_awareness",
    "social_proof",
    "educational",
  ];
  const channels: Array<"linkedin" | "instagram" | "tiktok"> = ["linkedin", "instagram", "tiktok"];

  const posts: AcquisitionPost[] = [];

  for (let i = 0; i < count; i++) {
    const category = categories[i % categories.length];
    const channel = channels[i % channels.length];

    posts.push(
      generateAcquisitionPost({
        category,
        channel,
      })
    );
  }

  return posts;
}
