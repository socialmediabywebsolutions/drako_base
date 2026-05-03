import type { ModelProvider } from "./ModelProvider";

// Placeholder provider prepared for Cloudflare Workers AI or other HTTP-based models.
// No real network calls are performed in demo mode.
export class CloudflareProvider implements ModelProvider {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async generate(input: any): Promise<any> {
    // In the future this will call a Cloudflare Workers AI endpoint using fetch.
    // For now we simply echo back the input to keep the system deterministic and offline.
    return {
      ...input,
      _meta: {
        provider: "cloudflare-placeholder",
        note: "No external call performed; replace with Workers AI invocation in production.",
      },
    };
  }
}
