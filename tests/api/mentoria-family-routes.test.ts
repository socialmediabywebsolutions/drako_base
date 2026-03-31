import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentMentoriaSession: vi.fn(),
  createMentoriaFamilyServiceInstance: vi.fn(),
  getMentoriaDb: vi.fn(),
  MentoriaFamilyRepository: vi.fn(),
}));

vi.mock("@/lib/mentoria/auth/request", () => ({
  requireCurrentMentoriaSession: mocks.requireCurrentMentoriaSession,
}));

vi.mock("@/lib/mentoria/get-mentoria-db", () => ({
  getMentoriaDb: mocks.getMentoriaDb,
}));

vi.mock("@/lib/mentoria/family-repository", () => ({
  MentoriaFamilyRepository: class MentoriaFamilyRepository {
    constructor(_db?: any) {}
  },
}));

vi.mock("@/lib/mentoria/family-service", () => ({
  MentoriaFamilyService: class MentoriaFamilyService {
    constructor(_repository?: any) {
      return mocks.createMentoriaFamilyServiceInstance();
    }
  },
}));

import { GET as getFamily } from "@/app/api/mentoria/family/route";
import { POST as createStudent } from "@/app/api/mentoria/family/create-student/route";
import { POST as inviteGuardian } from "@/app/api/mentoria/family/invite-guardian/route";

describe("mentoria family routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentMentoriaSession.mockResolvedValue({
      userId: "user_family",
      email: "guardian@example.com",
      tenantId: "family_tenant_1",
      role: "user",
    });
    mocks.getMentoriaDb.mockReturnValue({});
    mocks.MentoriaFamilyRepository.mockReturnValue({});
    mocks.createMentoriaFamilyServiceInstance.mockReturnValue({
      getFamilyForSession: vi.fn().mockResolvedValue({
        family: { id: "family_tenant_1", createdAt: "2026-03-28T00:00:00.000Z" },
        guardians: [
          {
            id: "guardian_1",
            email: "guardian@example.com",
            name: "Guardian One",
            familyId: "family_tenant_1",
            role: "tutor",
            createdAt: "2026-03-28T00:00:00.000Z",
          },
        ],
        students: [
          {
            id: "student_1",
            name: "Alex",
            age: 13,
            level: "2 eso",
            familyId: "family_tenant_1",
            createdAt: "2026-03-28T00:00:00.000Z",
          },
        ],
      }),
      createStudent: vi.fn().mockResolvedValue({
        student: {
          id: "student_2",
          name: "Mia",
          age: 11,
          level: "6 primaria",
          familyId: "family_tenant_1",
          createdAt: "2026-03-28T00:00:00.000Z",
        },
        family: { id: "family_tenant_1", createdAt: "2026-03-28T00:00:00.000Z" },
        guardians: [],
        students: [],
      }),
      inviteGuardian: vi.fn().mockResolvedValue({
        guardian: {
          id: "guardian_2",
          email: "second@example.com",
          name: "Second Guardian",
          familyId: "family_tenant_1",
          role: "mother",
          createdAt: "2026-03-28T00:00:00.000Z",
        },
        family: { id: "family_tenant_1", createdAt: "2026-03-28T00:00:00.000Z" },
        guardians: [],
        students: [],
      }),
    });
  });

  it("returns the authenticated family bundle", async () => {
    const response = await getFamily(new Request("https://mentoria.drako.systems/api/mentoria/family"));
    expect(response.status).toBe(200);
    const payload = await response.json() as { ok: boolean; family: { id: string }; guardians: unknown[]; students: unknown[] };
    expect(payload.ok).toBe(true);
    expect(payload.family.id).toBe("family_tenant_1");
    expect(payload.guardians).toHaveLength(1);
    expect(payload.students).toHaveLength(1);
  });

  it("creates a student inside the authenticated family", async () => {
    const response = await createStudent(
      new Request("https://mentoria.drako.systems/api/mentoria/family/create-student", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Mia", age: 11, level: "6 primaria" }),
      }),
    );
    expect(response.status).toBe(201);
    const payload = await response.json() as { ok: boolean; student: { id: string; name: string } };
    expect(payload.ok).toBe(true);
    expect(payload.student).toEqual(expect.objectContaining({ id: "student_2", name: "Mia" }));
  });

  it("invites a second guardian in the same family", async () => {
    const response = await inviteGuardian(
      new Request("https://mentoria.drako.systems/api/mentoria/family/invite-guardian", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "second@example.com", name: "Second Guardian", role: "mother" }),
      }),
    );
    expect(response.status).toBe(201);
    const payload = await response.json() as { ok: boolean; guardian: { email: string; role: string } };
    expect(payload.ok).toBe(true);
    expect(payload.guardian).toEqual(expect.objectContaining({ email: "second@example.com", role: "mother" }));
  });

  it("blocks access when the session has no family membership", async () => {
    mocks.createMentoriaFamilyServiceInstance.mockReturnValue({
      getFamilyForSession: vi.fn().mockRejectedValue(new Error("FAMILY_ACCESS_DENIED")),
    });

    const response = await getFamily(new Request("https://mentoria.drako.systems/api/mentoria/family"));
    expect(response.status).toBe(403);
  });
});
