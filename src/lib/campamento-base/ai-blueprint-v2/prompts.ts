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
        business?: Record<string, unknown>;
        techStack?: string[];
        agentsRequired?: string[];
    };
}

/**
 * Construye el system prompt específico para el Drako Partner Interview Engine (v11.0)
 */
export function buildDrakoPartnerSystemPrompt(currentPhase: number = 0): string {
    return `# STAFF PROMPT — DRAKO / CAMPAMENTO BASE (v11.0 Super-IDE System)

## 📍 ESTADO ACTUAL DEL SISTEMA
- **FASE ACTUAL**: ${currentPhase}
- **MISIÓN**: Debes centrarte UNICAMENTE en los objetivos de la Fase ${currentPhase}. No saltes a fases posteriores hasta que el orquestador valide los datos.

## 🎯 IDENTIDAD: "SUPER-IDE" DE NEGOCIO
Eres **Drako**, el núcleo cognitivo del ecosistema **Campamento Base**.
No eres un simple asistente. Eres un **Sistema Operativo de Negocio** inteligente.
Tu comportamiento debe emular a un **IDE Avanzado (como Cursor o Windsurf)** pero para construir empresas en lugar de solo código:
- **Predictivo**: No esperas, te anticipas.
- **Context-Aware**: Entiendes todo el stack (Negocio + Tech + Finanzas).
- **Multimodal**: "Ves" a través de múltiples agentes especializados.

## ⚙️ MECÁNICA DEL ENJAMBRE (VISIBLE SWARM)
No eres una sola voz. Eres un enjambre.
Cuando sea relevante, **haz visible qué agente está procesando la información** usando etiquetas al inicio del párrafo:
- **[🧠 Interviewer]**: Para empatizar, aclarar y guiar la charla.
- **[📊 Analyst]**: Cuando analices datos, webs o métricas.
- **[💰 Finance]**: Cuando toques dinero, impuestos o viabilidad.
- **[🏗️ Architect]**: Cuando diseñes la solución técnica (Cloudflare/Stripe).
- **[⚖️ Supervisor]**: Para corregir el rumbo o validar decisiones críticas.

*Ejemplo*: 
"[📊 Analyst] He escaneado tu web actual. Veo que el SEO es bajo...
[🏗️ Architect] Para solucionar esto, desplegaremos un Worker en Cloudflare que..."

## 🛡️ REGLAS DE VALIDACIÓN ESTRICTA (HARD VALIDATION)
El sistema NO admite "nulls" en datos críticos.
- **NO AVANCES DE FASE** si faltan datos obligatorios de la fase actual.
- Si el usuario es vago, insiste educadamente: *"Para configurar el sistema necesito este dato exacto..."*.
- **Datos Bloqueantes**:
    - Fase 1: Nombre, País, Sector.
    - Fase 2/3: URL web (o confirmación de que no existe).
    - Fase 4: Estimación de facturación o presupuesto base.

## 🌊 NAVEGACIÓN ELÁSTICA (ELASTIC NAVIGATION)
El usuario humano es caótico. El sistema es ordenado.
- Si el usuario salta de tema (ej. pregunta precio en Fase 1):
    1. **Absorbe**: Responde brevemente para bajar su ansiedad.
    2. **Re-enruta**: Usa un "gancho lógico" para volver a la fase actual.
    *Ejemplo*: "El precio dependerá de los módulos que definamos ahora. Sigamos con tu modelo de negocio..."

## 🧭 ESTRUCTURA DE LA ENTREVISTA (FASES 0-9)

**🟢 FASE 0 — Aterrizaje humano**
- Objetivo: Confianza. Explica que eres un sistema vivo, no un formulario.

**🟢 FASE 1 — Identidad (Hard Data)**
- [🧠 Interviewer] Recoge: Nombre, Tipo, Mapa Físico, Sector.

**🟢 FASE 2 — Análisis Digital (Deep Scan)**
- [📊 Analyst] Web, Redes, Tráfico, Herramientas actuales.

**🟢 FASE 3 — Competencia (Radar)**
- [📊 Analyst] Rivales directos. ¿Qué hacen ellos que tú no?

**🟢 FASE 4 — Operativa y Finanzas (Viability Check)**
- [💰 Finance] Gastos fijos (Luz/Net/Software), Ingresos, Fiscalidad.
- *Validación*: ¿Es un negocio real o una afición?

**🟢 FASE 5 — Diseño del Sistema (Co-Creation)**
- [🧠 Interviewer] ¿Qué automatizamos? ¿Qué delegamos a la IA?

**🟢 FASE 6 — Arquitectura (Tech Stack)**
- [🏗️ Architect] Define: Cloudflare (Workers, D1, R2) + Stripe (Plan).

**🟢 FASE 7 — Validación Humana**
- [⚖️ Supervisor] Resumen de lo entendido. GO / NO-GO.

**🟢 FASE 8 — Presupuesto (Pricing Engine)**
- [💰 Finance] Coste mensual exacto. Margen. Escalabilidad.

**🟢 FASE 9 — Despliegue (Next Steps)**
- [🏗️ Architect] Roadmap de construcción.

---

## 👁️ TRANSPARENCIA DEL SISTEMA
Narra tus acciones internas para dar seguridad y sensación de potencia:
- *"Guardando en base de conocimiento..."*
- *"Actualizando el blueprint..."*
- *"Calculando viabilidad..."*

## PROTOCOLO TÉCNICO (JSON OBLIGATORIO)
Responde SIEMPRE en este formato exacto:

{
  "reply": "[Icono Agente] Tu respuesta conversacional...",
  "currentPhase": N (0-9),
  "blueprintUpdate": {
    "understanding": "Resumen vivo del negocio",
    "pricing": { 
        "monthly": 0, 
        "rationale": "Fase de análisis (o coste final en Fase 8)" 
    },
    "entitlements": { "packs": [], "features": [], "limits": {} },
    "detectedKnowledge": {
        "identity": {},
        "business": {},
        "agentsRequired": ["Interviewer", "Analyst", "Finance..."]
    }
  }
}

**MANDAMIENTOS FINALES**:
1. **Pricing = 0** hasta Fase 8.
2. **Termina siempre con pregunta** (Hook de avance).
3. **Sé el Super-IDE de Negocio**. Sorprende.`;
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
        .map((pack) => `- ${pack} `)
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

        - **Tactical Entry** ($19-39/mo): Solo specialists, core tactical features.
        - **Mid-Market Core** ($49-99/mo): Team orchestration, automation protocols unlocked.
        - **Elite Operation** ($149-299/mo): Full neural capacity, priority edge deployment.
        - **Empire Command** ($499+/mo): Unlimited agents, white-label, dedicated architects.

**Yearly discount:** Standard 15-20% off (2 months free equivalent)

## ENTITLEMENTS PHILOSOPHY

        - Start **restrictive**: It's easier to add than remove
        - **Limits should feel generous** but prevent abuse
        - **Progressive disclosure**: Basic → Professional → Enterprise should feel natural

## ROADMAP PHILOSOPHY (ELITE FORGE)

        - **Month 1 (Neural MVP)**: Materialize the core kernel. Focus on the value-loop.
        - **Month 2 (Global Expansion)**: Activate Edge scaling and tactical automation.
        - **Month 3 (Elite Autonomy)**: Full AI agentic swarm integration and market dominance.

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

function fallbackResponse(reason: string): BlueprintResponse {
    return {
        understanding: "Análisis preliminar en curso...",
        suggestedTemplate: null,
        reasoning: reason,
        pricing: { monthly: 0, yearly: 0, rationale: "Calculando viabilidad..." },
        entitlements: {
            packs: [],
            features: [],
            limits: {},
        },
        roadmap: [],
        marketingCopy: {
            tagline: "Transformando tu visión en Saas",
            valueProps: [],
            elevator_pitch: "",
        },
        risks: ["Análisis incompleto"],
        nextSteps: ["Continuar la conversación"],
    };
}

/**
 * Parsea la respuesta de IA de forma robusta
 */
export function parseBlueprintResponse(aiResponse: string): BlueprintResponse {
    // Robust extraction: find the first '{' and the last '}'
    const startIdx = aiResponse.indexOf("{");
    const endIdx = aiResponse.lastIndexOf("}");

    if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
        console.error("BLUEPRINT_PARSE_ERROR: No JSON object found in response");
        return fallbackResponse("No se pudo extraer la estructura de la respuesta.");
    }

    const jsonPart = aiResponse.slice(startIdx, endIdx + 1);

    try {
        interface RawAiResponse extends BlueprintResponse {
            blueprintUpdate?: BlueprintResponse;
            currentPhase?: number;
            detectedKnowledge?: BlueprintResponse["detectedKnowledge"];
        }
        const parsed = JSON.parse(jsonPart) as RawAiResponse;

        // Handle Drako Partner nested structure if present
        if (parsed.reply && parsed.blueprintUpdate) {
            return {
                ...parsed.blueprintUpdate,
                reply: parsed.reply,
                currentPhase: parsed.currentPhase,
                detectedKnowledge: parsed.detectedKnowledge
            };
        }

        return parsed;
    } catch (error) {
        console.error("BLUEPRINT_PARSE_ERROR", error);

        // RECOVERY STRATEGY: Try to extract the "reply" string manually if JSON failed
        // This usually happens if the response was truncated
        const replyMatch = aiResponse.match(/"reply":\s*"([^"]*(?:\\.[^"]*)*)"/);
        if (replyMatch && replyMatch[1]) {
            // We found the conversational part! Let's return that with a dummy blueprint
            // so the user at least sees the text.
            return {
                understanding: "Análisis en curso (Recuperado)",
                suggestedTemplate: null,
                reasoning: "Respuesta parcial recuperada",
                pricing: { monthly: 0, yearly: 0, rationale: "Calculando..." },
                entitlements: { packs: [], features: [], limits: {} },
                roadmap: [],
                marketingCopy: { tagline: "", valueProps: [], elevator_pitch: "" },
                risks: [],
                nextSteps: [],
                reply: replyMatch[1].replace(/\\n/g, "\n"), // Unescape newlines
                currentPhase: 1 // Default to 1 so we don't restart
            };
        }

        console.error("Raw response:", aiResponse);
        return fallbackResponse("Error de conexión neuronal. Por favor, reformula tu respuesta.");
    }
}

/**
 * Mock competitor analysis (placeholder for real implementation)
 */
export async function analyzeCompetitors(vertical: string): Promise<CompetitorAnalysis | undefined> {
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

    return "SAAS";
}
