export interface Env {
  STRIPE_WEBHOOK_FORWARD_URL?: string;
}

const DEFAULT_FORWARD_URL = "https://drako.systems/api/stripe/webhook";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return new Response(JSON.stringify({ error: "Missing Stripe-Signature" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const forwardUrl = (env.STRIPE_WEBHOOK_FORWARD_URL || DEFAULT_FORWARD_URL).trim();
    const rawBody = await request.text();

    const upstream = await fetch(forwardUrl, {
      method: "POST",
      headers: {
        "content-type": request.headers.get("content-type") || "application/json",
        "stripe-signature": signature,
        "x-drako-forwarded-by": "workers/stripe-webhook",
      },
      body: rawBody,
    });

    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") || "application/json",
        "x-drako-webhook-legacy": "forwarded",
      },
    });
  },
};
