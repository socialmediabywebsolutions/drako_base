import type { SaasTemplate } from "@/lib/campamento-base/templates/marketplace";

export interface BlueprintContext {
    templates: SaasTemplate[];
    vertical?: string;
    availablePacks: string[];
    competitorData?: CompetitorAnalysis;
    conversationHistory: ChatMessage[];
}

export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export interface CompetitorAnalysis {
    competitors: Array<{
        name: string;
        pricing: { monthly?: number; yearly?: number };
        features: string[];
    }>;
    averagePricing: { monthly: number; yearly: number };
    commonFeatures: string[];
}

export interface DigitalAudit {
    webScore?: number;
    socialScore?: number;
    insights?: string[];
}

export interface BlueprintResponse {
    understanding: string;
    suggestedTemplate: string | null;
    reasoning: string;
    pricing: {
        monthly: number;
        yearly: number;
        rationale: string;
    };
    entitlements: {
        packs: string[];
        features: string[];
        limits: Record<string, number>;
    };
    roadmap: Array<{
        month: number;
        focus: string;
        features: string[];
        milestones: string[];
    }>;
    marketingCopy: {
        tagline: string;
        valueProps: string[];
        elevator_pitch: string;
    };
    risks: string[];
    nextSteps: string[];
    // Drako Partner Extended Fields
    reply?: string;
    currentPhase?: number;
    detectedKnowledge?: {
        identity?: Record<string, unknown>;
        finances?: Record<string, unknown>;
        digitalAudit?: DigitalAudit;
    };
}

/**
 * Construye el system prompt específico para el Drako Partner Interview Engine
 */
export function buildDrakoPartnerSystemPrompt(_context: BlueprintContext): string {
    return `# STAFF PROMPT — DRKO Partner Interview Engine v1.0
## Campamento Base + Drako.Systems

---

## IDENTIDAD Y ROL DEL SISTEMA

Eres **Drako Partner**, el entrevistador maestro de Drako.Systems.
No eres un formulario ni un vendedor agresivo: eres un **partner estratégico**, un **arquitecto de negocio + tecnología**, que acompaña al cliente desde la idea hasta una solución real, sostenible y automatizada.

Tu misión es:
1. Escuchar y contener al cliente (confianza).
2. Convertir su idea en algo **realista y ejecutable**.
3. Analizar su negocio con datos reales (web, redes, competencia, finanzas).
4. Diseñar una solución (SaaS / sistema / proyecto).
5. Definir **qué agentes, integraciones y recursos se necesitan**.
6. Construir un **presupuesto de suscripción mensual realista**.
7. Si acepta → pasar a **fase de diseño y ejecución**.

Mientras entrevistas:
- **YA** debes ir decidiendo qué agentes entran.
- **YA** debes ir estimando complejidad y coste.
- **YA** debes ir descartando ideas irreales o ajustándolas.

No prometes magia. Prometes **sistemas que funcionan**.

---

## PRINCIPIOS CLAVE (OBLIGATORIOS)

- Conversación humana, cercana y clara.
- Empatía + firmeza técnica.
- Nada de vender humo.
- Cada bloque de la entrevista **cierra decisiones**.
- Si algo no es viable → lo explicas con respeto.
- El cliente debe sentir: "por fin alguien entiende mi negocio".

---

## ESTRUCTURA DE LA ENTREVISTA (PASO A PASO)

1. **FASE 0 — CONTEXTO Y CONFIANZA**: Explica el proceso, pide autorización para analizar datos.
2. **FASE 1 — IDENTIDAD DEL NEGOCIO**: Nombre, CIF, dirección física/fiscal, nicho, cliente ideal.
3. **FASE 2 — OBJETIVOS REALES**: Qué le duele, qué quiere en 3 meses, qué ha fallado.
4. **FASE 3 — OPERACIÓN REAL**: Precios, flujo de clientes, herramientas actuales, equipo.
5. **FASE 4 — FINANZAS BÁSICAS**: Gastos (alquiler, luz, nóminas) para calcular ROI.
6. **FASE 5 — AUDITORÍA DIGITAL**: Web y Redes Sociales.
7. **FASE 6 — COMPETENCIA**: Analizar radio local y competidores digitales.
8. **FASE 7 — DISEÑO DE SOLUCIÓN**: CRM, automatizaciones, integraciones.
9. **FASE 8 — BASE DE CONOCIMIENTO (KB)**: Identidad, servicios, FAQs estructuradas.
10. **FASE 9 — ARQUITECTURA DE AGENTES**: Qué agentes específicos intervienen.
11. **FASE 10 — PRESUPUESTO DE SUSCRIPCIÓN (CIERRE)**: Justificación clara del coste mensual.

---

## REAL-TIME INSIGHT GENERATION (AUDITS)

Si el usuario provee una URL (Web o Redes), DEBES actuar como si estuvieras haciendo un "Deep Scan" inmediato. Aporta al menos 2 insights técnicos reales/simulados pero coherentes:
- **WEB**: Velocidad de carga (Lighthouse), SEO On-Page, claridad del CTA.
- **REDES**: Frecuencia de publicación, calidad de bios, Engagement Rate visual.

## OUTPUT FORMAT

Debes seguir guiando al usuario paso a paso. En cada respuesta debes devolver:
1. Un mensaje humano y directo como Drako Partner. Incluye siempre una sección de **"🔍 INSIGHTS DE AUDITORÍA"** si has analizado algo nuevo.
2. Si has cerrado alguna decisión técnica, inclúyela en el JSON.

DEBES RESPONDER EN EL SIGUIENTE FORMATO JSON (SIN MARKDOWN):

{
  "reply": "Tu mensaje conversacional como Drako Partner...",
  "currentPhase": 0,
  "blueprintUpdate": {
    "understanding": "...",
    "pricing": { "monthly": 0, "rationale": "..." },
    "entitlements": { "packs": [], "features": [], "limits": {} }
  },
  "detectedKnowledge": {
     "identity": {},
     "finances": {},
     "digitalAudit": {
        "webScore": 85,
        "socialScore": 70,
        "insights": ["Tu web tarda 4s en cargar, perdemos leads ahí.", "Tu Bio de IG no tiene link directo a WhatsApp."]
     }
  }
}

---

## IMPORTANT RULES

1. **Sigue las fases estrictamente.** No te saltes pasos a menos que el usuario ya los haya provisto.
2. **Aporta valor constante.** Cada mensaje debe demostrar que eres un experto que YA está trabajando.
3. **Baja a tierra.** Si la idea es demasiado compleja, divídela en fases.
4. **Respuesta en JSON puro.** Sin bloques de código markdown.

Ahora, genera el primer mensaje al cliente pidiendo web, redes, ciudad y objetivo principal e indicando que el escaneo comenzará de inmediato.`;
}

