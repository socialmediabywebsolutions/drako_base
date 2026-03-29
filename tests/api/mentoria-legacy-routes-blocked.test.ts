import { describe, expect, it } from "vitest";

import { POST as legacyInvoicerPost } from "@/app/api/billing/mentoria/run/route";
import { PATCH as legacyBillPatch } from "@/app/api/mentoria/sessions/[id]/bill/route";
import { PATCH as legacyCompletePatch } from "@/app/api/mentoria/sessions/[id]/complete/route";
import { GET as legacySessionsGet, POST as legacySessionsPost } from "@/app/api/mentoria/sessions/route";

describe("mentoria legacy routes are blocked", () => {
  it("blocks the legacy sessions collection routes", async () => {
    const getResponse = await legacySessionsGet();
    const postResponse = await legacySessionsPost();

    expect(getResponse.status).toBe(410);
    expect(postResponse.status).toBe(410);
  });

  it("blocks the legacy session mutation routes", async () => {
    const completeResponse = await legacyCompletePatch();
    const billResponse = await legacyBillPatch();

    expect(completeResponse.status).toBe(410);
    expect(billResponse.status).toBe(410);
  });

  it("blocks the legacy mentoria manual invoicer route", async () => {
    const response = await legacyInvoicerPost();
    expect(response.status).toBe(410);
  });
});
