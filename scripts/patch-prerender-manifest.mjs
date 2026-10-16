#!/usr/bin/env node
/**
 * patch-prerender-manifest.mjs
 *
 * Workaround para un fallo de @opennextjs/cloudflare 1.x con monorepos:
 * el plugin inlineLoadManifest hace un glob en
 *   .open-next/server-functions/default/apps/socialcors/.next/
 * pero varios manifests no acaban ahí porque Next.js los carga dinámicamente
 * (NFT no traza esos accesos a disco). El plugin deja loadManifest sin esas
 * entradas y en runtime NextNodeServer lanza:
 *   "Unexpected loadManifest(/.next/<name>) call!"
 *
 * Solución: tras `opennextjs-cloudflare build`, leer TODOS los manifests del
 * output de Next.js e inyectarlos inline en handler.mjs de una sola pasada.
 *
 * Uso en CI (desde apps/socialcors):
 *   node ../../scripts/patch-prerender-manifest.mjs
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = process.cwd();

// ── Rutas ──────────────────────────────────────────────────────────────────
const nextDir = path.join(appDir, ".next");
const handlerPaths = [
  path.join(appDir, ".open-next", "server-functions", "default", "apps", "socialcors", "handler.mjs"),
  path.join(appDir, ".open-next", "server-functions", "default", "handler.mjs"),
];

// ── Validaciones ────────────────────────────────────────────────────────────
if (!existsSync(nextDir)) {
  console.error(`[patch-manifests] ERROR: directorio .next no encontrado: ${nextDir}`);
  process.exit(1);
}

const handlerPath = handlerPaths.find(existsSync);
if (!handlerPath) {
  console.error(`[patch-manifests] ERROR: handler.mjs no encontrado en ninguna de las rutas esperadas:`);
  handlerPaths.forEach((p) => console.error("  -", p));
  process.exit(1);
}

// ── Recopilar TODOS los manifests de .next/ (recursivo) ──────────────────────
// Mismo patrón que inlineLoadManifest: *-manifest.json, required-server-files.json,
// prefetch-hints.json. Añadimos también routes-manifest.json explícitamente
// porque Next.js 15 lo carga en getRoutesManifest y no entra en standalone.
function findManifests(dir, base = dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...findManifests(full, base));
    } else if (
      entry.endsWith("-manifest.json") ||
      entry === "required-server-files.json" ||
      entry === "prefetch-hints.json" ||
      entry === "routes-manifest.json"
    ) {
      results.push({ full, relative: path.relative(base, full) });
    }
  }
  return results;
}

const manifests = findManifests(nextDir);
if (manifests.length === 0) {
  console.error(`[patch-manifests] ERROR: no se encontraron manifests en ${nextDir}`);
  process.exit(1);
}
console.log(`[patch-manifests] Manifests encontrados en .next/: ${manifests.length}`);
manifests.forEach(({ relative }) => console.log(`  - ${relative}`));

// ── Leer handler ─────────────────────────────────────────────────────────────
let handlerCode = readFileSync(handlerPath, "utf-8");

const THROW_MARKER = 'throw new Error(`Unexpected loadManifest(${';

// ── Pass 1: parchar loadManifest() ────────────────────────────────────────────
// Solo si el marker existe (OpenNext antiguo o versión con loadManifest explícito).
// Si no existe, se salta Pass 1 pero SIEMPRE se continúa a Pass 2.
let pass1Count = 0;

if (!handlerCode.includes(THROW_MARKER)) {
  console.log(`[patch-manifests] Pass 1: THROW_MARKER no encontrado — saltando (loadManifest ya inlineado o versión distinta de OpenNext).`);
} else {
  // ── Extraer el nombre real del parámetro (esbuild puede minificarlo) ─────────
  const throwIdx = handlerCode.indexOf(THROW_MARKER);
  const afterMarker = handlerCode.slice(throwIdx + THROW_MARKER.length);
  const closingIdx = afterMarker.indexOf("}) call!`");
  if (closingIdx === -1) {
    console.error("[patch-manifests] ERROR: no se pudo extraer el nombre del parámetro del throw.");
    process.exit(1);
  }
  const varName = afterMarker.slice(0, closingIdx).trim();
  console.log(`[patch-manifests] Pass 1: parámetro de loadManifest detectado: ${varName}`);

  // ── Construir snippet con TODOS los manifests no inlineados aún ──────────────
  const snippets = [];
  for (const { full, relative } of manifests) {
    // El path que Next.js pasa a loadManifest es /.next/<relative>
    // (con separadores Unix, independiente del OS)
    const manifestKey = "/.next/" + relative.split(path.sep).join("/");
    // Verificar si ya está inlineado
    if (handlerCode.includes(JSON.stringify(manifestKey)) || handlerCode.includes(`"${manifestKey}"`)) {
      console.log(`[patch-manifests] Pass 1: ya inlineado: ${manifestKey}`);
      continue;
    }
    let content;
    try {
      content = readFileSync(full, "utf-8").trim();
      JSON.parse(content); // validar JSON
    } catch (e) {
      console.warn(`[patch-manifests] WARN: no se pudo leer/parsear ${full}: ${e.message}`);
      continue;
    }
    snippets.push(`if (${varName}.endsWith(${JSON.stringify(manifestKey)})) { return ${content}; }`);
    console.log(`[patch-manifests] Pass 1: inyectando: ${manifestKey}`);
  }

  if (snippets.length === 0) {
    console.log("[patch-manifests] Pass 1: todos los manifests ya están inlineados.");
  } else {
    // ── Insertar antes del throw ────────────────────────────────────────────────
    const insertionBlock = snippets.join("\n  ") + "\n  ";
    const patched = handlerCode.replace(THROW_MARKER, insertionBlock + THROW_MARKER);

    if (patched === handlerCode) {
      console.error("[patch-manifests] ERROR: la sustitución de Pass 1 no tuvo efecto.");
      process.exit(1);
    }

    writeFileSync(handlerPath, patched, "utf-8");
    pass1Count = snippets.length;
    console.log(`[patch-manifests] ✅ Pass 1: handler.mjs parchado con ${pass1Count} manifest(s).`);
    console.log(`  handler: ${handlerPath}`);
  }
}

// ── 2ª pasada: parchar dynamic require() en .open-next/worker.js ──────────────
//
// worker.ts importa directamente `.open-next/worker.js` (ya bundleado por OpenNext/esbuild).
// Wrangler toma ese archivo como entrada para su propio bundle. Por tanto el parche
// DEBE aplicarse sobre .open-next/worker.js, NO sobre handler.mjs.
//
// Next.js llama a require("/.next/server/middleware-manifest.json") en getMiddlewareManifest.
// esbuild sustituye los require() no resolvibles en CF Workers por un helper __require
// que lanza: Dynamic require of "${x}" is not supported
//
// Buscamos el call-site: <ident>("/.next/server/middleware-manifest.json")
// Lo sustituimos por: ({...json inline...})

// Pass 2 parchea worker.ts (TypeScript fuente) ANTES de que wrangler lo compile.
// worker.ts define globalThis.require con un shim stub entre los marcadores
// CF_REQUIRE_SHIM_BEGIN y CF_REQUIRE_SHIM_END. Aquí reemplazamos ese shim
// con returns reales para los manifests que Next.js carga dinámicamente.
//
// Ventaja vs parchar el bundle compilado:
//   - El path "/.next/server/middleware-manifest.json" no aparece como literal
//     en el call-site (lo compone Next.js con path.join en runtime), por lo que
//     los regex sobre el bundle nunca podían matchear.
//   - globalThis.require es detectado por el stub __require de esbuild:
//     "if (typeof require !== 'undefined') return require(x)"
//   - Parchar worker.ts es determinístico: los marcadores son literales exactos.

const workerTsPath = path.join(appDir, "worker.ts");
if (!existsSync(workerTsPath)) {
  console.error(`[patch-manifests] ERROR: worker.ts no encontrado en ${workerTsPath}`);
  process.exit(1);
}
console.log(`[patch-manifests] Pass 2: parchando ${workerTsPath}`);

let workerCode = readFileSync(workerTsPath, "utf-8");

// Manifests que Next.js puede requerir dinámicamente en runtime
const SHIM_MANIFESTS = [
  "/.next/server/middleware-manifest.json",
];

const SHIM_BEGIN = "// CF_REQUIRE_SHIM_BEGIN";
const SHIM_END   = "// CF_REQUIRE_SHIM_END";

const beginIdx = workerCode.indexOf(SHIM_BEGIN);
const endIdx   = workerCode.indexOf(SHIM_END);

if (beginIdx === -1 || endIdx === -1 || endIdx <= beginIdx) {
  console.error(`[patch-manifests] ERROR Pass 2: marcadores CF_REQUIRE_SHIM_BEGIN/END no encontrados en ${workerTsPath}`);
  process.exit(1);
}

// Construir el cuerpo del shim con los manifests inline
const shimLines = [];
for (const manifestKey of SHIM_MANIFESTS) {
  const diskRelative = manifestKey.replace(/^\//, "");
  const diskFull = path.join(appDir, diskRelative.split("/").join(path.sep));
  if (!existsSync(diskFull)) {
    console.warn(`[patch-manifests] WARN: ${diskFull} no existe — saltando`);
    continue;
  }
  let jsonContent;
  try {
    jsonContent = readFileSync(diskFull, "utf-8").trim();
    JSON.parse(jsonContent);
  } catch (e) {
    console.warn(`[patch-manifests] WARN: no se pudo leer ${diskFull}: ${e.message}`);
    continue;
  }
  // endsWith() funciona con paths calculados dinámicamente en runtime
  shimLines.push(`  if (id.endsWith(${JSON.stringify(manifestKey)})) return (${jsonContent});`);
  console.log(`[patch-manifests] Pass 2: inyectando manifest inline: ${manifestKey}`);
}

if (shimLines.length === 0) {
  console.log(`[patch-manifests] Pass 2: ningún manifest disponible — shim vacío.`);
} else {
  const shimBody = [
    SHIM_BEGIN,
    `(globalThis as any).require = (id: string): unknown => {`,
    ...shimLines,
    `  throw new Error(\`[CF Workers] Dynamic require of "\${id}" not handled — add to patch-prerender-manifest.mjs\`);`,
    `};`,
    SHIM_END,
  ].join("\n");

  const before = workerCode.slice(0, beginIdx);
  const after  = workerCode.slice(endIdx + SHIM_END.length);
  const patched = before + shimBody + after;

  if (patched === workerCode) {
    console.error(`[patch-manifests] ERROR Pass 2: la sustitución de worker.ts no tuvo efecto.`);
    process.exit(1);
  }

  writeFileSync(workerTsPath, patched, "utf-8");
  console.log(`[patch-manifests] ✅ Pass 2: worker.ts parchado con ${shimLines.length} manifest(s) en globalThis.require.`);
}
