import { describe, expect, it, vi } from "vitest";
import { createSocialFlowLinkedInOAuthSocialOwnershipPrepContract } from "@/lib/socialflow/contracts/linkedin-oauth-runtime";

describe("socialflow linkedin oauth social ownership prep contract", () => {
  it("reads prepared ownership rows from SOCIAL_DB-owned table contract", async () => {
    const queryOne = vi.fn().mockResolvedValue({
      id: "oauth_1",
      tenant_id: "tenant_1",
      saas_id: "saas_1",
      provider: "LINKEDIN",
      external_profile_id: "member_1",
      author_urn: "urn:li:person:member_1",
      encrypted_access_token: "enc_access",
      encrypted_refresh_token: null,
      encrypted_id_token: "enc_id",
      scopes: "openid profile email",
      expires_at: "2026-01-01T00:00:00.000Z",
      token_type: "Bearer",
      status: "CONNECTED_REAL",
      metadata_json: "{}",
      last_validated_at: "2026-01-01T00:00:00.000Z",
      last_error_code: null,
      last_error_message: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    const run = vi.fn();
    const contract = createSocialFlowLinkedInOAuthSocialOwnershipPrepContract({
      queryOne,
      run,
    });

    const row = await contract.getPreparedLinkedInOAuthConnection("tenant_1", "saas_1");

    expect(row?.provider).toBe("LINKEDIN");
    expect(queryOne).toHaveBeenCalledOnce();
    expect(queryOne.mock.calls[0]?.[0]).toContain("FROM socialflow_oauth_connections");
    expect(queryOne.mock.calls[0]?.[1]).toBe("tenant_1");
    expect(queryOne.mock.calls[0]?.[2]).toBe("saas_1");
  });

  it("fails closed when SOCIAL_DB prep upsert is not successful", async () => {
    const queryOne = vi.fn().mockResolvedValue(null);
    const run = vi.fn().mockResolvedValue(false);
    const contract = createSocialFlowLinkedInOAuthSocialOwnershipPrepContract({
      queryOne,
      run,
    });

    await expect(
      contract.upsertPreparedLinkedInOAuthConnection({
        id: "oauth_2",
        tenantId: "tenant_2",
        saasId: "saas_2",
        provider: "LINKEDIN",
        externalProfileId: "member_2",
        authorUrn: "urn:li:person:member_2",
        encryptedAccessToken: "enc_access_2",
        encryptedRefreshToken: null,
        encryptedIdToken: "enc_id_2",
        scopes: "openid profile email",
        expiresAt: "2026-01-02T00:00:00.000Z",
        tokenType: "Bearer",
        status: "PENDING_REAL",
        metadataJson: "{}",
        lastValidatedAt: "2026-01-02T00:00:00.000Z",
        lastErrorCode: null,
        lastErrorMessage: null,
      }),
    ).rejects.toThrow("SOCIALFLOW_LINKEDIN_OAUTH_OWNERSHIP_PREP_UPSERT_FAILED");
  });

  it("fails closed when local SOCIAL_DB table is missing", async () => {
    const queryOne = vi.fn().mockRejectedValue(new Error("SOCIALFLOW_LINKEDIN_OAUTH_PREP_TABLE_MISSING:socialflow_oauth_connections"));
    const run = vi.fn();
    const contract = createSocialFlowLinkedInOAuthSocialOwnershipPrepContract({
      queryOne,
      run,
    });

    await expect(
      contract.getPreparedLinkedInOAuthConnection("tenant_3", "saas_3"),
    ).rejects.toThrow("SOCIALFLOW_LINKEDIN_OAUTH_PREP_TABLE_MISSING:socialflow_oauth_connections");
  });

  it("fails closed when local SOCIAL_DB binding is missing", async () => {
    const queryOne = vi.fn().mockResolvedValue(null);
    const run = vi.fn().mockRejectedValue(new Error("SOCIALFLOW_LINKEDIN_OAUTH_PREP_BINDING_MISSING:SOCIAL_DB"));
    const contract = createSocialFlowLinkedInOAuthSocialOwnershipPrepContract({
      queryOne,
      run,
    });

    await expect(
      contract.upsertPreparedLinkedInOAuthConnection({
        id: "oauth_4",
        tenantId: "tenant_4",
        saasId: "saas_4",
        provider: "LINKEDIN",
        externalProfileId: "member_4",
        authorUrn: "urn:li:person:member_4",
        encryptedAccessToken: "enc_access_4",
        encryptedRefreshToken: null,
        encryptedIdToken: null,
        scopes: "openid profile email",
        expiresAt: null,
        tokenType: "Bearer",
        status: "CONNECTED_REAL",
        metadataJson: "{}",
        lastValidatedAt: "2026-01-04T00:00:00.000Z",
        lastErrorCode: null,
        lastErrorMessage: null,
      }),
    ).rejects.toThrow("SOCIALFLOW_LINKEDIN_OAUTH_PREP_BINDING_MISSING:SOCIAL_DB");
  });
});
