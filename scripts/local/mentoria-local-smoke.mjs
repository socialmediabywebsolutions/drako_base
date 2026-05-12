import process from "node:process";

const baseUrl = (process.env.BASE_URL ?? "http://localhost:8787").trim().replace(/\/$/, "");
const hostQuery = "__drako_host=mentoria.drako.systems";
const email = `mentoria-local-${Date.now()}@local.dev`;
const password = "12345678";

function failureWithHint(step, status, text) {
  const body = text?.trim() ? text : "EMPTY_BODY";
  return new Error(`${step}:${status}:${body}:hint=run pnpm mentoria:local:bootstrap:align-worker and verify MENTORIA_DB + MENTORIAS_AUTHS_DB local migrations`);
}

function parseSetCookies(headers) {
  const values = [];
  for (const [key, value] of headers.entries()) {
    if (key.toLowerCase() === "set-cookie") values.push(value);
  }
  return values;
}

function extractCookie(setCookies, name) {
  for (const entry of setCookies) {
    for (const part of entry.split(",")) {
      const segment = part.trim();
      if (segment.startsWith(`${name}=`)) return segment.split(";")[0];
    }
  }
  return "";
}

async function fetchText(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  return { res, text };
}

function assertNot405(step, res) {
  if (res.status === 405) throw new Error(`${step}_CANONICAL_405_NOT_ALLOWED`);
}

function assertNoDummySuccess(step, text) {
  const normalized = text.toLowerCase();
  if (/"success"\s*:\s*true/.test(text) || normalized.includes("dummy") || normalized.includes("stub")) {
    throw new Error(`${step}_DUMMY_SUCCESS_RESPONSE_DETECTED`);
  }
  if (normalized.includes("placeholder")) {
    throw new Error(`${step}_PLACEHOLDER_RESPONSE_DETECTED`);
  }
}

function assertOkJson(step, text) {
  if (!/"ok"\s*:\s*true/.test(text)) {
    throw new Error(`${step}_MISSING_OK_JSON`);
  }
}

const landing = await fetchText(`${baseUrl}/site/mentoria`);
if (!landing.res.ok) throw new Error(`LANDING_FAILED:${landing.res.status}`);
if (!landing.text.includes("__drako_host=mentoria.drako.systems")) throw new Error("LANDING_MISSING_DRAKO_HOST_PARAM");
if (landing.text.includes("localhost:8787")) throw new Error("LANDING_LEAKS_8787");
if (landing.text.includes("https://localhost")) throw new Error("LANDING_LEAKS_HTTPS_LOCALHOST");
if (landing.text.includes("SOCIALFLOW_RUNTIME_MISWIRED")) throw new Error("LANDING_RENDERED_FOREIGN_RUNTIME_MISWIRE");
if (landing.text.toLowerCase().includes("placeholder")) throw new Error("LANDING_PLACEHOLDER_HTML_DETECTED");
if (/"success"\s*:\s*true/.test(landing.text)) throw new Error("LANDING_DUMMY_SUCCESS_RESPONSE_DETECTED");

const register = await fetchText(`${baseUrl}/api/mentorias/auths/registrations?${hostQuery}`, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ email, password, name: "Mentoria Local QA" }),
});
assertNot405("REGISTER", register.res);
assertNoDummySuccess("REGISTER", register.text);
if (register.res.status !== 201) throw failureWithHint("REGISTER_FAILED", register.res.status, register.text);
assertOkJson("REGISTER", register.text);

const login = await fetchText(`${baseUrl}/api/mentorias/auths/logins?${hostQuery}`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email, password }),
});
assertNot405("LOGIN", login.res);
assertNoDummySuccess("LOGIN", login.text);
if (login.res.status !== 200) throw failureWithHint("LOGIN_FAILED", login.res.status, login.text);
assertOkJson("LOGIN", login.text);

const sessionCookie = extractCookie(parseSetCookies(login.res.headers), "__Host-mentorias_session")
  || extractCookie(parseSetCookies(register.res.headers), "__Host-mentorias_session")
  || extractCookie(parseSetCookies(login.res.headers), "mentorias_session")
  || extractCookie(parseSetCookies(register.res.headers), "mentorias_session");
if (!sessionCookie) throw new Error("SESSION_COOKIE_MISSING");

const onboardingGet = await fetchText(`${baseUrl}/api/mentoria/onboarding`, {
  headers: { cookie: sessionCookie },
});
assertNot405("ONBOARDING_GET", onboardingGet.res);
assertNoDummySuccess("ONBOARDING_GET", onboardingGet.text);
if (onboardingGet.res.status !== 200) throw failureWithHint("ONBOARDING_GET_FAILED", onboardingGet.res.status, onboardingGet.text);
assertOkJson("ONBOARDING_GET", onboardingGet.text);

const onboardingPost = await fetchText(`${baseUrl}/api/mentoria/onboarding`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie: sessionCookie },
  body: JSON.stringify({
    fullName: "Alumno Canonico",
    age: 12,
    schoolYear: "1 ESO",
    subjects: [{ subjectSlug: "matematicas", initialLevel: "voy_normal" }],
    parents: [{
      slot: "Parent A",
      fullName: "Tutor Canonico",
      email: `parent-${Date.now()}@local.dev`,
      dailyStudyMinutes: 30,
      supervisionLevel: "balanced",
    }],
    objective: "improve_understanding",
    confidenceLevel: "medium",
    learningPreference: "step_by_step",
  }),
});
assertNot405("ONBOARDING_POST", onboardingPost.res);
assertNoDummySuccess("ONBOARDING_POST", onboardingPost.text);
if (onboardingPost.res.status !== 200) throw failureWithHint("ONBOARDING_POST_FAILED", onboardingPost.res.status, onboardingPost.text);
assertOkJson("ONBOARDING_POST", onboardingPost.text);

const workspace = await fetchText(`${baseUrl}/api/mentoria/workspace`, {
  headers: { cookie: sessionCookie },
});
assertNot405("WORKSPACE", workspace.res);
assertNoDummySuccess("WORKSPACE", workspace.text);
if (workspace.res.status !== 200) throw failureWithHint("WORKSPACE_FAILED", workspace.res.status, workspace.text);
assertOkJson("WORKSPACE", workspace.text);

const profile = await fetchText(`${baseUrl}/api/mentoria/profile`, {
  headers: { cookie: sessionCookie },
});
assertNot405("PROFILE", profile.res);
assertNoDummySuccess("PROFILE", profile.text);
if (profile.res.status !== 200) throw failureWithHint("PROFILE_FAILED", profile.res.status, profile.text);
assertOkJson("PROFILE", profile.text);

console.log(`MENTORIA_SMOKE_OK base_url=${baseUrl}`);
console.log(`SIGNUP=PASS LOGIN=PASS ONBOARDING=PASS WORKSPACE=PASS PROFILE=PASS`);
