import type { BlueprintResponse } from "@/lib/campamento-base/ai-blueprint-v2/prompts";

export type InterviewPhase = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface InterviewState {
    sessionId: string;
    currentPhase: InterviewPhase;
    context: InterviewContext;
    history: { role: "user" | "assistant"; content: string }[];
}

export interface InterviewContext {
    identity: {
        companyName?: string;
        vertical?: string; // SAAS, REAL_ESTATE, etc.
        country?: string;
        employees?: number;
    };
    digital: {
        website?: string;
        socials?: string[];
    };
    competitors: {
        known?: string[];
        radio?: string;
    };
    finance: {
        monthlyBurn?: number;
        revenueEst?: number;
        currency?: string;
    };
    vision: {
        goals?: string[];
        painPoints?: string[];
    };
    tech: {
        agents?: string[];
        integrations?: string[];
    };
    quote?: {
        monthly?: number;
        currency?: string;
    };
}

export class InterviewOrchestrator {

    /**
     * Determines the next phase based on current state, AI suggestion, and extracted knowledge.
     * Implements "Hard Validation" logic to prevent skips.
     */
    static calculateNextPhase(
        currentPhase: InterviewPhase,
        extracted: BlueprintResponse["detectedKnowledge"],
        aiSuggestedPhase?: number
    ): InterviewPhase {
        // Default to staying in current phase unless AI wants to move
        const requestedPhase = typeof aiSuggestedPhase === 'number' ? aiSuggestedPhase : currentPhase;

        // Rule 1: Never allow skipping more than 1 phase at a time (e.g., 1 -> 5 is blocked)
        const targetPhase = requestedPhase > currentPhase + 1
            ? (currentPhase + 1) as InterviewPhase
            : requestedPhase as InterviewPhase;

        // Rule 2: If we are not moving forward, just return current
        if (targetPhase <= currentPhase) return targetPhase;

        // Rule 3: Hard Validation Gates for transitions

        // Gate 0 -> 1: Warmup complete
        if (currentPhase === 0 && targetPhase === 1) return 1;

        // Gate 1 -> 2: Must have Identity (Company Name + Sector)
        if (currentPhase === 1 && targetPhase === 2) {
            const identity = extracted?.identity as Record<string, unknown> | undefined;
            const hasIdentity = identity &&
                identity.name &&
                (identity.sector || identity.niche);

            if (hasIdentity) return 2;
            return 1; // Blocked: Stay in 1
        }

        // Gate 2 -> 3: Analysis complete
        if (currentPhase === 2 && targetPhase === 3) {
            // Check if we at least have a web score or insights or explicit skip
            const hasAnalysis = extracted?.digitalAudit &&
                (extracted.digitalAudit.webScore !== undefined || extracted.digitalAudit.insights?.length);

            if (hasAnalysis) return 3;
            return 2; // Stay in 2
        }

        // Gate 3 -> 4: Competitor check
        if (currentPhase === 3 && targetPhase === 4) return 4;

        // Gate 4 -> 5: Financial check (Revenue / Costs)
        if (currentPhase === 4 && targetPhase === 5) {
            // Relaxed for now: check if there is ANY finance data
            if (extracted?.finances && Object.keys(extracted.finances).length > 0) return 5;
            return 4;
        }

        // Higher phases (5-9) represent construction/quoting.
        // We only allow reaching phase 5+ if the business logic is fully captured.
        if (targetPhase >= 5 && currentPhase < 4) return currentPhase;

        return targetPhase;
    }

    /**
     * Merges new knowledge into the existing context.
     */
    static mergeContext(current: InterviewContext, update: BlueprintResponse["detectedKnowledge"]): InterviewContext {
        // Deep merge logic would go here. For now, shallow merge top-level keys.
        return {
            ...current,
            identity: { ...current.identity, ...update?.identity },
            finance: { ...current.finance, ...update?.finances },
            // Digital audit often returns a score object, mapping it broadly
            digital: { ...current.digital },
            // etc...
        };
    }

    /**
     * Infers the specialized vertical from the raw conversation/context
     */
    static inferVerticalFromContext(context: InterviewContext): string {
        // Default
        return context.identity.vertical || "GENERIC";
    }
}
