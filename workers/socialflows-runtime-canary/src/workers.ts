export default {
  async fetch() {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "SOCIALFLOW_RUNTIME_CANARY_INACTIVE",
        message: "This worker scaffold is intentionally inactive until a later cutover phase.",
      }),
      {
        status: 503,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      },
    );
  },
};
