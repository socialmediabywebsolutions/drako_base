import type { ModelProvider } from "./ModelProvider";
import { defaultLocalModel } from "./localModel";

export class LocalStubProvider implements ModelProvider {
  async generate(input: any): Promise<any> {
    const prompt = typeof input?.prompt === "string" ? input.prompt : JSON.stringify(input ?? {});
    const system = typeof input?.system === "string" ? input.system : undefined;
    const { data } = await defaultLocalModel.generateStructured<any>({ prompt, system }, () => input?.base ?? {});
    return data;
  }
}
