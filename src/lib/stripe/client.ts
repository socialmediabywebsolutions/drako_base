import Stripe from "stripe";
import { env } from "@/lib/cf";

function resolveSecretKey(): string | null {
  if (typeof process !== "undefined" && process.env.STRIPE_SECRET_KEY) {
    return process.env.STRIPE_SECRET_KEY;
  }
  const cfEnv = env();
  if (cfEnv?.STRIPE_SECRET_KEY) {
    return cfEnv.STRIPE_SECRET_KEY;
  }
  return null;
}

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    const secretKey = resolveSecretKey();
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    stripeClient = new Stripe(secretKey, {});
  }
  return stripeClient;
}

export type StripeClient = ReturnType<typeof getStripe>;
