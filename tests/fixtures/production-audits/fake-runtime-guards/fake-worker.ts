export default {
  async fetch() {
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  },
};
