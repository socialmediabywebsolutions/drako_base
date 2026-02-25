import { getAuthsCookieName } from "@/lib/auths/cookies";
import { createAuthsSessionToken, verifyAuthsSessionToken } from "@/lib/auths/tokens";
import { resolveAuthsContextFromHost } from "@/lib/auths/contexts";
import { POST as legacyRegister } from "@/app/api/auth/register/route";

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function testCookieIsolation() {
  const drakosCookie = getAuthsCookieName("drakos");
  const mentoriasCookie = getAuthsCookieName("mentorias");
  assert(drakosCookie === "__Host-drakos_session", `Expected __Host-drakos_session cookie, got ${drakosCookie}`);
  assert(mentoriasCookie === "__Host-mentorias_session", `Expected __Host-mentorias_session cookie, got ${mentoriasCookie}`);
  assert(drakosCookie !== mentoriasCookie, "Cookies must be different per SaaS.");
  console.log("PASS cookie names are isolated.");
}

async function testTokenIsolation() {
  process.env.DRAKOS_AUTHS_SECRET = process.env.DRAKOS_AUTHS_SECRET || "drakos_test_secret_1234567890";
  process.env.MENTORIAS_AUTHS_SECRET = process.env.MENTORIAS_AUTHS_SECRET || "mentorias_test_secret_0987654321";

  const drakosToken = await createAuthsSessionToken({
    context: "drakos",
    sub: "user-drakos",
    email: "drakos@test.local",
    tenantId: "tenant-drakos",
    role: "user",
  });

  const drakosValidation = await verifyAuthsSessionToken(drakosToken, "drakos");
  const mentoriasValidation = await verifyAuthsSessionToken(drakosToken, "mentorias");
  assert(Boolean(drakosValidation), "Drakos token should validate in drakos.");
  assert(!mentoriasValidation, "Drakos token must be rejected in mentorias.");
  console.log("PASS cross-token validation is blocked.");
}

async function testHostContextIsolation() {
  assert(resolveAuthsContextFromHost("drako.systems") === "drakos", "drako.systems should map to drakos.");
  assert(resolveAuthsContextFromHost("mentoria.drako.systems") === "mentorias", "mentoria host should map to mentorias.");
  assert(resolveAuthsContextFromHost("base.drako.systems") === "bases", "base host should map to bases.");
  console.log("PASS host context mapping is isolated.");
}

async function testBaseLegacyRegisterBlock() {
  process.env.AUTHS_ISOLATIONS_ENABLED = "true";
  process.env.AUTHS_LEGACY_COMPATS_ENABLED = "true";
  process.env.AUTHS_LEGACY_REGISTER_ENABLED = "0";

  const req = new Request("https://base.drako.systems/api/auth/register", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "base.drako.systems",
    },
    body: JSON.stringify({
      email: "base-user@test.local",
      password: "supersecurepass",
      name: "Base User",
    }),
  });
  const res = await legacyRegister(req);
  assert(res.status === 403 || res.status === 410, `Base register should be blocked (expected 403/410, got ${res.status}).`);
  console.log("PASS base host blocks legacy final-user registration.");
}

async function run() {
  console.log("Running auth isolation checks...");
  await testCookieIsolation();
  await testTokenIsolation();
  await testHostContextIsolation();
  await testBaseLegacyRegisterBlock();
  console.log("Auth isolation checks completed.");
}

run().catch((error) => {
  console.error("Auth isolation checks failed:", error);
  process.exit(1);
});
