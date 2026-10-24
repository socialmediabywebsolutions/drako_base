import { vi } from "vitest";

type MockFn = ReturnType<typeof vi.fn>;

export interface MockD1PreparedStatement {
  bind: MockFn;
  first: MockFn;
  run: MockFn;
  all: MockFn;
}

export interface MockD1Database {
  prepare: MockFn;
  batch: MockFn;
}

export function createMockD1(): MockD1Database {
  const runMock = vi.fn().mockResolvedValue({ success: true });
  const allMock = vi.fn().mockResolvedValue({ results: [] });
  const firstMock = vi.fn().mockResolvedValue(null);

  const bindMock = vi.fn().mockReturnValue({
    run: runMock,
    all: allMock,
    first: firstMock,
  });

  const prepareMock = vi.fn().mockReturnValue({
    bind: bindMock,
  });

  const batchMock = vi.fn().mockResolvedValue([]);

  return {
    prepare: prepareMock,
    batch: batchMock,
  } as unknown as MockD1Database;
}

export function getMockD1Statement(
  db: MockD1Database
): MockD1PreparedStatement {
  const prepared = db.prepare("SELECT 1") as MockD1PreparedStatement;
  return prepared;
}

export function setupMockD1Query(
  db: MockD1Database,
  query: string,
  results: unknown[]
) {
  const prepared = db.prepare(query) as MockD1PreparedStatement;
  const bound = prepared.bind() as MockD1PreparedStatement;

  (bound.all as MockFn).mockResolvedValue({ results });
  if (results.length > 0) {
    (bound.first as MockFn).mockResolvedValue(results[0]);
  }

  return { prepared, bound };
}

export function setupMockD1QueryOnce(
  db: MockD1Database,
  query: string,
  results: unknown[]
) {
  const prepared = db.prepare(query) as MockD1PreparedStatement;
  const bound = prepared.bind() as MockD1PreparedStatement;

  (bound.all as MockFn).mockResolvedValueOnce({ results });
  if (results.length > 0) {
    (bound.first as MockFn).mockResolvedValueOnce(results[0]);
  }

  return { prepared, bound };
}
