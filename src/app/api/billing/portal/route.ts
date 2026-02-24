export const dynamic = "force-dynamic";


import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getStripe } from "@/lib/billing/stripe-sync";
import { env } from "@/lib/cf"; // verify path

export const runtime = 'nodejs'; // REQUIRED for Stripe

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const saasId = searchParams.get('saasId');
    const session = await getServerSession(authOptions);

    if (!session?.user?.email || !saasId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const stripe = getStripe();

        // In a real implementation with valid D1 access in Node or an external stored customer ID,
        // we would fetch the customerId here.
        // For now, we will assume the CUSTOMER ID is passed or we redirect to the general portals login if unknown,
        // OR we use the email to find the customer in Stripe (search).

        const customers = await stripe.customers.list({ email: session.user.email, limit: 1 });
        const customer = customers.data[0];

        if (customer) {
            const sessionPortal = await stripe.billingPortal.sessions.create({
                customer: customer.id,
                return_url: `${process.env.NEXTAUTH_URL || 'https://drako.systems'}/client`,
            });
            return NextResponse.redirect(sessionPortal.url);
        } else {
            // Fallback: No Stripe customer found for this email.
            // Return a manual instruction page (mocked here as simple HTML for speed)
            return new NextResponse(`
                <html>
                    <head><title>Reactivación Manual</title></head>
                    <body style="font-family: sans-serif; padding: 40px; text-align: center;">
                        <h1>Reactivación Manual Requerida</h1>
                        <p>No encontramos una suscripción digital vinculada a tu email (${session.user.email}).</p>
                        <p>Por favor, contacta a soporte para reactivar tu instancia: <b>${saasId}</b></p>
                        <a href="/site/support" style="color: blue;">Contactar Soporte</a>
                    </body>
                </html>
             `, { headers: { 'Content-Type': 'text/html' } });
        }

    } catch (e: any) {
        console.error("Billing Portal Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
