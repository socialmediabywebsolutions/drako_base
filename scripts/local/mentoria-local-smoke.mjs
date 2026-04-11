import process from "node:process";

const baseUrl = (process.env.BASE_URL ?? "http://localhost:8787").trim().replace(/\/$/, "");
const hostQuery = "__drako_host=mentoria.drako.systems";
const email = `mentoria-local-${Date.now()}@local.dev`;
const password = "12345678";

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

const landing = await fetchText(`${baseUrl}/site/mentoria`);
if (!landing.res.ok) throw new Error(`LANDING_FAILED:${landing.res.status}`);
if (!landing.text.includes("__drako_host=mentoria.drako.systems")) throw new Error("LANDING_MISSING_DRAKO_HOST_PARAM");
if (landing.text.includes("localhost:8787")) throw new Error("LANDING_LEAKS_8787");
if (landing.text.includes("https://localhost")) throw new Error("LANDING_LEAKS_HTTPS_LOCALHOST");

const register = await fetchText(`${baseUrl}/api/mentorias/auths/registrations?${hostQuery}`, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ email, password, name: "Mentoria Local QA" }),
});
if (register.res.status !== 201) throw new Error(`REGISTER_FAILED:${register.res.status}:${register.text}`);

const login = await fetchText(`${baseUrl}/api/mentorias/auths/logins?${hostQuery}`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email, password }),
});
if (login.res.status !== 200) throw new Error(`LOGIN_FAILED:${login.res.status}:${login.text}`);

const sessionCookie = extractCookie(parseSetCookies(login.res.headers), "__Host-mentorias_session")
  || extractCookie(parseSetCookies(register.res.headers), "__Host-mentorias_session")
  || extractCookie(parseSetCookies(login.res.headers), "mentorias_session")
  || extractCookie(parseSetCookies(register.res.headers), "mentorias_session");
if (!sessionCookie) throw new Error("SESSION_COOKIE_MISSING");

const onboardingGet = await fetchText(`${baseUrl}/api/mentoria/onboarding`, {
  headers: { cookie: sessionCookie },
});
if (onboardingGet.res.status !== 200) throw new Error(`ONBOARDING_GET_FAILED:${onboardingGet.res.status}:${onboardingGet.text}`);

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
if (onboardingPost.res.status !== 200) throw new Error(`ONBOARDING_POST_FAILED:${onboardingPost.res.status}:${onboardingPost.text}`);

const workspace = await fetchText(`${baseUrl}/api/mentoria/workspace`, {
  headers: { cookie: sessionCookie },
});
if (workspace.res.status !== 200) throw new Error(`WORKSPACE_FAILED:${workspace.res.status}:${workspace.text}`);

console.log(`MENTORIA_SMOKE_OK base_url=${baseUrl}`);
console.log(`SIGNUP=PASS LOGIN=PASS ONBOARDING=PASS WORKSPACE=PASS`);
