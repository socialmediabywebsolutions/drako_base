const config = {
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
  // middleware.external:true en modo Workers hace que el worker principal intente
  // invocar la middleware vía un service binding externo que no existe en wrangler.toml,
  // lo que provoca 500 en TODAS las rutas. La middleware de SocialCors es ligera
  // (solo headers de correlación + rewrites), así que se bundlea inline en el mismo worker.
  middleware: {
    external: false,
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
