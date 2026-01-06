
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { requireTenantAccess } from "@/lib/auth/session";
import { env } from "@/lib/cf";
import { queryAll } from "@/lib/db";
import { listDemoClients, listDemoSaas, listDemoClientSaas } from "@/lib/admin/demo-data";
import { getRequestBaseUrl } from "@/lib/http/base-url";
import { respondDatabaseError } from "@/lib/http/errors";

function getPriceId(): string {
  if (process.env.DRAKO_BASE_STARTER_PRICE_ID) {
    return process.env.DRAKO_BASE_STARTER_PRICE_ID;
  }
  const cfEnv = env();
  if (cfEnv?.DRAKO_BASE_STARTER_PRICE_ID) {
    return cfEnv.DRAKO_BASE_STARTER_PRICE_ID;
  }
  return "price_1SfG7HGW3NNEeb7odEVaTDYy";
}

function hasDatabase(): boolean {
  return Boolean(env()?.DRACO_DB);
}

type BillingEntities = {
  clientId: string;
  saasId: string;
};

async function resolveBillingEntities(tenantId: string): Promise<BillingEntities> {
  if (hasDatabase()) {
    const link = await queryAll<{ client_id: string; saas_id: string }>(
      "SELECT client_id, saas_id FROM client_saas WHERE tenant_id = ? ORDER BY datetime(created_at) ASC LIMIT 1",
      tenantId,
    );
    if (link[0]) {
      return { clientId: link[0].client_id, saasId: link[0].saas_id };
    }
    const clientRow = await queryAll<{ id: string }>(
      "SELECT id FROM clients WHERE tenant_id = ? ORDER BY datetime(created_at) ASC LIMIT 1",
      tenantId,
    );
    const saasRow = await queryAll<{ id: string }>(
      "SELECT id FROM saas WHERE tenant_id = ? ORDER BY datetime(created_at) ASC LIMIT 1",
      tenantId,
    );
    if (clientRow[0] && saasRow[0]) {
      return { clientId: clientRow[0].id, saasId: saasRow[0].id };
    }
  } else {
    const link = listDemoClientSaas(tenantId)[0];
    if (link) {
      return { clientId: link.client_id, saasId: link.saas_id };
    }
    const clients = listDemoClients(tenantId);
    const saasList = listDemoSaas(tenantId);
    if (clients[0] && saasList[0]) {
      return { clientId: clients[0].id, saasId: saasList[0].id };
    }
  }
  throw new Error("No billing entities available for this tenant");
}

export async function POST(request: Request) {
  try {
    const stripe = await getStripe();
    if (!stripe) {
      return NextResponse.json(
        { ok: false, reason: "stripe_not_configured", hint: "Set STRIPE_SECRET_KEY and publishable keys." },
        { status: 503 }
      );
    }
    const { tenantId, session } = await requireTenantAccess(request);
    const { clientId, saasId } = await resolveBillingEntities(tenantId);
    const baseUrl = getRequestBaseUrl(request);

    const metadata = {
      tenantId,
      clientId,
      saasId,
      plan: "drako_base_starter",
      email: session.email,
    } satisfies Record<string, string>;

    const sessionCheckout = await stripe.checkout.sessions.create({
      mode: "subscription",
      client_reference_id: tenantId,
      customer_email: session.email,
      line_items: [
        {
          price: getPriceId(),
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata,
      },
      metadata,
      allow_promotion_codes: true,
      success_url: `${baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/billing/cancel`,
    });

    return NextResponse.json({ url: sessionCheckout.url });
  } catch (error) {
    const dbError = respondDatabaseError(error);
    if (dbError) return dbError;
    console.error("STRIPE_CHECKOUT_ERROR", error);
    return NextResponse.json({ error: (error as Error).message ?? "Unable to create checkout session" }, { status: 400 });
  }
}
