import type { AgentVertical } from "../agents/types";

export type PackTier = "STARTER" | "PRO" | "FULL";

export interface PricingInput {
    tier: PackTier;
    vertical: AgentVertical;
    addons: string[];
    users: number; // Seats
    estimatedTransactions: number; // Monthly
}

export interface PricingQuote {
    monthlyBase: number;
    addonsTotal: number;
    estimatedUsage: number;
    totalMonthly: number;
    currency: string;
    confidence: number; // 0-1
    breakdown: {
        base: number;
        seats: number;
        addons: Record<string, number>;
        usage: number;
    };
}

const TIER_BASE_PRICES: Record<PackTier, number> = {
    STARTER: 4900, // Cents
    PRO: 19900,
    FULL: 49900
};

const ADDON_PRICES: Record<string, number> = {
    "extra_agent": 2900,
    "dedicated_ip": 1900,
    "compliance_pack": 4900,
    "extra_storage": 1500
};

const SEAT_PRICE = 1500; // 15€ per extra user

export function calculatePricing(input: PricingInput): PricingQuote {
    // 1. Base Price
    let monthlyBase = TIER_BASE_PRICES[input.tier];

    // 2. Seats (First one free/included depending on pack, simplified here to per-seat from 0 for now)
    // Actually, let's say Starter includes 1, Pro 3, Full 10.
    const includedSeats = input.tier === "STARTER" ? 1 : input.tier === "PRO" ? 3 : 10;
    const additionalSeats = Math.max(0, input.users - includedSeats);
    const seatsCost = additionalSeats * SEAT_PRICE;

    monthlyBase += seatsCost;

    // 3. Addons
    let addonsTotal = 0;
    const addonsBreakdown: Record<string, number> = {};
    for (const addon of input.addons) {
        const price = ADDON_PRICES[addon] || 0;
        addonsTotal += price;
        addonsBreakdown[addon] = price;
    }

    // 4. Usage Estimation (Heuristic)
    // Very rough heuristic: 0.10€ per transaction processed via Stripe Operator
    const usageCost = Math.floor(input.estimatedTransactions * 10); // 10 cents

    // Total
    const totalCents = monthlyBase + addonsTotal + usageCost;

    return {
        monthlyBase: (monthlyBase - seatsCost) / 100,
        addonsTotal: addonsTotal / 100,
        estimatedUsage: usageCost / 100,
        totalMonthly: totalCents / 100,
        currency: "EUR",
        confidence: 0.9,
        breakdown: {
            base: TIER_BASE_PRICES[input.tier] / 100,
            seats: seatsCost / 100,
            addons: Object.fromEntries(
                Object.entries(addonsBreakdown).map(([k, v]) => [k, v / 100])
            ),
            usage: usageCost / 100
        }
    };
}
