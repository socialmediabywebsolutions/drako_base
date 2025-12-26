import type { SaasBlueprintDraft } from "@/lib/campamento-base/saas-factory-types";
import type { DracoEnv } from "@/lib/cf";

export type CloudflareProvisioningResult = {
  status: "PENDING" | "SUCCESS" | "ERROR";
  message?: string;
  createdDnsRecord?: string | null;
  createdCustomHostname?: string | null;
  payloads?: Record<string, unknown> | null;
};

const PRIMARY_ZONE = "drako.systems";

function resolveEnvValue(key: "CF_API_TOKEN" | "CF_ACCOUNT_ID" | "CF_ZONE_ID", env?: DracoEnv | null): string | undefined {
  if (typeof process !== "undefined" && process.env[key]) return process.env[key];
  const envRecord = env as unknown as Record<string, string | undefined>;
  return env ? envRecord[key] : undefined;
}

export function computeDomainsForSaas(blueprint: SaasBlueprintDraft): {
  primaryHostname: string;
  customHostname?: string | null;
} {
  const subdomain = blueprint.provisioning?.domains.primarySubdomain ?? blueprint.proposedSlug;
  const customHostname = blueprint.provisioning?.domains.customDomainRequested ?? null;
  return {
    primaryHostname: `${subdomain}.${PRIMARY_ZONE}`,
    customHostname,
  };
}

export async function provisionSaasInCloudflare(params: {
  env?: DracoEnv | null;
  blueprint: SaasBlueprintDraft;
  saasId: string;
}): Promise<CloudflareProvisioningResult> {
  const token = resolveEnvValue("CF_API_TOKEN", params.env);
  const accountId = resolveEnvValue("CF_ACCOUNT_ID", params.env);
  const zoneId = resolveEnvValue("CF_ZONE_ID", params.env);

  if (!token || !accountId || !zoneId) {
    return {
      status: "PENDING",
      message: "Cloudflare provisioning disabled in this env.",
    };
  }

  const domains = computeDomainsForSaas(params.blueprint);
  const dnsPayload = {
    type: "CNAME",
    name: domains.primaryHostname,
    content: params.blueprint.proposedSubdomain,
    proxied: true,
  };

  const customHostnamePayload = domains.customHostname
    ? {
        hostname: domains.customHostname,
        ssl: { method: "http", type: "dv" },
      }
    : null;

  return {
    status: "PENDING",
    message: "Cloudflare payloads prepared (dry-run).",
    createdDnsRecord: null,
    createdCustomHostname: null,
    payloads: {
      zoneId,
      accountId,
      dnsPayload,
      customHostnamePayload,
    },
  };
}
