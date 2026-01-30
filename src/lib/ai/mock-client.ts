type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/**
 * Mock responses for Drako Partner when running in development without Cloudflare AI
 */

const PHASE_RESPONSES: Record<number, string> = {
    0: `Entiendo. Trabajas con **{business}**.

Antes de arquitecturar tu solución, necesito mapear tu situación actual. 

**Diagnóstico Fase 1 - Operación Actual:**
- ¿Cuántos clientes atiendes al mes aproximadamente?
- ¿Qué herramientas o software usas hoy para gestionar tu negocio?
- ¿Cuál es el mayor problema que enfrentas día a día en la operación?

Estos datos me permitirán calcular el ROI real de la solución y dimensionar la arquitectura correctamente.`,

    1: `Datos registrados. Procesando análisis de carga operativa...

**Diagnóstico Fase 2 - Mecánica Financiera:**
- ¿Cuál es tu ticket promedio por servicio/venta?
- ¿Tienes empleados? Si es así, ¿cuántos?
- ¿Cuáles son tus costes fijos mensuales aproximados? (alquiler, nóminas, luz, etc.)

Esta información es crítica para asegurar que tu inversión en tecnología tenga retorno positivo en menos de 6 meses.`,

    2: `Análisis financiero en proceso. Detectando oportunidades de optimización...

**Diagnóstico Fase 3 - Objetivos Estratégicos:**
- ¿Qué quieres lograr en los próximos 3-6 meses con esta digitalización?
- ¿Te interesa solo automatizar procesos internos o también captar más clientes?
- ¿Tienes competidores directos que ya estén digitalizados?

Con esto podré definir si necesitas una solución **Táctica** (eficiencia interna) o **Estratégica** (crecimiento activo).`,

    3: `Objetivos mapeados. Iniciando calibración de arquitectura...

**Diagnóstico Fase 4 - Capacidad Técnica:**
- ¿Tienes alguien en tu equipo con conocimientos técnicos o todo debe ser 100% automatizado?
- ¿Necesitas acceso desde móvil o solo desde ordenador?
- ¿Tus clientes son principalmente locales o también online?

Esto determina el nivel de autonomía que debe tener el sistema.`,

    4: `Calibración completa. Generando blueprint arquitectónico...

He analizado tu perfil operativo, financiero y estratégico. 

**EVALUACIÓN DRAKO:**
- **Perfil**: {vertical} - Operación {scale}
- **Potencial de Escalabilidad**: {rating}/10
- **Complejidad Técnica Requerida**: {complexity}

Basándome en tu diagnóstico, te recomiendo una arquitectura **{tier}** con los siguientes módulos core:

**Módulos Recomendados:**
- {modules}

**Inversión Estimada:**
- Desarrollo Inicial: €{setup}
- Suscripción Mensual: €{monthly}/mes

**ROI Proyectado**: Retorno en {roi} meses

¿Quieres que profundicemos en algún aspecto específico o pasamos a la materialización?`
};

export function generateMockResponse(messages: ChatMessage[], currentPhase: number = 0): {
    reply: string;
    currentPhase: number;
    understanding: string;
    pricing: { monthly: number; yearly: number; rationale: string };
    entitlements: { packs: string[]; features: string[]; limits: Record<string, number> };
    detectedKnowledge: {
        identity?: { name?: string; niche?: string };
        finances?: Record<string, unknown>;
    };
} {
    const lastUserMessage = messages.filter(m => m.role === "user").pop()?.content || "";

    // HEURISTIC INTELLIGENCE LAYER (Anti-Stupidity Protocol)

    // 1. Complaint / Insult Detector
    const complaints = ["pena", "tonto", "inutil", "basura", "mal", "mierda", "estupido", "bot"];
    if (complaints.some(word => lastUserMessage.toLowerCase().includes(word))) {
        return {
            reply: "Entiendo que esta interacción pueda parecer limitada. 🤖\n\nActualmente estoy operando en **Modo Simulación (Offline)** para desarrollo. Mi capacidad de razonamiento real está desactivada para ahorrar recursos.\n\nPara completar el test de flujo, por favor responde con datos ficticios pero coherentes sobre tu negocio. ¿Podemos intentarlo de nuevo?",
            currentPhase: currentPhase, // Do not advance
            understanding: "Interacción fallida - Queja de usuario",
            pricing: { monthly: 0, yearly: 0, rationale: "" },
            entitlements: { packs: [], features: [], limits: {} },
            detectedKnowledge: {}
        };
    }

    // 2. Garbage / Short Input Detector
    if (lastUserMessage.length < 4 || /^(asd|test|hola|si|no\s*|ok|vale)$/i.test(lastUserMessage.trim())) {
        return {
            reply: "Para poder diseñarte una arquitectura válida, necesito un poco más de detalle. 🧐\n\nNo hace falta que escribas un libro, pero dame datos concretos sobre tu operación. Intenta responder a la pregunta anterior con al menos una frase completa.",
            currentPhase: currentPhase, // Do not advance
            understanding: "Input insuficiente",
            pricing: { monthly: 0, yearly: 0, rationale: "" },
            entitlements: { packs: [], features: [], limits: {} },
            detectedKnowledge: {}
        };
    }

    // Extract business name from first message if valid
    let businessName = "tu negocio";
    if (currentPhase === 0) {
        // const webMatch = lastUserMessage.match(/(?:web|sitio|página).*?(\w+\.(com|es|net|org))/i);
        const nameMatch = lastUserMessage.match(/(?:tengo|soy|trabajo en|dirijo)\s+(?:una?|un)\s+([a-záéíóúñ\s]+?)(?:\s+(?:en|que|para|con)|$)/i);
        if (nameMatch) {
            businessName = nameMatch[1].trim();
        } else if (lastUserMessage.length > 5 && lastUserMessage.length < 50) {
            // Fallback: assume the whole short message might be the company name if it's the first input
            businessName = lastUserMessage.trim();
        }
    }

    const nextPhase = Math.min(currentPhase + 1, 4);

    let template = PHASE_RESPONSES[currentPhase] || PHASE_RESPONSES[0];
    template = template.replace("{business}", businessName);

    // For final phase, fill in details
    if (currentPhase === 4) {
        template = template
            .replace("{vertical}", "Servicio Local")
            .replace("{scale}", "Media")
            .replace("{rating}", "7")
            .replace("{complexity}", "Media")
            .replace("{tier}", "Core")
            .replace("{modules}", "• Reservas Online\n• CRM Básico\n• Automatización de Recordatorios\n• Panel de Métricas")
            .replace("{setup}", "2,400")
            .replace("{monthly}", "149")
            .replace("{roi}", "4-6");
    }

    return {
        reply: template,
        currentPhase: nextPhase,
        understanding: `Negocio: ${businessName} - Diagnóstico Fase ${nextPhase}`,
        pricing: {
            monthly: nextPhase >= 4 ? 149 : 0,
            yearly: nextPhase >= 4 ? 1490 : 0,
            rationale: nextPhase >= 4
                ? "Calculado según volumen operativo y ROI proyectado"
                : "En fase de diagnóstico. Precio se calculará al finalizar."
        },
        entitlements: {
            packs: nextPhase >= 4 ? ["crm", "automation"] : [],
            features: [],
            limits: {}
        },
        detectedKnowledge: {
            identity: { name: businessName, niche: "service" },
            finances: {}
        }
    };
}
