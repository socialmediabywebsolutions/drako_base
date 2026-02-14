import type { OpenNextConfig } from 'open-next/types/open-next';

const config: OpenNextConfig = {
    default: {
        override: {
            wrapper: 'cloudflare',
            converter: 'edge',
        },
    },

    middleware: {
        override: {
            wrapper: 'cloudflare',
            converter: 'edge',
            proxyExternalRequest: true,
        },
    },

    buildCommand: 'npm run build',
};

export default config;
