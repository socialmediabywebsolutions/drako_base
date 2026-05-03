export type LocalModelRequest = {
  prompt: string;
  system?: string;
};

export type LocalModelResponse<T> = {
  data: T;
  raw: string;
};

export interface LocalModelClient {
  generateStructured<T>(req: LocalModelRequest, schemaFactory: () => T): Promise<LocalModelResponse<T>>;
}

// Deterministic stub model for demo: no external calls, no randomness critical for tests
export class DeterministicLocalModel implements LocalModelClient {
  async generateStructured<T>(req: LocalModelRequest, schemaFactory: () => T): Promise<LocalModelResponse<T>> {
    const base = schemaFactory();
    const now = new Date().toISOString();
    const decorated = {
      ...base,
      _meta: {
        generatedAt: now,
        promptPreview: req.prompt.slice(0, 120),
        system: req.system ?? null,
        engine: "local-deterministic-stub",
      },
    } as T & { _meta: unknown };

    return {
      data: decorated as unknown as T,
      raw: JSON.stringify(decorated),
    };
  }
}

export const defaultLocalModel = new DeterministicLocalModel();
