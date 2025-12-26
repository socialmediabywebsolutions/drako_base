type NormalizeResult = {
  hostname: string | null;
  reason?: string;
  wasWww: boolean;
};

const INVALID_CHARS = /[\s/]/;

export function normalizeHostnameInput(input: string, opts?: { allowWildcard?: boolean }): NormalizeResult {
  const allowWildcard = opts?.allowWildcard ?? false;
  const trimmed = input.trim().toLowerCase();
  const withoutProtocol = trimmed.replace(/^https?:\/\//, "");
  const withoutPort = withoutProtocol.split(":")[0] ?? "";
  const withoutTrailingDot = withoutPort.replace(/\.+$/, "");
  if (!withoutTrailingDot) {
    return { hostname: null, reason: "EMPTY_HOST", wasWww: false };
  }
  if (INVALID_CHARS.test(withoutTrailingDot)) {
    return { hostname: null, reason: "INVALID_CHARACTERS", wasWww: false };
  }
  if (!allowWildcard && withoutTrailingDot.startsWith("*.")) {
    return { hostname: null, reason: "WILDCARD_NOT_ALLOWED", wasWww: false };
  }
  if (withoutTrailingDot.includes("..")) {
    return { hostname: null, reason: "DOUBLE_DOT", wasWww: false };
  }
  const wasWww = withoutTrailingDot.startsWith("www.");
  const normalized = wasWww ? withoutTrailingDot.slice(4) : withoutTrailingDot;
  return { hostname: normalized, wasWww };
}
