const config = {
  // Evita el bucle infinito: el workflow llama a opennextjs-cloudflare build
  // directamente, que por defecto ejecuta `pnpm run build` (= el script build del
  // package.json, que a su vez contiene opennextjs-cloudflare build → recursión).
  // Con buildCommand explícito, OpenNext llama solo a `next build` y corta el ciclo.
  buildCommand: "next build",
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

export default config;
