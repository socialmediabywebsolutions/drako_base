import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  login: vi.fn(),
  deleteUserWithCredential: vi.fn(),
  setAuthsSessionCookie: vi.fn(),
  clearAuthsSessionCookie: vi.fn(),
  recordCampamentoEvent: vi.fn(),
  requireCurrentMentoriaSession: vi.fn(),
  createStripeCheckoutSession: vi.fn(),
  queryOne: vi.fn(),
  getCanonicalSubscriptionState: vi.fn(),
  getMentoriaStripePriceId: vi.fn(),
  getRequestBaseUrl: vi.fn(),
  createStripeCustomer: vi.fn(),
  createMentoriaServiceInstance: vi.fn(),
  createMentoriaFamilyServiceInstance: vi.fn(),
}));

vi.mock("@/lib/auths/mentorias-auths", () => ({
  mentoriasAuths: {
    register: mocks.register,
    login: mocks.login,
  },
}));

vi.mock("@/lib/auths/http", () => ({
  jsonError: (code: string, message: string, status = 400) =>
    new Response(JSON.stringify({ ok: false, code, message }), {
      status,
      headers: { "content-type": "application/json" },
    }),
  setAuthsSessionCookie: mocks.setAuthsSessionCookie,
  clearAuthsSessionCookie: mocks.clearAuthsSessionCookie,
}));

vi.mock("@/lib/auths/repositories", () => ({
  deleteUserWithCredential: mocks.deleteUserWithCredential,
}));

vi.mock("@/lib/auths/flags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auths/flags")>();
  return {
    ...actual,
    isAuthsIsolationEnabled: () => true,
    isTelemetriesHoldingEnabled: () => false,
  };
});

vi.mock("@/lib/auths/ssot", () => ({
  enforceAuthBoundary: () => ({ ok: true }),
  resolveSaasSlugForAuthContext: () => "mentorias",
}));

vi.mock("@/lib/empire/events", () => ({
  recordCampamentoEvent: mocks.recordCampamentoEvent,
}));

vi.mock("@/lib/mentoria/auth/request", () => ({
  requireCurrentMentoriaSession: mocks.requireCurrentMentoriaSession,
}));

vi.mock("@/lib/mentoria/service", () => ({
  MentoriaService: class MentoriaService {
    constructor() {
      return mocks.createMentoriaServiceInstance();
    }
  },
}));

vi.mock("@/lib/mentoria/family-service", () => ({
  MentoriaFamilyService: class MentoriaFamilyService {
    constructor() {
      return mocks.createMentoriaFamilyServiceInstance();
    }
  },
}));

vi.mock("@/lib/stripe/rest", () => ({
  createStripeCheckoutSession: mocks.createStripeCheckoutSession,
  createStripeCustomer: mocks.createStripeCustomer,
}));

vi.mock("@/lib/db", () => ({
  queryOne: mocks.queryOne,
}));

vi.mock("@/lib/billing/subscriptions", () => ({
  getCanonicalSubscriptionState: mocks.getCanonicalSubscriptionState,
}));

vi.mock("@/lib/mentoria/plans", () => ({
  getMentoriaStripePriceId: mocks.getMentoriaStripePriceId,
}));

vi.mock("@/lib/http/base-url", () => ({
  getRequestBaseUrl: mocks.getRequestBaseUrl,
}));

import { POST as registrationPost } from "@/app/api/mentorias/auths/registrations/route";
import { POST as onboardingPost } from "@/app/api/mentoria/onboarding/route";
import { POST as sessionPost } from "@/app/api/mentoria/session/route";
import { POST as checkoutPost } from "@/app/api/mentoria/billing/checkout/route";

