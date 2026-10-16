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

const DYNAMIC_REQUIRE_MANIFESTS = [
  "/.next/server/middleware-manifest.json",
];

// El archivo que wrangler usa: .open-next/worker.js (bundle completo de OpenNext)
const openNextWorkerPath = path.join(appDir, ".open-next", "worker.js");
if (!existsSync(openNextWorkerPath)) {
  console.error(`[patch-manifests] ERROR: .open-next/worker.js no encontrado en ${openNextWorkerPath}`);
  process.exit(1);
}
console.log(`[patch-manifests] Pass 2: parchando ${openNextWorkerPath}`);

let workerCode = readFileSync(openNextWorkerPath, "utf-8");
let dynamicRequirePatched = 0;

for (const manifestKey of DYNAMIC_REQUIRE_MANIFESTS) {
  // El path en disco: quitar la barra inicial y convertir a ruta del SO
  const diskRelative = manifestKey.replace(/^\//, ""); // ".next/server/middleware-manifest.json"
  const diskFull = path.join(appDir, diskRelative.split("/").join(path.sep));

  if (!existsSync(diskFull)) {
    console.warn(`[patch-manifests] WARN: ${diskFull} no existe — saltando dynamic require patch`);
    continue;
  }

  let jsonContent;
  try {
    jsonContent = readFileSync(diskFull, "utf-8").trim();
    JSON.parse(jsonContent); // validar
  } catch (e) {
    console.warn(`[patch-manifests] WARN: no se pudo leer ${diskFull}: ${e.message}`);
    continue;
  }

  // Buscar el patrón: <ident>("/.next/server/middleware-manifest.json")
  // esbuild puede minificar el nombre de __require a cualquier identificador corto.
  // Negative lookbehind (?<!\.) para excluir llamadas a método como path.endsWith(...)
  const callPattern = new RegExp(
    `(?<!\\.)(\\b[A-Za-z_$][\\w$]*)\\(${JSON.stringify(manifestKey).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)`,
    "g"
  );

  const before = workerCode;
  workerCode = workerCode.replace(callPattern, (_match, _fn) => {
    return `(${jsonContent})`;
  });

  if (workerCode !== before) {
    console.log(`[patch-manifests] Pass 2: dynamic require parchado: ${manifestKey}`);
    dynamicRequirePatched++;
  } else {
    console.log(`[patch-manifests] Pass 2: dynamic require no encontrado en worker.js (ya inlineado o firma distinta): ${manifestKey}`);
  }
}

if (dynamicRequirePatched > 0) {
  writeFileSync(openNextWorkerPath, workerCode, "utf-8");
  console.log(`[patch-manifests] ✅ Pass 2: ${dynamicRequirePatched} dynamic require(s) parchados en .open-next/worker.js`);
} else {
  console.log(`[patch-manifests] Pass 2: nada que parchar en .open-next/worker.js`);
}
