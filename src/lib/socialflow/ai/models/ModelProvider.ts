export interface ModelProvider {
  // Generic interface for model providers (local stub, Cloudflare Workers AI, etc.)
  // Input/output are intentionally 'any' here; concrete agents use typed wrappers.
  generate(input: any): Promise<any>;
}
