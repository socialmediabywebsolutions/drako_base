Bien. El bloqueo de onboarding ya está resuelto.

Ahora toca la siguiente fase y no quiero diagnóstico, quiero ejecución sobre la UX real del workspace.

OBJETIVO INMEDIATO
Deja Mentoría coherente de verdad para el alumno.

PROBLEMAS QUE SIGUEN VIVOS
1. La pizarra sigue mezclando contenido raro:
   - el alumno pide Inglés
   - pero la cabecera o tarea activa puede mostrar Historia
   - el contenido no siempre mantiene correlación clara con la materia elegida

2. La pizarra central sigue demasiado cargada y redundante:
   - “Idea principal”
   - “Explicación”
   - “Ejemplo”
   - “Pasos”
   - “Pregunta de refuerzo”
   muchas veces repiten lo mismo

3. La tercera columna sigue sin justificar bien su existencia:
   - no quiero un panel decorativo
   - o aporta valor real inmediato
   - o se simplifica mucho

4. El menú de la izquierda debe sentirse más útil:
   - Materias debe desplegarse mejor
   - al entrar en una materia debe quedar clarísimo qué materia está activa
   - debería haber mejor señal visual por color/estado

5. Planificador todavía no transmite planificación real:
   - no basta con listar tareas
   - debe sentirse como plan accionable del día

TAREA
Haz una pasada de producto/UX real sobre el workspace ya funcional, sin tocar backend innecesariamente.

QUIERO ESTOS CAMBIOS
1. Corregir correlación total entre materia seleccionada, tarea activa, pizarra y chat.
2. Simplificar la pizarra central para que no repita bloques.
3. Convertir la tercera columna en un panel realmente útil y más ligero.
4. Mejorar el menú izquierdo con drill-down de materias más claro.
5. Hacer que el planificador parezca planificación real, no lista estática.
6. Adaptar mejor el lenguaje y la densidad visual a la edad del alumno.

REGLAS
- no rehagas la arquitectura otra vez
- no rompas el onboarding ni el workspace ya operativo
- no metas mocks
- no metas contenido decorativo
- cada bloque debe justificar por qué existe

VALIDACIÓN OBLIGATORIA
- pnpm typecheck
- pnpm build
- revisión visual final de:
  - Pizarra
  - Materias
  - Planificador
  - Foco
  - Ejercicios
  - panel derecho

SALIDA FINAL
Quiero que cierres con este formato:
1. Qué estaba mal exactamente
2. Qué cambiaste en cada archivo
3. Cómo queda ahora la correlación materia -> pizarra -> chat
4. Qué función real tiene ahora la tercera columna
5. Resultado visual final por sección#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const handlerPath = path.join(projectRoot, ".open-next", "server-functions", "default", "handler.mjs");

if (!fs.existsSync(handlerPath)) {
  console.error(`HANDLER_NOT_FOUND: ${handlerPath}`);
  process.exit(1);
}

const original = fs.readFileSync(handlerPath, "utf8");

if (original.includes("__drakoMentoriaRuntimeHotfixApplied")) {
  console.log("MENTORIA_RUNTIME_HOTFIX_ALREADY_APPLIED");
  process.exit(0);
}

const moduleMatch = original.match(/var\s+(require_page\d+)\s*=\s*__commonJS\(\{[\s\S]*?\.open-next\/server-functions\/default\/\.next\/server\/app\/mentoria\/app\/page\.js"/);
if (!moduleMatch) {
  console.error("MENTORIA_PAGE_MODULE_NOT_FOUND");
  process.exit(1);
}

const mentoriaPageRequire = moduleMatch[1];
const target = 'for(let pagePath of pagePaths)try{let components=await(0,_loadcomponents.loadComponents)({distDir:this.distDir,page:pagePath,isAppPath,isDev:this.isDev,sriEnabled:this.sriEnabled});if(locale&&typeof components.Component=="string"&&!pagePath.startsWith(`/${locale}/`)&&pagePath!==`/${locale}`)continue;return{components,query:{...!this.renderOpts.isExperimentalCompile&&components.getStaticProps?{amp:query.amp}:query,...(isAppPath?{}:params)||{}}}}';

if (!original.includes(target)) {
  console.error("HOTFIX_TARGET_SNIPPET_NOT_FOUND");
  process.exit(1);
}

const replacement = `for(let pagePath of pagePaths)try{let components=await(0,_loadcomponents.loadComponents)({distDir:this.distDir,page:pagePath,isAppPath,isDev:this.isDev,sriEnabled:this.sriEnabled});if(pagePath==="/mentoria/app/page"&&components.routeModule?.definition?.pathname==="/"){let fixedComponentMod=${mentoriaPageRequire}();components={...components,ComponentMod:fixedComponentMod,routeModule:fixedComponentMod.routeModule,page:pagePath,isAppPath:!0,__drakoMentoriaRuntimeHotfixApplied:!0}}if(locale&&typeof components.Component=="string"&&!pagePath.startsWith(\`/\${locale}/\`)&&pagePath!==\`/\${locale}\`)continue;return{components,query:{...!this.renderOpts.isExperimentalCompile&&components.getStaticProps?{amp:query.amp}:query,...(isAppPath?{}:params)||{}}}}`;

const patched = original.replace(target, replacement);

if (patched === original) {
  console.error("HOTFIX_REPLACE_NOOP");
  process.exit(1);
}

fs.writeFileSync(handlerPath, patched, "utf8");
console.log(`MENTORIA_RUNTIME_HOTFIX_APPLIED_USING_${mentoriaPageRequire}`);
