import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveDb = vi.fn();
vi.mock("@/lib/socialflow/platform/auth/repository", () => ({ resolveSocialFlowAuthsDb: (...args: unknown[]) => resolveDb(...args) }));

import { recordTermsAcceptance } from "./terms-acceptance";

// D1 falso mínimo: guarda las sentencias ejecutadas y simula la presencia o no de la columna.
function fakeDb(options: { hasColumn: boolean }) {
  const state = { hasColumn: options.hasColumn, statements: [] as string[], updates: [] as unknown[][] };
  const db = {
    prepare(sql: string) {
      state.statements.push(sql);
      let bound: unknown[] = [];
      const stmt = {
        bind(...values: unknown[]) {
          bound = values;
          return stmt;
        },
        async run() {
          if (/^ALTER TABLE/i.test(sql)) {
            state.hasColumn = true;
            return { success: true };
          }
          if (/^UPDATE/i.test(sql)) {
            if (!state.hasColumn) throw new Error("no such column: accepted_terms_at at offset 30");
            state.updates.push(bound);
          }
          return { success: true };
        },
        async all() {
          return { results: state.hasColumn ? [{ name: "id" }, { name: "accepted_terms_at" }] : [{ name: "id" }] };
        },
      };
      return stmt;
    },
  };
  return { db, state };
}

describe("recordTermsAcceptance", () => {
  beforeEach(() => resolveDb.mockReset());

  it("guarda la fecha sin tocar el esquema cuando la columna ya existe", async () => {
    const { db, state } = fakeDb({ hasColumn: true });
    resolveDb.mockReturnValue(db);
    await expect(recordTermsAcceptance("u1", "2026-09-20T10:00:00.000Z")).resolves.toBe(true);
    expect(state.updates).toEqual([["2026-09-20T10:00:00.000Z", "u1"]]);
    expect(state.statements.some((s) => /ALTER TABLE/i.test(s))).toBe(false);
  });

  it("crea la columna solo si falta y reintenta el guardado", async () => {
    const { db, state } = fakeDb({ hasColumn: false });
    resolveDb.mockReturnValue(db);
    await expect(recordTermsAcceptance("u2", "2026-09-20T10:00:00.000Z")).resolves.toBe(true);
    expect(state.statements.filter((s) => /^ALTER TABLE/i.test(s))).toHaveLength(1);
    expect(state.statements.some((s) => /IF NOT EXISTS/i.test(s))).toBe(false);
    expect(state.updates).toEqual([["2026-09-20T10:00:00.000Z", "u2"]]);
  });

  it("no lanza y devuelve false si no hay base de datos", async () => {
    resolveDb.mockReturnValue(null);
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(recordTermsAcceptance("u3")).resolves.toBe(false);
  });
});
