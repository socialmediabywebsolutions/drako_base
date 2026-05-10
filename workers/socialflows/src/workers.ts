const responseHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
} as const;

export default {
  async fetch() {
    return new Response(
      JSON.stringify(
        {
          ok: false,
          code: "SOCIALFLOW_RUNTIME_MISWIRED",
          message: "saas-socialflows-prod must run ../../.open-next/worker.js to serve the real SocialFlow runtime.",
        },
        null,
        2,
      ),
      {
        status: 500,
        headers: responseHeaders,
      },
    );
  },
};