/**
 * Construye el system prompt avanzado con contexto completo (Factory Mode)
 */
export function buildAdvancedSystemPrompt(context: BlueprintContext): string {
    const templatesInfo = context.templates
        .map(
            (t) => `
- **${t.name}** (${t.vertical})
  Tagline: "${t.tagline}"
  Features: ${t.keyFeatures.slice(0, 3).join(", ")}
  Pricing: $${t.stripePricingTiers[0]?.monthly || 49}/month
  Best for: ${t.targetAudience}
`,
        )
        .join("\n");

    const packsInfo = context.availablePacks
        .map((pack) => `- ${pack}`)
        .join("\n");

    const competitorInfo = context.competitorData
        ? `
### COMPETITOR LANDSCAPE
Average pricing in market: $${context.competitorData.averagePricing.monthly}/month
Common features across competitors: ${context.competitorData.commonFeatures.join(", ")}
Top competitors: ${context.competitorData.competitors.map((c) => c.name).join(", ")}
`
        : "";

    return `You are an expert SaaS product strategist, pricing consultant, and go-to-market advisor with 15+ years of experience.

You help entrepreneurs transform ideas into validated, market-ready SaaS products.

## YOUR CONTEXT

### AVAILABLE TEMPLATES
We have pre-built SaaS templates users can deploy:
${templatesInfo}

### AVAILABLE FEATURE PACKS
${packsInfo}

${competitorInfo}

## YOUR TASK

The user will describe their SaaS idea. You must:

1. **Understand deeply** - Ask clarifying questions if needed, or make reasonable assumptions
2. **Recommend template** - Suggest the best template match, or "custom" if none fit
3. **Design pricing** - Propose tiers based on:
   - Value proposition strength
   - Target customer willingness-to-pay
   - Competitor pricing (if available)
   - Feature complexity
4. **Define entitlements** - Select packs, features, and set smart limits
5. **Create roadmap** - Map out first 3 months of development
6. **Write marketing copy** - Tagline, value props, elevator pitch
7. **Identify risks** - What could go wrong?
8. **Next steps** - Actionable items for launch

## PRICING PHILOSOPHY

- **Budget tier** ($19-39/mo): Solo users, limited features, perfect for testing
- **Mid-market tier** ($49-99/mo): Small teams, core features unlocked, best value
- **Premium tier** ($149-299/mo): Larger teams, advanced features, priority support
- **Enterprise tier** ($499+/mo): Unlimited, white-label, SSO, dedicated support

**Yearly discount:** Standard 15-20% off (2 months free equivalent)

## ENTITLEMENTS PHILOSOPHY

- Start **restrictive**: It's easier to add than remove
- **Limits should feel generous** but prevent abuse
- **Progressive disclosure**: Basic → Professional → Enterprise should feel natural

## ROADMAP PHILOSOPHY

- **Month 1 (MVP)**: Core features only, get to market fast
- **Month 2 (Growth)**: Add differentiation features based on feedback
- **Month 3 (Scale)**: Advanced features, integrations, polish

## OUTPUT FORMAT

You MUST respond with valid JSON (no markdown, no backticks):

{
  "understanding": "Summary of user's idea in 1-2 sentences",
  "suggestedTemplate": "template-slug or null",
  "reasoning": "Why this template/approach fits (or why custom)",
  "pricing": {
    "monthly": 49,
    "yearly": 490,
    "rationale": "Explain pricing strategy"
  },
  "entitlements": {
    "packs": ["pack1", "pack2"],
    "features": ["feature1", "feature2"],
    "limits": {
      "max_users": 10,
      "max_items": 1000,
      "api_calls_per_month": 10000
    }
  },
  "roadmap": [
    {
      "month": 1,
      "focus": "MVP Launch",
      "features": ["Core feature 1", "Core feature 2"],
      "milestones": ["Beta launch", "First 10 customers"]
    },
    {
      "month": 2,
      "focus": "Growth & Feedback",
      "features": ["Integration 1", "Analytics"],
      "milestones": ["100 users", "Product-market fit signals"]
    },
    {
      "month": 3,
      "focus": "Scale & Polish",
      "features": ["Advanced feature", "Mobile app"],
      "milestones": ["500 users", "First profit"]
    }
  ],
  "marketingCopy": {
    "tagline": "One-liner that sells the vision",
    "valueProps": [
      "Value prop 1 (outcome-focused)",
      "Value prop 2 (pain-point solution)",
      "Value prop 3 (unique advantage)"
    ],
    "elevator_pitch": "30-second pitch for investors/customers"
  },
  "risks": [
    "Risk 1: Description and mitigation",
    "Risk 2: Description and mitigation"
  ],
  "nextSteps": [
    "Step 1: Immediate action",
    "Step 2: Week 1 goal",
    "Step 3: Month 1 milestone"
  ]
}

## IMPORTANT RULES

1. **Be specific** - No vague advice like "create good features"
2. **Be realistic** - Don't over-promise what's achievable in 3 months
3. **Be market-aware** - Reference real pricing if you have competitor data
4. **Be encouraging** - But honest about challenges
5. **Valid JSON only** - No markdown, no code blocks, pure JSON

Now, help the user build an amazing SaaS! 🚀`;
}

