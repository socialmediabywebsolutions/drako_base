#!/usr/bin/env node
/**
 * patch-prerender-manifest.mjs
 *
 * Workaround para un fallo de @opennextjs/cloudflare 1.x con monorepos:
 * el plugin inlineLoadManifest hace un glob en
 *   .open-next/server-functions/default/apps/socialcors/.next/
 * pero prerender-manifest.json no acaba en ese directorio porque Next.js
 * no lo incluye en el output de standalone (se carga dinámicamente y NFT
 * no traza esos accesos a disco). El plugin deja la función loadManifest
 * sin esa entrada y, en runtime, NextNodeServer.getPrerenderManifest()
 * dispara el throw "Unexpected loadManifest(/.next/prerender-manifest.json) call!".
 *
 * Solución: después de `opennextjs-cloudflare build`, leer el manifest del
 * output de Next.js y parchear handler.mjs para que loadManifest lo devuelva
 * inline en lugar de lanzar el error.
 *
 * Uso en CI (desde apps/socialcors):
 *   node ../../scripts/patch-prerender-manifest.mjs
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
// El script se corre desde apps/socialcors.
const appDir = process.cwd();

// ── Rutas ──────────────────────────────────────────────────────────────────
const manifestSrc = path.join(appDir, ".next", "prerender-manifest.json");
// En monorepo, el handler bundleado por OpenNext vive bajo packagePath.
// Soportamos tanto la ruta plana (sin monorepo) como la anidada (monorepo).
const handlerPaths = [
  path.join(appDir, ".open-next", "server-functions", "default", "apps", "socialcors", "handler.mjs"),
  path.join(appDir, ".open-next", "server-functions", "default", "handler.mjs"),
];

// ── Validaciones ────────────────────────────────────────────────────────────
if (!existsSync(manifestSrc)) {
  console.error(`[patch-prerender-manifest] ERROR: no encontrado: ${manifestSrc}`);
  process.exit(1);
}

const handlerPath = handlerPaths.find(existsSync);
if (!handlerPath) {
  console.error(`[patch-prerender-manifest] ERROR: handler.mjs no encontrado en ninguna de las rutas esperadas:`);
  handlerPaths.forEach((p) => console.error("  -", p));
  process.exit(1);
}

// ── Leer fuentes ────────────────────────────────────────────────────────────
const manifestJson = readFileSync(manifestSrc, "utf-8").trim();
let handlerCode = readFileSync(handlerPath, "utf-8");

// ── Buscar el marcador exacto generado por inlineLoadManifest ───────────────
// El plugin parchea loadManifest y al final siempre deja esta línea cuando
// no ha inlineado una entrada concreta:
const THROW_MARKER = 'throw new Error(`Unexpected loadManifest(${';

if (!handlerCode.includes(THROW_MARKER)) {
  console.log(`[patch-prerender-manifest] No se encontró el marker "${THROW_MARKER}" en handler.mjs.`);
  console.log("[patch-prerender-manifest] ¿Quizás ya fue parchado o la versión de OpenNext cambió?");
  // Salir sin error: si no hay marker, el manifest ya está inlineado.
  process.exit(0);
}

// Verificar si prerender-manifest.json ya está inlineado (no necesita parche).
if (handlerCode.includes('endsWith("/prerender-manifest.json")')) {
  console.log("[patch-prerender-manifest] prerender-manifest.json ya está inlineado. Nada que hacer.");
  process.exit(0);
}

// ── Insertar el return antes del throw ──────────────────────────────────────
// Buscamos el throw y pegamos justo antes el return para prerender-manifest.json.
const prerenderReturnSnippet =
  `if ($PATH.endsWith("/prerender-manifest.json")) { return ${manifestJson}; }\n  `;

const patched = handlerCode.replace(
  THROW_MARKER,
  prerenderReturnSnippet + THROW_MARKER,
);

if (patched === handlerCode) {
  console.error("[patch-prerender-manifest] ERROR: la sustitución no tuvo efecto. Revisa el marker.");
  process.exit(1);
}

writeFileSync(handlerPath, patched, "utf-8");

console.log("[patch-prerender-manifest] ✅ handler.mjs parchado correctamente.");
console.log(`  manifest: ${manifestSrc}`);
console.log(`  handler:  ${handlerPath}`);