describe("mentoria product flow surface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.register.mockResolvedValue({ ok: true, userId: "user_mentoria", role: "user", tenantId: "tenant_mentoria" });
    mocks.login.mockResolvedValue({ ok: true, token: "tok_mentoria", role: "user", tenantId: "tenant_mentoria", userId: "user_mentoria", expiresAt: new Date().toISOString() });
    mocks.requireCurrentMentoriaSession.mockResolvedValue({
      userId: "user_mentoria",
      email: "family@example.com",
      tenantId: "tenant_mentoria",
      role: "user",
    });
    mocks.createMentoriaServiceInstance.mockReturnValue({
      submitOnboarding: vi.fn().mockResolvedValue({
        student: { id: "student_1" },
        plan: { id: "plan_1" },
        progress: [],
        activation: {
          id: "evt_1",
          type: "onboarding_completed",
          channel: "onboarding",
          reply: "Primera ayuda guiada",
          subjectSlug: "matematicas",
          subjectName: "Matematicas",
          dailyPlan: { id: "daily_1", tasks: [], planDate: "2026-03-28", recommendedDuration: 30, completedTaskIds: [], priority: "medium", adaptationReason: "Inicio", generatedAt: "2026-03-28T00:00:00.000Z", createdAt: "2026-03-28T00:00:00.000Z", updatedAt: "2026-03-28T00:00:00.000Z", completionRate: 0 },
        },
      }),
      startGuidedSession: vi.fn().mockResolvedValue({
        session: { id: "session_1" },
        subject: { id: "subject_1", slug: "matematicas", name: "Matematicas" },
        adaptation: { emotionalState: "steady" },
        tutorMessage: "Vamos paso a paso",
        reply: "Vamos paso a paso",
        boardUpdate: {
          studentId: "student_1",
          subjectSlug: "matematicas",
          subjectName: "Matematicas",
          studentName: "Alex",
          schoolYear: "2 ESO",
          topic: "Fracciones",
          intent: "explanation",
          mode: "explanation",
          explanation: ["Primero miramos que representa cada fraccion."],
          steps: ["Mira el denominador", "Mira el numerador"],
          example: "1/2 significa una de dos partes iguales.",
          nextAction: "Dime que parte te cuesta mas.",
          updatedAt: "2026-05-02T00:00:00.000Z",
        },
        learningStateUpdated: null,
        insights: [],
      }),
    });
    mocks.createMentoriaFamilyServiceInstance.mockReturnValue({
      resolveRegistrationFamily: vi.fn().mockResolvedValue({
        familyId: "tenant_mentoria",
        guardianRole: "tutor",
      }),
      finalizeRegistration: vi.fn().mockResolvedValue({
        id: "guardian_1",
        familyId: "tenant_mentoria",
        email: "family@example.com",
        role: "tutor",
      }),
      getFamilyForSession: vi.fn().mockResolvedValue({
        family: { id: "tenant_mentoria", createdAt: "2026-03-28T00:00:00.000Z" },
        guardians: [{ id: "guardian_1", familyId: "tenant_mentoria", email: "family@example.com", role: "tutor", createdAt: "2026-03-28T00:00:00.000Z" }],
        students: [],
      }),
    });
    mocks.getMentoriaStripePriceId.mockReturnValue("price_mentoria_pro");
    mocks.getRequestBaseUrl.mockReturnValue("https://mentoria.drako.systems");
    mocks.queryOne.mockResolvedValue({ id: "saas_mentoria_active" });
    mocks.getCanonicalSubscriptionState.mockResolvedValue({
      tenantId: "tenant_mentoria",
      saasSlug: "mentoria",
      stripeCustomerId: "cus_existing",
      stripeSubscriptionId: "sub_mentoria",
      stripePriceId: "price_mentoria_pro",
      planCode: "pro",
      status: "active",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      updatedAt: new Date().toISOString(),
    });
    mocks.createStripeCustomer.mockResolvedValue({ id: "cus_created" });
    mocks.createStripeCheckoutSession.mockResolvedValue({ id: "cs_flow", url: "https://stripe.test/checkout" });
  });

  it("supports registration, onboarding, first session and checkout for a mentorias product user", async () => {
    const registrationResponse = await registrationPost(
      new Request("https://mentoria.drako.systems/api/mentorias/auths/registrations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "family@example.com", password: "password123", name: "Family" }),
      }),
    );
    expect(registrationResponse.status).toBe(201);

    const onboardingResponse = await onboardingPost(
      new Request("https://mentoria.drako.systems/api/mentoria/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          primaryGuardian: {
            fullName: "Family",
            relation: "tutor",
          },
          student: {
            fullName: "Alex",
            schoolYear: "2 eso",
          },
          subjects: [{ subjectSlug: "matematicas", initialLevel: "me_cuesta_mucho" }],
          goal: "improve_understanding",
          confidenceLevel: "medium",
        }),
      }),
    );
    expect(onboardingResponse.status).toBe(200);

    const sessionResponse = await sessionPost(
      new Request("https://mentoria.drako.systems/api/mentoria/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subjectSlug: "matematicas", topic: "Fracciones", message: "No lo entiendo" }),
      }),
    );
    expect(sessionResponse.status).toBe(200);

    const checkoutResponse = await checkoutPost(
      new Request("https://mentoria.drako.systems/api/mentoria/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: "pro" }),
      }),
    );
    expect(checkoutResponse.status).toBe(200);
  });
});