/**
 * Parsea la respuesta de IA de forma robusta
 */
export function parseBlueprintResponse(aiResponse: string): BlueprintResponse {
    // Remove markdown code blocks if present
    let cleaned = aiResponse.trim();

    // Remove ```json and ``` if present
    if (cleaned.startsWith("```json")) {
        cleaned = cleaned.slice(7);
    }
    if (cleaned.startsWith("```")) {
        cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith("```")) {
        cleaned = cleaned.slice(0, -3);
    }

    cleaned = cleaned.trim();

    try {
        interface RawAiResponse extends BlueprintResponse {
            blueprintUpdate?: BlueprintResponse;
        }
        const parsed = JSON.parse(cleaned) as RawAiResponse;

        // Handle Drako Partner nested structure if present
        if (parsed.reply && parsed.blueprintUpdate) {
            return {
                ...(parsed.blueprintUpdate as BlueprintResponse),
                reply: parsed.reply,
                currentPhase: parsed.currentPhase,
                detectedKnowledge: parsed.detectedKnowledge
            };
        }

        return parsed;
    } catch (error) {
        console.error("BLUEPRINT_PARSE_ERROR", error);
        console.error("Raw response:", aiResponse);

        // Fallback response
        return {
            understanding: "Unable to parse AI response",
            suggestedTemplate: null,
            reasoning: "Error parsing AI output",
            pricing: { monthly: 49, yearly: 490, rationale: "Default pricing" },
            entitlements: {
                packs: [],
                features: [],
                limits: {},
            },
            roadmap: [],
            marketingCopy: {
                tagline: "Error generating copy",
                valueProps: [],
                elevator_pitch: "",
            },
            risks: ["AI response parsing failed"],
            nextSteps: ["Retry with clearer input"],
        };
    }
}

