// Generador determinista de oportunidades de financiación. Los portales oficiales no
// tienen API pública, así que el agente no hace scraping: genera 2-3 convocatorias
// verosímiles por portal a partir de la semana ISO actual (cambian cada lunes) y las
// marca con source = "simulado:<portal>" para que nunca se confundan con datos
// extraídos. La url apunta al buscador real del portal, no a una convocatoria inventada.
//
// Sin imports a propósito: lo usan tanto drako-scheduler (funding-agent.ts) como la
// ruta /api/cron/funding del worker de drako.systems.

export type FundingPortal = {
  id: string;
  name: string;
  url: string;
};

export type FundingOpportunityInput = {
  title: string;
  organism: string;
  description: string;
  amount_min: number | null;
  amount_max: number | null;
  deadline: string | null;
  url: string;
  tags: string[];
  source: string;
};

export const FUNDING_PORTALS: FundingPortal[] = [
  { id: "one.gob.es", name: "Oficina Nacional de Emprendimiento", url: "https://one.gob.es/es/buscador-de-ayudas-e-incentivos-para-empresas" },
  { id: "planderecuperacion.gob.es", name: "Plan de Recuperación", url: "https://planderecuperacion.gob.es/asistente-de-busqueda-de-convocatorias" },
  { id: "ipyme.org", name: "Portal PYME (Ipyme)", url: "https://ipyme.org/es-es/AyudasIncentivos/Paginas/buscador-de-ayudas.aspx" },
];

type Template = {
  title: string;
  organism: string;
  description: string;
  amountMin: number | null;
  amountMax: number | null;
  deadlineDays: number;
  tags: string[];
};

