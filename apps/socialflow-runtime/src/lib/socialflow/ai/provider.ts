export type RuntimeAiStructuredRequest<T> = {
  prompt: string;
  system?: string;
  seed: () => T;
};

export type RuntimeAiStructuredResponse<T> = {
  data: T;
  raw: string;
  provider: "runtime-deterministic";
};

export interface RuntimeAiProvider {
  generateStructured<T>(request: RuntimeAiStructuredRequest<T>): Promise<RuntimeAiStructuredResponse<T>>;
}

class RuntimeDeterministicAiProvider implements RuntimeAiProvider {
  async generateStructured<T>(request: RuntimeAiStructuredRequest<T>): Promise<RuntimeAiStructuredResponse<T>> {
    const base = request.seed();
    return {
      data: base,
      raw: JSON.stringify({
        provider: "runtime-deterministic",
        promptPreview: request.prompt.slice(0, 120),
        system: request.system ?? null,
      }),
      provider: "runtime-deterministic",
    };
  }
}

export function createRuntimeAiProvider(): RuntimeAiProvider {
  return new RuntimeDeterministicAiProvider();
}
