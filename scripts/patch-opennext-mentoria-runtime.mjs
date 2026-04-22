#!/usr/bin/env node

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
