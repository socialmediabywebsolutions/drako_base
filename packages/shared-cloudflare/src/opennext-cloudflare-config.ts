type CloudflareOpenNextOverride = {
  wrapper: "cloudflare-node" | "cloudflare-edge";
  converter: "edge";
  proxyExternalRequest: "fetch";
  incrementalCache: "dummy";
  tagCache: "dummy";
  queue: "direct";
};

export type CloudflareOpenNextConfig = {
  default: {
    override: CloudflareOpenNextOverride;
  };
  edgeExternals: string[];
  middleware: {
    external: true;
    override: CloudflareOpenNextOverride;
  };
};

export function createCloudflareOpenNextConfig(): CloudflareOpenNextConfig {
  return {
    default: {
      override: {
        wrapper: "cloudflare-node",
        converter: "edge",
        proxyExternalRequest: "fetch",
        incrementalCache: "dummy",
        tagCache: "dummy",
        queue: "direct",
      },
    },
    edgeExternals: ["node:crypto"],
    middleware: {
      external: true,
      override: {
        wrapper: "cloudflare-edge",
        converter: "edge",
        proxyExternalRequest: "fetch",
        incrementalCache: "dummy",
        tagCache: "dummy",
        queue: "direct",
      },
    },
  };
}
