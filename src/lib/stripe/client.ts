import type Stripe from "stripe";
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

async function loadStripeCtor(): Promise<typeof import("stripe")["default"] | null> {
  try {
    const mod = await import("stripe");
    return mod.default ?? (mod as unknown as typeof import("stripe")["default"]);
  } catch (error) {
    console.error("STRIPE_SDK_LOAD_FAILED", error);
    return null;
  }
}

export async function getStripe(): Promise<Stripe | null> {
  if (stripeClient) {
    return stripeClient;
  }
  const secretKey = resolveSecretKey();
  if (!secretKey) {
    return null;
  }
  const StripeCtor = await loadStripeCtor();
  if (!StripeCtor) {
    return null;
  }
  stripeClient = new StripeCtor(secretKey, {});
  return stripeClient;
}

export type StripeClient = NonNullable<Awaited<ReturnType<typeof getStripe>>>;
