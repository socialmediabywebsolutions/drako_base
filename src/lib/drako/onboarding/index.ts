import { createUserContext, type UserContext } from "@/lib/drako/memory";

export type OnboardingInput<TAttributes = Record<string, unknown>, TSelection = Record<string, unknown>> = {
  fullName: string;
  age?: number;
  goals?: string[];
  attributes: TAttributes;
  selections: TSelection[];
  metadata?: Record<string, unknown>;
};

export function buildOnboardingUserContext<TAttributes, TSelection>(input: {
  actor: Pick<UserContext, "tenantId" | "userId" | "email" | "role">;
  onboarding: OnboardingInput<TAttributes, TSelection>;
  tags?: string[];
  traits?: Record<string, string | number | boolean | string[]>;
  preferences?: Record<string, string | number | boolean | string[]>;
}): UserContext {
  return createUserContext({
    tenantId: input.actor.tenantId,
    userId: input.actor.userId,
    email: input.actor.email,
    role: input.actor.role,
    lifecycleStage: "new",
    goals: input.onboarding.goals,
    tags: input.tags,
    traits: {
      fullName: input.onboarding.fullName,
      age: input.onboarding.age ?? 0,
      selectionCount: input.onboarding.selections.length,
      ...(input.traits ?? {}),
    },
    preferences: input.preferences,
  });
}
