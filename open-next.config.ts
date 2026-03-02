const config = {
    default: {
        override: {
            wrapper: "cloudflare",
            converter: "edge",
            proxyExternalRequest: "fetch",
            incrementalCache: "s3-lite",
            tagCache: "dynamodb-lite",
            queue: "sqs-lite",
        },
    },
    edgeExternals: ["node:crypto"],
    middleware: {
        external: true,
        override: {
            wrapper: "cloudflare",
            converter: "edge",
            proxyExternalRequest: "fetch",
            incrementalCache: "s3-lite",
            tagCache: "dynamodb-lite",
            queue: "sqs-lite",
        },
    },
};

export default config;
