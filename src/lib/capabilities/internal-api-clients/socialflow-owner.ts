import type {
  InternalApiError,
  SocialFlowOwnerSnapshotResponse,
} from "@/lib/capabilities/internal-api-types/socialflow";

const SOCIALFLOW_OWNER_SNAPSHOT_PATH = "/api/internal/socialflow/owner/snapshot";

export type SocialFlowOwnerDashboardSnapshotLegacy = {
  ownerSummary: {
    accountsConnected: number;
    activeCampaigns: number;
    scheduledPostsThisWeek: number;
    recentEngagementScore: number;
  };
  conversionSummary: {
    totalAppointmentsFromSocial: number;
    totalRevenueFromSocial: number;
    topCampaigns: Array<{ name: string; estimatedRevenue: number }>;
    topPosts: Array<{ title: string; estimatedRevenue: number }>;
  };
};

type FetchLike = typeof fetch;

export type FetchSocialFlowOwnerSnapshotOptions = {
  baseUrl?: string;
  requestId?: string;
  tenantId?: string | null;
  serviceToken?: string;
  fetchImpl?: FetchLike;
  signal?: AbortSignal;
};

export class SocialFlowOwnerInternalApiError extends Error {
  status: number;
  code: InternalApiError["code"];
  requestId: string;

  constructor(input: {
    status: number;
    code: InternalApiError["code"];
    message: string;
    requestId: string;
  }) {
    super(input.message);
    this.name = "SocialFlowOwnerInternalApiError";
    this.status = input.status;
    this.code = input.code;
    this.requestId = input.requestId;
  }
}

function buildRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sf-owner-${Date.now()}`;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}

function resolveBaseUrl(input?: string): string {
  const fromInput = input?.trim();
  if (fromInput) {
    return trimTrailingSlash(fromInput);
  }

  const fromEnv =
    process.env.SOCIALFLOW_INTERNAL_API_BASE_URL
    || process.env.INTERNAL_API_BASE_URL
    || process.env.DRAKO_INTERNAL_API_BASE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
    || `http://127.0.0.1:${process.env.PORT || "3000"}`;

  return trimTrailingSlash(fromEnv);
}

function resolveServiceToken(explicitToken?: string): string | null {
  const fromInput = explicitToken?.trim();
  if (fromInput) {
    return fromInput;
  }

  const fromEnv =
    process.env.SOCIALFLOW_INTERNAL_SERVICE_TOKEN
    || process.env.INTERNAL_SERVICE_TOKEN
    || process.env.INTERNAL_API_SERVICE_TOKEN
    || null;

  if (fromEnv) {
    return fromEnv;
  }

  if (process.env.NODE_ENV === "test") {
    return process.env.SOCIALFLOW_INTERNAL_SERVICE_TOKEN_TEST
      || process.env.DRAKO_TEST_SERVICE_TOKEN
      || null;
  }

  return null;
}

function buildHeaders(input: {
  requestId: string;
  serviceToken: string;
  tenantId?: string | null;
}): Headers {
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${input.serviceToken}`);
  headers.set("X-Drako-Control-Plane", "campobase");
  headers.set("X-Drako-Request-Id", input.requestId);

  if (input.tenantId && input.tenantId.trim()) {
    headers.set("X-Drako-Tenant-Id", input.tenantId.trim());
  }

  return headers;
}

function buildErrorFromPayload(input: {
  status: number;
  requestId: string;
  payload: unknown;
}): SocialFlowOwnerInternalApiError {
  const payload = input.payload as InternalApiError | null;
  const code = payload?.code ?? "INTERNAL_API_BAD_REQUEST";
  const message = payload?.message ?? `SocialFlow owner snapshot request failed with status ${input.status}`;
  const requestId = payload?.requestId ?? input.requestId;

  return new SocialFlowOwnerInternalApiError({
    status: input.status,
    code,
    message,
    requestId,
  });
}

export async function fetchSocialFlowOwnerSnapshot(
  options: FetchSocialFlowOwnerSnapshotOptions = {},
): Promise<SocialFlowOwnerSnapshotResponse> {
  const requestId = options.requestId?.trim() || buildRequestId();
  const serviceToken = resolveServiceToken(options.serviceToken);

  if (!serviceToken) {
    throw new SocialFlowOwnerInternalApiError({
      status: 401,
      code: "INTERNAL_API_UNAUTHORIZED",
      message: "Missing internal service token for socialflow owner snapshot",
      requestId,
    });
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const url = `${resolveBaseUrl(options.baseUrl)}${SOCIALFLOW_OWNER_SNAPSHOT_PATH}`;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: buildHeaders({
        requestId,
        serviceToken,
        tenantId: options.tenantId,
      }),
      cache: "no-store",
      signal: options.signal,
    });
  } catch {
    throw new SocialFlowOwnerInternalApiError({
      status: 500,
      code: "INTERNAL_API_BAD_REQUEST",
      message: "Unable to reach SocialFlow owner snapshot internal endpoint",
      requestId,
    });
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw buildErrorFromPayload({
      status: response.status,
      requestId,
      payload,
    });
  }

  return payload as SocialFlowOwnerSnapshotResponse;
}

export function mapSocialFlowOwnerSnapshotToLegacyDashboard(
  response: SocialFlowOwnerSnapshotResponse,
): SocialFlowOwnerDashboardSnapshotLegacy {
  return {
    ownerSummary: {
      accountsConnected: response.snapshot.connectedProfiles,
      activeCampaigns: response.snapshot.activeCampaigns,
      scheduledPostsThisWeek: response.snapshot.scheduledPosts,
      recentEngagementScore: 0,
    },
    conversionSummary: {
      totalAppointmentsFromSocial: 0,
      totalRevenueFromSocial: 0,
      topCampaigns: [],
      topPosts: [],
    },
  };
}
