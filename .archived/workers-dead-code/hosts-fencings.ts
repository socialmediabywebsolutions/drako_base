export type HostsFencingsOutputs =
  | { ok: true; hostName: string }
  | { ok: false; response: Response };

function normalizeHostName(hostValue: string | null): string {
  if (!hostValue) return "";
  const firstPart = hostValue.split(",")[0]?.trim().toLowerCase() ?? "";
  const hostName = firstPart.split(":")[0] ?? "";
  return hostName.startsWith("www.") ? hostName.slice(4) : hostName;
}

export function resolveHostNameFromRequests(request: Request): string {
  const forwardedHostName = normalizeHostName(request.headers.get("x-forwarded-host"));
  const headerHostName = normalizeHostName(request.headers.get("host"));
  const urlHostName = (() => {
    try {
      return normalizeHostName(new URL(request.url).host);
    } catch {
      return "";
    }
  })();
  return forwardedHostName || headerHostName || urlHostName;
}

export function enforceHostsFencings(params: {
  request: Request;
  allowedHostNames: string[];
  workerName: string;
}): HostsFencingsOutputs {
  const requestedHostName = resolveHostNameFromRequests(params.request);
  const normalizedAllowedHostNames = params.allowedHostNames.map((value) => normalizeHostName(value));
  if (!requestedHostName || !normalizedAllowedHostNames.includes(requestedHostName)) {
    return {
      ok: false,
      response: Response.json(
        {
          ok: false,
          errorCode: "HOSTS_FENCINGS_REJECTED",
          workerName: params.workerName,
          requestedHostName,
          allowedHostNames: normalizedAllowedHostNames,
        },
        { status: 403 },
      ),
    };
  }

  return { ok: true, hostName: requestedHostName };
}
