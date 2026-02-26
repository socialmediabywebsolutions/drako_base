type CloudflareApiResponse<T> = {
  success: boolean;
  result: T;
  errors?: Array<{ code: number; message: string }>;
  messages?: Array<{ code: number; message: string }>;
};

type WorkersSubdomainResult = {
  enabled: boolean;
  previews_enabled: boolean;
};

type WorkersSchedulesResult = {
  schedules: Array<{ cron: string }>;
};

type WorkersRouteResult = {
  id: string;
  pattern: string;
  script: string;
};

type WorkersDomainResult = {
  id: string;
  hostname: string;
  service: string;
};

type WorkersSpec = {
  workerName: string;
  status: "ACTIVE" | "ARCHIVED";
};

const WORKERS_SPECS: WorkersSpec[] = [
  { workerName: "drako-core-worker", status: "ACTIVE" },
  { workerName: "drako-billing-worker", status: "ACTIVE" },
  { workerName: "drako-observability-worker", status: "ACTIVE" },
  { workerName: "drako-ai-orchestrator-worker", status: "ACTIVE" },
  { workerName: "drako-base-3", status: "ARCHIVED" },
];

function readRequiredEnvs(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value.replace(/^"+|"+$/g, "");
}

async function requestCloudflareApis<T>(params: {
  pathName: string;
  apiToken: string;
}): Promise<CloudflareApiResponse<T>> {
  const response = await fetch(`https://api.cloudflare.com/client/v4${params.pathName}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${params.apiToken}`,
      "content-type": "application/json",
    },
  });

  const payload = (await response.json()) as CloudflareApiResponse<T>;
  if (!response.ok || payload.success === false) {
    const errorText = payload.errors?.map((item) => `${item.code}:${item.message}`).join(", ") || response.statusText;
    throw new Error(`Cloudflare API error for ${params.pathName}: ${errorText}`);
  }
  return payload;
}

async function main() {
  const apiToken = readRequiredEnvs("CLOUDFLARE_API_TOKEN");
  const accountId = readRequiredEnvs("CLOUDFLARE_ACCOUNT_ID");
  const zoneId = readRequiredEnvs("CLOUDFLARE_ZONE_ID");

  const routesPayload = await requestCloudflareApis<WorkersRouteResult[]>({
    pathName: `/zones/${zoneId}/workers/routes`,
    apiToken,
  });
  const domainsPayload = await requestCloudflareApis<WorkersDomainResult[]>({
    pathName: `/accounts/${accountId}/workers/domains`,
    apiToken,
  });

  const routes = routesPayload.result || [];
  const domains = domainsPayload.result || [];

  const driftDetections: string[] = [];

  for (const worker of WORKERS_SPECS) {
    const subdomainPayload = await requestCloudflareApis<WorkersSubdomainResult>({
      pathName: `/accounts/${accountId}/workers/scripts/${worker.workerName}/subdomain`,
      apiToken,
    });
    const schedulesPayload = await requestCloudflareApis<WorkersSchedulesResult>({
      pathName: `/accounts/${accountId}/workers/scripts/${worker.workerName}/schedules`,
      apiToken,
    });

    const isSubdomainEnabled = Boolean(subdomainPayload.result?.enabled);
    const schedulesCount = (schedulesPayload.result?.schedules || []).length;
    const routeCount = routes.filter((item) => item.script === worker.workerName).length;
    const domainCount = domains.filter((item) => item.service === worker.workerName).length;

    if (worker.status === "ARCHIVED") {
      const violations: string[] = [];
      if (isSubdomainEnabled) violations.push("subdomain enabled");
      if (schedulesCount > 0) violations.push(`schedules=${schedulesCount}`);
      if (routeCount > 0) violations.push(`routes=${routeCount}`);
      if (domainCount > 0) violations.push(`domains=${domainCount}`);

      if (violations.length > 0) {
        driftDetections.push(`${worker.workerName}: ${violations.join(", ")}`);
      }
    }
  }

  if (driftDetections.length > 0) {
    for (const drift of driftDetections) {
      console.error(`DRIFT DETECTED: ${drift.split(":")[0]} resurrected`);
      console.error(`DETAILS: ${drift}`);
    }
    process.exit(1);
  }

  console.log("Workers state consistent");
}

main().catch((error) => {
  console.error("Workers drift check failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
