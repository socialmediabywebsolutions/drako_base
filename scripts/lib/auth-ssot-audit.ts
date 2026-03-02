import fs from "fs";
import path from "path";

export type AuthSurfaceType = "page" | "route" | "layout" | "middleware" | "config" | "component" | "other";
export type AuthSaas = "drako" | "mentorias" | "campo_base" | "unknown";

export type AuthInventoryRow = {
  sourceRoute: string;
  file: string;
  type: AuthSurfaceType;
  sourceSaas: AuthSaas;
  destination: string;
  destinationSaas: AuthSaas;
  reason: string;
};

export type CrossRedirect = AuthInventoryRow & {
  rule: "drako_to_mentorias" | "mentorias_to_drako" | "bases_to_vertical";
};

export type AuthApiEndpoint = {
  vertical: "drakos" | "mentorias" | "bases" | "legacy";
  route: string;
  file: string;
};

export type AuthInventory = {
  rows: AuthInventoryRow[];
  crossRedirects: CrossRedirect[];
  apiEndpoints: AuthApiEndpoint[];
};

const AUTH_TARGET_RE = /(\/(?:api\/(?:drakos|mentorias|bases|auth)\/[^\s"'`)\]]+|drakos\/auths\/[^\s"'`)\]]+|mentorias\/auths\/[^\s"'`)\]]+|auth\/(?:login|register)|(?:site\/)?mentoria(?:s)?\/signup|signup|login))/g;

function walkFiles(dir: string, out: string[]) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, out);
      continue;
    }
    out.push(full);
  }
}

function toPosix(file: string): string {
  return file.replace(/\\/g, "/");
}

function classifySaas(value: string): AuthSaas {
  const normalized = value.toLowerCase();
  if (
    normalized.includes("mentoria") ||
    normalized.includes("mentorias/auths") ||
    normalized.includes("/api/mentorias/")
  ) {
    return "mentorias";
  }
  if (
    normalized.includes("/bases/") ||
    normalized.includes("/api/bases/") ||
    normalized.includes("campo_base") ||
    normalized.includes("/admin")
  ) {
    return "campo_base";
  }
  if (
    normalized.includes("/drakos/") ||
    normalized.includes("/api/drakos/") ||
    normalized.includes("/auth/")
  ) {
    return "drako";
  }
  return "unknown";
}

function classifySourceSaas(file: string, sourceRoute: string): AuthSaas {
  const normalized = toPosix(file);
  if (normalized.startsWith("src/app/auth/")) return "unknown";
  return classifySaas(`${normalized} ${sourceRoute}`);
}

function classifyType(file: string): AuthSurfaceType {
  if (file.endsWith("/route.ts")) return "route";
  if (file.endsWith("/page.tsx")) return "page";
  if (file.endsWith("/layout.tsx")) return "layout";
  if (file.endsWith("/middleware.ts") || file.endsWith("/src/middleware.ts")) return "middleware";
  if (/next\.config\.(ts|js|mjs|cjs)$/.test(file)) return "config";
  if (file.includes("/components/")) return "component";
  return "other";
}

function sourceRouteFromFile(projectRoot: string, file: string): string {
  const rel = toPosix(path.relative(projectRoot, file));
  if (rel.startsWith("src/app/")) {
    const appRel = rel.slice("src/app/".length);
    const isPage = appRel.endsWith("/page.tsx");
    const isRoute = appRel.endsWith("/route.ts");
    const isLayout = appRel.endsWith("/layout.tsx");
    if (isPage || isRoute || isLayout) {
      const trimmed = appRel.replace(/\/(page|route|layout)\.tsx?$/, "");
      const segments = trimmed
        .split("/")
        .filter(Boolean)
        .filter((segment) => !(segment.startsWith("(") && segment.endsWith(")")));
      return `/${segments.join("/")}`.replace(/\/+/g, "/") || "/";
    }
  }
  if (rel === "src/middleware.ts" || rel === "middleware.ts") return "/(middleware)";
  if (/next\.config\.(ts|js|mjs|cjs)$/.test(rel)) return "/(next.config)";
  return `/${rel}`;
}

function extractAuthTargets(content: string): Array<{ target: string; reason: string }> {
  const targets: Array<{ target: string; reason: string }> = [];
  const patterns: Array<{ re: RegExp; reason: string }> = [
    { re: /href\s*=\s*["'`]([^"'`]+)["'`]/g, reason: "ui-link" },
    { re: /destination\s*:\s*["'`]([^"'`]+)["'`]/g, reason: "next-config-redirect" },
    { re: /redirect\(\s*["'`]([^"'`]+)["'`]/g, reason: "next-redirect" },
    { re: /pathname\s*=\s*["'`]([^"'`]+)["'`]/g, reason: "path-rewrite" },
    { re: /window\.location\.href\s*=\s*["'`]([^"'`]+)["'`]/g, reason: "window-location" },
    { re: /fetch\(\s*["'`]([^"'`]+)["'`]/g, reason: "api-call" },
    { re: /new URL\(\s*["'`]([^"'`]+)["'`]/g, reason: "url-target" },
  ];

  for (const pattern of patterns) {
    const re = new RegExp(pattern.re.source, pattern.re.flags);
    let match: RegExpExecArray | null = re.exec(content);
    while (match) {
      const target = match[1];
      if (AUTH_TARGET_RE.test(target)) {
        targets.push({ target, reason: pattern.reason });
      }
      AUTH_TARGET_RE.lastIndex = 0;
      match = re.exec(content);
    }
  }
  return targets;
}

function uniqRows(rows: AuthInventoryRow[]): AuthInventoryRow[] {
  const seen = new Set<string>();
  const out: AuthInventoryRow[] = [];
  for (const row of rows) {
    const key = `${row.sourceRoute}|${row.file}|${row.type}|${row.destination}|${row.reason}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function buildCrossRedirects(rows: AuthInventoryRow[]): CrossRedirect[] {
  const output: CrossRedirect[] = [];
  for (const row of rows) {
    const authTarget = /register|signup|login|auths|\/api\/auth/i.test(row.destination);
    if (!authTarget) continue;
    if (row.sourceSaas === "drako" && row.destinationSaas === "mentorias") {
      output.push({ ...row, rule: "drako_to_mentorias" });
    } else if (row.sourceSaas === "mentorias" && row.destinationSaas === "drako") {
      output.push({ ...row, rule: "mentorias_to_drako" });
    } else if (row.sourceSaas === "campo_base" && (row.destinationSaas === "drako" || row.destinationSaas === "mentorias")) {
      output.push({ ...row, rule: "bases_to_vertical" });
    }
  }
  return output;
}

export function collectAuthInventory(projectRoot = process.cwd()): AuthInventory {
  const files: string[] = [];
  walkFiles(path.join(projectRoot, "src"), files);
  for (const candidate of ["middleware.ts", "next.config.ts", "next.config.js", "next.config.mjs", "next.config.cjs"]) {
    const full = path.join(projectRoot, candidate);
    if (fs.existsSync(full)) files.push(full);
  }

  const rows: AuthInventoryRow[] = [];
  const apiEndpoints: AuthApiEndpoint[] = [];

  for (const absoluteFile of files) {
    const rel = toPosix(path.relative(projectRoot, absoluteFile));
    const content = fs.readFileSync(absoluteFile, "utf8");
    const type = classifyType(rel);
    const sourceRoute = sourceRouteFromFile(projectRoot, absoluteFile);
    const sourceSaas = classifySourceSaas(rel, sourceRoute);

    const authSurfaceByPath =
      /\/(auth|login|signup|register|drakos\/auths|mentorias\/auths)\//.test(rel) ||
      /\/api\/(?:drakos|mentorias|bases|auth)\//.test(rel);

    if (authSurfaceByPath) {
      const destinationSaas = classifySaas(sourceRoute);
      rows.push({
        sourceRoute,
        file: rel,
        type,
        sourceSaas,
        destination: sourceRoute,
        destinationSaas,
        reason: "auth-surface",
      });
    }

    if (rel.startsWith("src/app/api/") && rel.endsWith("/route.ts") && /\/auths\//.test(rel)) {
      let vertical: AuthApiEndpoint["vertical"] = "legacy";
      if (rel.includes("/api/drakos/auths/")) vertical = "drakos";
      else if (rel.includes("/api/mentorias/auths/")) vertical = "mentorias";
      else if (rel.includes("/api/bases/auths/")) vertical = "bases";
      apiEndpoints.push({ vertical, route: sourceRoute, file: rel });
    }

    const targets = extractAuthTargets(content);
    for (const target of targets) {
      rows.push({
        sourceRoute,
        file: rel,
        type,
        sourceSaas,
        destination: target.target,
        destinationSaas: classifySaas(target.target),
        reason: target.reason,
      });
    }
  }

  const deduped = uniqRows(rows).sort((a, b) => `${a.file}:${a.destination}`.localeCompare(`${b.file}:${b.destination}`));
  const crossRedirects = buildCrossRedirects(deduped);
  apiEndpoints.sort((a, b) => `${a.vertical}:${a.route}`.localeCompare(`${b.vertical}:${b.route}`));

  return {
    rows: deduped,
    crossRedirects,
    apiEndpoints,
  };
}

export function renderInventoryMarkdown(inventory: AuthInventory): string {
  const tableLines = [
    "| Ruta | Archivo | Tipo | SaaS objetivo | Destino final |",
    "| --- | --- | --- | --- | --- |",
    ...inventory.rows.map((row) => {
      return `| \`${row.sourceRoute}\` | \`${row.file}\` | \`${row.type}\` | \`${row.sourceSaas}\` | \`${row.destination}\` |`;
    }),
  ];

  const crossLines = inventory.crossRedirects.length === 0
    ? ["- Ninguno."]
    : inventory.crossRedirects.map((item) => {
      return `- [${item.rule}] \`${item.file}\` (\`${item.sourceRoute}\`) -> \`${item.destination}\``;
    });

  const apiByVertical = ["drakos", "mentorias", "bases", "legacy"].map((vertical) => {
    const endpoints = inventory.apiEndpoints.filter((item) => item.vertical === vertical);
    if (endpoints.length === 0) return `### ${vertical}\n- Ninguno.`;
    return `### ${vertical}\n${endpoints.map((item) => `- \`${item.route}\` — \`${item.file}\``).join("\n")}`;
  });

  return [
    "# P1 Auth Inventory",
    "",
    "## Tabla de superficies (registro/login/auth/redirects)",
    ...tableLines,
    "",
    "## Redirects cruzados detectados",
    ...crossLines,
    "",
    "## Endpoints API auth por vertical",
    ...apiByVertical,
    "",
  ].join("\n");
}

export function runAuthSsotDriftChecks(projectRoot = process.cwd()): { ok: boolean; errors: string[]; inventory: AuthInventory } {
  const inventory = collectAuthInventory(projectRoot);
  const errors: string[] = [];

  if (inventory.crossRedirects.length > 0) {
    for (const entry of inventory.crossRedirects) {
      errors.push(`Cross redirect forbidden: [${entry.rule}] ${entry.file} -> ${entry.destination}`);
    }
  }

  const requiredApiRoutes = [
    "/api/drakos/auths/logins",
    "/api/drakos/auths/registrations",
    "/api/mentorias/auths/logins",
    "/api/mentorias/auths/registrations",
    "/api/bases/auths/logins",
  ];
  for (const route of requiredApiRoutes) {
    if (!inventory.apiEndpoints.some((item) => item.route === route)) {
      errors.push(`Missing required auth endpoint: ${route}`);
    }
  }

  const legacyApiRows = inventory.rows.filter(
    (row) => row.destination === "/api/auth/login" || row.destination === "/api/auth/register" || row.sourceRoute === "/api/auth/login" || row.sourceRoute === "/api/auth/register",
  );
  if (legacyApiRows.length > 0) {
    const legacyLoginPath = path.join(projectRoot, "src/app/api/auth/login/route.ts");
    const legacyRegisterPath = path.join(projectRoot, "src/app/api/auth/register/route.ts");
    const loginContent = fs.existsSync(legacyLoginPath) ? fs.readFileSync(legacyLoginPath, "utf8") : "";
    const registerContent = fs.existsSync(legacyRegisterPath) ? fs.readFileSync(legacyRegisterPath, "utf8") : "";
    if (!loginContent.includes("LEGACY_AUTH_ENDPOINT_DEPRECATED")) {
      errors.push("Legacy /api/auth/login must be deprecated (410).");
    }
    if (!registerContent.includes("LEGACY_AUTH_ENDPOINT_DEPRECATED")) {
      errors.push("Legacy /api/auth/register must be deprecated (410).");
    }
  }

  const drakosRegistrationPage = path.join(projectRoot, "src/app/drakos/auths/registrations/page.tsx");
  const drakosLoginPage = path.join(projectRoot, "src/app/drakos/auths/logins/page.tsx");
  if (fs.existsSync(drakosRegistrationPage)) {
    const content = fs.readFileSync(drakosRegistrationPage, "utf8");
    if (!content.includes('redirect("/auth/register")')) {
      errors.push("Drakos registrations page must redirect to /auth/register canonical route.");
    }
  }
  if (fs.existsSync(drakosLoginPage)) {
    const content = fs.readFileSync(drakosLoginPage, "utf8");
    if (!content.includes('redirect("/auth/login")')) {
      errors.push("Drakos logins page must redirect to /auth/login canonical route.");
    }
  }

  const authFormPath = path.join(projectRoot, "src/components/auth/auth-form.tsx");
  if (fs.existsSync(authFormPath)) {
    const content = fs.readFileSync(authFormPath, "utf8");
    if (!content.includes("saasSlug: AuthSaasSlug") || !content.includes("authApiBase: string") || !content.includes("postLoginRedirect: string")) {
      errors.push("AuthForm must require explicit saasSlug + authApiBase + postLoginRedirect.");
    }
  }

  return { ok: errors.length === 0, errors, inventory };
}