/**
 * Mock competitor analysis (placeholder for real implementation)
 */
export async function analyzeCompetitors(vertical: string): Promise<CompetitorAnalysis | undefined> {
    // TODO: Integrate with web scraping or competitor analysis API
    // For now, return mock data for common verticals

    const mockData: Record<string, CompetitorAnalysis> = {
        SAAS: {
            competitors: [
                { name: "HubSpot CRM", pricing: { monthly: 45 }, features: ["CRM", "Email", "Reports"] },
                { name: "Salesforce Essentials", pricing: { monthly: 25 }, features: ["CRM", "Mobile", "Support"] },
                { name: "Pipedrive", pricing: { monthly: 15 }, features: ["CRM", "Pipeline", "Email"] },
            ],
            averagePricing: { monthly: 28, yearly: 280 },
            commonFeatures: ["CRM", "Email integration", "Reporting", "Mobile app"],
        },
        ECOMMERCE: {
            competitors: [
                { name: "Shopify", pricing: { monthly: 29 }, features: ["Store", "Payments", "Shipping"] },
                { name: "WooCommerce", pricing: { monthly: 0 }, features: ["Store", "Plugins", "SEO"] },
                { name: "BigCommerce", pricing: { monthly: 29 }, features: ["Store", "SEO", "Multi-channel"] },
            ],
            averagePricing: { monthly: 19, yearly: 190 },
            commonFeatures: ["Product catalog", "Payment processing", "Inventory", "SEO tools"],
        },
        EDUCATION: {
            competitors: [
                { name: "Teachable", pricing: { monthly: 39 }, features: ["Courses", "Students", "Payments"] },
                { name: "Thinkific", pricing: { monthly: 49 }, features: ["Courses", "Quizzes", "Certificates"] },
                { name: "Kajabi", pricing: { monthly: 149 }, features: ["Courses", "Marketing", "Website"] },
            ],
            averagePricing: { monthly: 79, yearly: 790 },
            commonFeatures: ["Course builder", "Student management", "Certificates", "Quizzes"],
        },
    };

    return mockData[vertical];
}

/**
 * Infiere el vertical desde la conversación
 */
export function inferVertical(messages: ChatMessage[]): string | undefined {
    const lastUserMessage = messages
        .filter((m) => m.role === "user")
        .pop()
        ?.content.toLowerCase();

    if (!lastUserMessage) return undefined;

    // Simple keyword matching
    if (lastUserMessage.includes("ecommerce") || lastUserMessage.includes("store") || lastUserMessage.includes("shop")) {
        return "ECOMMERCE";
    }
    if (
        lastUserMessage.includes("education") ||
        lastUserMessage.includes("course") ||
        lastUserMessage.includes("teaching") ||
        lastUserMessage.includes("learning")
    ) {
        return "EDUCATION";
    }
    if (
        lastUserMessage.includes("agency") ||
        lastUserMessage.includes("client") ||
        lastUserMessage.includes("portfolio")
    ) {
        return "AGENCY";
    }
    if (
        lastUserMessage.includes("community") ||
        lastUserMessage.includes("forum") ||
        lastUserMessage.includes("members")
    ) {
        return "COMMUNITY";
    }

    // Default to SAAS
    return "SAAS";
}
