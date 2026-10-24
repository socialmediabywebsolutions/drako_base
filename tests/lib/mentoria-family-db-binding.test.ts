import { beforeEach, describe, expect, it, vi } from "vitest";

type StatementResult<T> = {
  bind: (...args: unknown[]) => {
    first: () => Promise<T | null>;
    all: () => Promise<{ results: T[] }>;
    run: () => Promise<unknown>;
  };
};

function createFakeDb<T>(result: T | null = null) {
  const first = vi.fn().mockResolvedValue(result);
  const all = vi.fn().mockResolvedValue({ results: [] });
  const run = vi.fn().mockResolvedValue({});
  const bind = vi.fn(() => ({ first, all, run }));
  const prepare = vi.fn(() => ({ bind })) as unknown as StatementResult<T>["bind"];

  return {
    db: { prepare } as unknown as D1Database,
    prepare,
    bind,
    first,
    all,
    run,
  };
}

const mocks = vi.hoisted(() => ({
  env: vi.fn(),
}));

vi.mock("@/lib/cf", () => ({
  env: mocks.env,
}));

describe("Mentoria family repository D1 topology", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the dedicated Mentoria DB binding instead of DRACO_DB", async () => {
    const dracoDb = createFakeDb();
    const mentoriaDb = createFakeDb();
    mocks.env.mockReturnValue({
      DRACO_DB: dracoDb.db,
      MENTORIA_DB: mentoriaDb.db,
    });

    const { MentoriaFamilyRepository } = await import("@/lib/mentoria/family-repository");
    
    const fakeDb = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          run: vi.fn(),
          get: vi.fn(),
          all: vi.fn(() => ({ results: [] })),
        })),
      })),
    };

    const repo = new MentoriaFamilyRepository(fakeDb as unknown as D1Database);
    await repo.getFamilyById("family_1");

    expect(fakeDb.prepare).toHaveBeenCalledWith("SELECT id, created_at FROM families WHERE id = ? LIMIT 1");
  });
});