const TEMPLATES: Record<string, Template[]> = {
  "one.gob.es": [
    { title: "Préstamos participativos para startups tecnológicas", organism: "ENISA", description: "Financiación sin garantías para empresas emergentes con modelo de negocio innovador y escalable.", amountMin: 25_000, amountMax: 300_000, deadlineDays: 60, tags: ["startup", "préstamo", "saas"] },
    { title: "Ayudas a emprendedores digitales — Ley de Startups", organism: "Ministerio de Economía", description: "Incentivos para empresas certificadas como startup bajo la Ley 28/2022 que desarrollen producto digital propio.", amountMin: 10_000, amountMax: 75_000, deadlineDays: 45, tags: ["startup", "digitalización"] },
    { title: "Programa de aceleración de empresas de IA", organism: "Oficina Nacional de Emprendimiento", description: "Mentoría, créditos cloud y apoyo económico para empresas que desarrollen soluciones de inteligencia artificial.", amountMin: 5_000, amountMax: 50_000, deadlineDays: 30, tags: ["ia", "aceleración"] },
    { title: "Línea Emprendedores Innovadores", organism: "ENISA", description: "Préstamo participativo para proyectos de base tecnológica en fase de crecimiento.", amountMin: 50_000, amountMax: 1_500_000, deadlineDays: 90, tags: ["crecimiento", "préstamo"] },
    { title: "Ayudas a la internacionalización de startups", organism: "ICEX", description: "Apoyo a startups tecnológicas para validar y lanzar su producto en mercados exteriores.", amountMin: 5_000, amountMax: 40_000, deadlineDays: 40, tags: ["internacionalización", "saas"] },
  ],
  "planderecuperacion.gob.es": [
    { title: "Kit Digital — bono de digitalización para pymes", organism: "Red.es", description: "Bono para adoptar soluciones de digitalización: web, redes sociales, CRM, factura electrónica y ciberseguridad.", amountMin: 2_000, amountMax: 12_000, deadlineDays: 75, tags: ["digitalización", "pyme", "next-generation"] },
    { title: "Kit Consulting — asesoramiento en IA y analítica", organism: "Red.es", description: "Bono para contratar servicios de asesoramiento en inteligencia artificial, analítica de datos y ciberseguridad.", amountMin: 12_000, amountMax: 24_000, deadlineDays: 50, tags: ["ia", "consultoría", "next-generation"] },
    { title: "PERTE Nueva Economía de la Lengua — IA en español", organism: "Ministerio para la Transformación Digital", description: "Proyectos de procesamiento del lenguaje natural y modelos de IA entrenados en español y lenguas cooficiales.", amountMin: 100_000, amountMax: 2_000_000, deadlineDays: 70, tags: ["ia", "lenguaje", "perte"] },
    { title: "Programa Activa Ciberseguridad", organism: "INCIBE", description: "Ayudas para que pymes y SaaS refuercen su ciberseguridad y cumplimiento normativo.", amountMin: 5_000, amountMax: 60_000, deadlineDays: 35, tags: ["ciberseguridad", "pyme"] },
    { title: "Misiones de I+D en Inteligencia Artificial", organism: "CDTI", description: "Proyectos colaborativos de I+D en IA aplicada a sectores estratégicos de la economía.", amountMin: 500_000, amountMax: 5_000_000, deadlineDays: 85, tags: ["ia", "i+d", "cdti"] },
  ],
  "ipyme.org": [
    { title: "CDTI Neotec — empresas de base tecnológica", organism: "CDTI", description: "Subvención para nuevas empresas tecnológicas con plan de negocio basado en I+D propia.", amountMin: 70_000, amountMax: 325_000, deadlineDays: 55, tags: ["i+d", "startup", "cdti"] },
    { title: "Ayudas a la transformación digital de la pyme", organism: "Comunidad de Madrid", description: "Subvención regional para proyectos de digitalización e incorporación de IA en procesos de negocio.", amountMin: 6_000, amountMax: 50_000, deadlineDays: 40, tags: ["digitalización", "madrid", "ia"] },
    { title: "Proyectos de I+D empresarial (PID)", organism: "CDTI", description: "Ayuda parcialmente reembolsable para proyectos de investigación y desarrollo de nuevos productos software.", amountMin: 175_000, amountMax: 1_000_000, deadlineDays: 120, tags: ["i+d", "software"] },
    { title: "Bonos de innovación para pymes", organism: "Cámara de Comercio de España", description: "Cofinanciación de proyectos de innovación tecnológica y diseño de producto digital.", amountMin: 3_000, amountMax: 7_000, deadlineDays: 30, tags: ["innovación", "pyme"] },
    { title: "Línea ICO Empresas y Emprendedores", organism: "ICO", description: "Financiación para inversión productiva y liquidez de autónomos y empresas tecnológicas.", amountMin: 25_000, amountMax: 12_500_000, deadlineDays: 150, tags: ["préstamo", "crecimiento"] },
  ],
};

// Semana ISO (1-53) y año ISO de la fecha.
export function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { year: d.getUTCFullYear(), week: Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7) };
}

// Monday 00:00 UTC de la semana de `date` — base estable para los plazos de la semana.
function weekStart(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return d;
}

export function generateFundingOpportunities(date = new Date()): FundingOpportunityInput[] {
  const { year, week } = isoWeek(date);
  const monday = weekStart(date);
  const seed = year * 53 + week;

  return FUNDING_PORTALS.flatMap((portal, portalIndex) => {
    const pool = TEMPLATES[portal.id] ?? [];
    if (!pool.length) return [];
    const count = 2 + ((seed + portalIndex) % 2); // 2 o 3 por portal
    const offset = (seed * 3 + portalIndex) % pool.length;
    return Array.from({ length: Math.min(count, pool.length) }, (_, i) => {
      const t = pool[(offset + i) % pool.length];
      const deadline = new Date(monday.getTime() + t.deadlineDays * 86_400_000).toISOString().slice(0, 10);
      return {
        title: `${t.title} ${year}`,
        organism: t.organism,
        description: t.description,
        amount_min: t.amountMin,
        amount_max: t.amountMax,
        deadline,
        url: portal.url,
        tags: t.tags,
        source: `simulado:${portal.id}`,
      };
    });
  });
}
