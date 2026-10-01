import { env } from "@/lib/cf";
import { getPhysicalProfile } from "@/lib/socialflow/profile/physical-repository";
import { getEmployeesByTenant } from "@/lib/socialflow/employees/repository";
import { getSocialFlowAccountTypeByTenant } from "@/lib/socialflow/auth/account-type";
import type { EmpresaEmployee } from "@/lib/socialflow/employees/types";

const MODEL = "@cf/stabilityai/stable-diffusion-xl-base-1.0";
// SDXL base NO acepta imagen de entrada (400 "input tensor `image` is not present in the
// model") — pasarle la foto de referencia del perfil físico hacía fallar TODA generación
// de imagen de los tenants con reference_image_url (posts sin imagen → Instagram los
// rechazaba al publicar). img2img va con el modelo SD 1.5 img2img, a su resolución
// nativa; si falla (a 2026-09-26 la cuenta de Cloudflare devuelve 403 "not allowed to
// access" para este modelo), se cae a txt2img con SDXL — la referencia se pierde pero el
// post tiene imagen, y la descripción física sigue en el prompt.
const IMG2IMG_MODEL = "@cf/runwayml/stable-diffusion-v1-5-img2img";
const IMG2IMG_SIZE = 512;
const TXT2IMG_MAX_RETRIES = 2;
const TXT2IMG_RETRY_DELAY_MS = 2000;
const R2_PUBLIC_BASE = "https://pub-04c730a67921499bac35a1f62402cc17.r2.dev";
const EMPLOYEES_SAAS_ID = "socialflow";

const EMPLOYEE_HAIR_STYLE_LABELS: Record<string, string> = {
  liso: "liso",
  ondulado: "ondulado",
  rizado: "rizado",
  muy_rizado_afro: "muy rizado/afro",
};

// Rasgos físicos de un empleado (saas_empresa_employees) para que SDXL genere imágenes
// precisas de esa persona — mismo nivel de detalle que describePhysicalProfile() para
// influencer, pero por empleado en vez de por tenant.
function describeEmployeePhysicalTraits(e: EmpresaEmployee): string | null {
  const parts: string[] = [];

  const genderLabel = e.gender ? GENDER_LABELS[e.gender] : null;
  if (genderLabel) parts.push(genderLabel);

  if (e.age) parts.push(`${e.age} años`);

  const constitutionGroup = e.gender === "hombre" ? "hombre" : e.gender === "mujer" ? "mujer" : "otro";
  if (e.bodyConstitution) {
    const label = BODY_CONSTITUTION_LABELS[constitutionGroup][e.bodyConstitution];
    if (label) parts.push(`constitución ${label}`);
  }

  if (e.heightCm) parts.push(`${e.heightCm}cm`);
  if (e.weightKg) parts.push(`${e.weightKg}kg`);

  if (e.skinTone) parts.push(`tono de piel ${SKIN_TONE_LABELS[e.skinTone] ?? e.skinTone}`);

  const hairBits: string[] = [];
  if (e.hairColor) hairBits.push(e.hairColor);
  if (e.hairStyle) hairBits.push(EMPLOYEE_HAIR_STYLE_LABELS[e.hairStyle] ?? e.hairStyle);
  if (e.hairLength) hairBits.push(HAIR_LENGTH_LABELS[e.hairLength] ?? e.hairLength);
  if (hairBits.length) parts.push(`cabello ${hairBits.join(" ")}`);

  if (e.eyeColor) parts.push(`ojos ${e.eyeColor}`);
  if (e.faceShape) parts.push(`cara ${e.faceShape}`);
  if (e.tattoos) parts.push(e.tattoos);
  if (e.beard) parts.push(e.beard);

  if (!parts.length) return null;
  return parts.join(", ");
}

// Contexto de equipo para el prompt de SDXL — cuentas empresa no tienen physical_profile
// (eso es solo influencer); en su lugar, si hay empleados dados de alta en
// saas_empresa_employees (única fuente de verdad, ver /empresa/empleados), se le da
// contexto al modelo de quién puede aparecer en la foto y con qué aspecto físico.
function describeEmployeesForPrompt(employees: EmpresaEmployee[]): string | null {
  const active = employees.filter((e) => e.active);
  if (!active.length) return null;
  const entries = active.map((e) => {
    const roleSpecialty = [e.role, e.specialty ? `especialidad: ${e.specialty}` : null].filter(Boolean).join(", ");
    const parenthetical = roleSpecialty ? ` (${roleSpecialty})` : "";
    const description = e.description ? `: ${e.description}` : "";
    const physical = describeEmployeePhysicalTraits(e);
    const physicalSuffix = physical ? `. ${e.name} is ${physical}` : "";
    return `${e.name}${parenthetical}${description}${physicalSuffix}`;
  });
  return `Known team members: ${entries.join("; ")}`;
}

// SDXL (Workers AI) acepta negative_prompt de forma nativa — evita las anomalías de
// anatomía más comunes (manos/extremidades) en las imágenes generadas para posts.
const NEGATIVE_PROMPT =
  "deformed, extra limbs, twisted joints, bad anatomy, mutated hands, extra fingers, missing fingers, fused fingers, too many fingers, malformed limbs, missing arms, missing legs, extra arms, extra legs, mutated, ugly, blurry, low quality, watermark, text";

// Solo cuando el prompt no describe a nadie (sin perfil físico ni empleados): ahí
// la persona ES el sujeto de la imagen y estos términos la borrarían.
const NO_PEOPLE_NEGATIVE_PROMPT =
  "people, office, desk, chair, window, corporate, businessman, businesswoman";

const GENDER_LABELS: Record<string, string> = {
  mujer: "mujer",
  hombre: "hombre",
  no_binario: "persona no binaria",
};

const BODY_TYPE_LABELS: Record<string, string> = {
  atletica: "atlética",
  fibrada: "fibrada",
  normal: "normal",
  curvilinea: "curvilínea",
  musculosa: "musculosa",
};

const BODY_CONSTITUTION_LABELS: Record<"mujer" | "hombre" | "otro", Record<string, string>> = {
  mujer: { ectomorfo: "ectomorfa", mesomorfo: "mesomorfa", endomorfo: "endomorfa", mixto: "mixta" },
  hombre: { ectomorfo: "ectomorfo", mesomorfo: "mesomorfo", endomorfo: "endomorfo", mixto: "mixto" },
  otro: { ectomorfo: "ectomorfo", mesomorfo: "mesomorfo", endomorfo: "endomorfo", mixto: "mixto" },
};

const SKIN_TONE_LABELS: Record<string, string> = {
  muy_clara: "muy clara",
  clara: "clara",
  media: "media",
  olivacea: "olivácea",
  morena: "morena",
  oscura: "oscura",
  muy_oscura: "muy oscura",
};

const HAIR_COLOR_BASE_LABELS: Record<string, string> = {
  negro: "negro",
  castano_oscuro: "castaño oscuro",
  castano: "castaño",
  castano_claro: "castaño claro",
  rubio_oscuro: "rubio oscuro",
  rubio: "rubio",
  rubio_platino: "rubio platino",
  pelirrojo: "pelirrojo",
  canoso: "canoso",
  rapado_sin_cabello: "rapado/sin cabello",
};

const HAIR_STYLE_LABELS: Record<string, string> = {
  mechas_californianas: "mechas californianas",
  mechas_babylights: "mechas babylights",
  mechas_balayage: "mechas balayage",
  mechas_de_color: "mechas de color",
  ombre: "ombré",
  highlights: "highlights",
  tenido_fantasia: "teñido fantasía",
};

const HAIR_LENGTH_LABELS: Record<string, string> = {
  rapado: "rapado",
  muy_corto: "muy corto",
  corto: "corto",
  medio: "medio",
  largo: "largo",
  muy_largo: "muy largo",
};

const HAIR_TEXTURE_LABELS: Record<string, string> = {
  liso: "liso",
  ondulado: "ondulado",
  rizado: "rizado",
  muy_rizado: "muy rizado/afro",
  con_mechas: "con mechas",
  con_highlights: "con highlights",
};

const FACE_SHAPE_LABELS: Record<string, string> = {
  ovalada: "ovalada",
  redonda: "redonda",
  cuadrada: "cuadrada",
  corazon: "corazón",
  alargada: "alargada",
};

const EYE_COLOR_LABELS: Record<string, string> = {
  marrones: "marrones",
  verdes: "verdes",
  azules: "azules",
  grises: "grises",
  miel: "miel",
  negros: "negros",
  heterocromia: "heterocromía",
};

const CONTENT_VISUAL_STYLE_LABELS: Record<string, string> = {
  minimalista: "minimalista",
  colorido_vibrante: "colorido y vibrante",
  oscuro_moody: "oscuro y moody",
  natural_sin_filtros: "natural sin filtros",
  glamuroso: "glamuroso",
  deportivo_raw: "deportivo raw",
  profesional_limpio: "profesional y limpio",
};

const TATTOOS_LABELS: Record<string, string> = {
  pequenos_discretos: "tatuajes pequeños discretos",
  brazo: "tatuaje en brazo",
  espalda: "tatuaje en espalda",
  cuello_manos: "tatuajes en cuello/manos",
  muy_tatuado: "muy tatuado/a",
};

const BEARD_LABELS: Record<string, string> = {
  corta: "barba corta",
  larga: "barba larga",
  bigote: "bigote",
};

async function readStream(stream: ReadableStream<Uint8Array>): Promise<ArrayBuffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged.buffer as ArrayBuffer;
}

function joinNatural(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

function computeBmi(heightCm: number | null, weightKg: number | null): number | null {
  if (!heightCm || !weightKg) return null;
  const heightM = heightCm / 100;
  if (heightM <= 0) return null;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

function describePhysicalProfile(profile: Awaited<ReturnType<typeof getPhysicalProfile>>): string | null {
  if (!profile) return null;
  const parts: string[] = [];

  const genderLabel = profile.gender ? GENDER_LABELS[profile.gender] : null;
  if (genderLabel) parts.push(genderLabel);

  const constitutionGroup = profile.gender === "hombre" ? "hombre" : profile.gender === "mujer" ? "mujer" : "otro";
  if (profile.bodyConstitution) {
    const label = BODY_CONSTITUTION_LABELS[constitutionGroup][profile.bodyConstitution];
    if (label) parts.push(`constitución ${label}`);
  }

  const bmi = computeBmi(profile.heightCm, profile.weightKg);
  const bodyTypeLabel = profile.bodyType ? BODY_TYPE_LABELS[profile.bodyType] : null;
  if (bodyTypeLabel && bmi) {
    parts.push(`figura ${bodyTypeLabel} (IMC ${bmi})`);
  } else if (bodyTypeLabel) {
    parts.push(`figura ${bodyTypeLabel}`);
  } else if (bmi) {
    parts.push(`IMC ${bmi}`);
  }

  if (profile.heightCm) parts.push(`${profile.heightCm}cm`);

  if (profile.skinTone) parts.push(`tono de piel ${SKIN_TONE_LABELS[profile.skinTone] ?? profile.skinTone}`);

  const hairBits: string[] = [];
  if (profile.hairColorBase) hairBits.push(HAIR_COLOR_BASE_LABELS[profile.hairColorBase] ?? profile.hairColorBase);
  if (profile.hairStyle && profile.hairStyle !== "sin_tratamiento") {
    hairBits.push(`con ${HAIR_STYLE_LABELS[profile.hairStyle] ?? profile.hairStyle}`);
  }
  if (profile.hairLength) hairBits.push(HAIR_LENGTH_LABELS[profile.hairLength] ?? profile.hairLength);
  if (profile.hairTexture) hairBits.push(HAIR_TEXTURE_LABELS[profile.hairTexture] ?? profile.hairTexture);
  if (hairBits.length) parts.push(`cabello ${hairBits.join(" ")}`);

  if (profile.eyeColor) parts.push(`ojos ${EYE_COLOR_LABELS[profile.eyeColor] ?? profile.eyeColor}`);
  if (profile.faceShape) parts.push(`cara ${FACE_SHAPE_LABELS[profile.faceShape] ?? profile.faceShape}`);

  if (profile.contentVisualStyle?.length) {
    const labels = profile.contentVisualStyle.map((v) => CONTENT_VISUAL_STYLE_LABELS[v] ?? v);
    parts.push(`estilo visual ${joinNatural(labels)}`);
  }

  if (profile.tattoos && profile.tattoos !== "sin_tatuajes") {
    const label = TATTOOS_LABELS[profile.tattoos];
    if (label) parts.push(`con ${label}`);
  }

  if (profile.beard && profile.beard !== "sin_barba") {
    const label = BEARD_LABELS[profile.beard];
    if (label) parts.push(label);
  }

  if (profile.fitnessStyles?.length) parts.push(`estilo ${joinNatural(profile.fitnessStyles)}`);

  if (!parts.length) return null;
  return parts.join(", ");
}

export async function generatePostImage(prompt: string, postId: string, tenantId?: string | null): Promise<string | null> {
  const e = env();
  if (!e?.AI || !e?.SOCIAL_MEDIA_BUCKET) {
    console.warn("IMAGE_GEN_SKIPPED: AI or SOCIAL_MEDIA_BUCKET binding not available");
    return null;
  }

  const physicalProfile = tenantId ? await getPhysicalProfile(tenantId).catch(() => null) : null;
  const physicalDescription = describePhysicalProfile(physicalProfile);

  const accountType = tenantId ? await getSocialFlowAccountTypeByTenant(tenantId).catch(() => null) : null;
  const employees =
    accountType === "empresa" && tenantId
      ? await getEmployeesByTenant(tenantId, EMPLOYEES_SAAS_ID).catch(() => [])
      : [];
  const employeeDescription = describeEmployeesForPrompt(employees);

  const promptWithPhysical = physicalDescription ? `${prompt}, ${physicalDescription}` : prompt;
  const finalPrompt = employeeDescription ? `${promptWithPhysical}. ${employeeDescription}` : promptWithPhysical;
  const negativePrompt = physicalDescription || employeeDescription
    ? NEGATIVE_PROMPT
    : `${NEGATIVE_PROMPT}, ${NO_PEOPLE_NEGATIVE_PROMPT}`;

  let referenceImage: number[] | null = null;
  if (physicalProfile?.referenceImageUrl) {
    try {
      const refResponse = await fetch(physicalProfile.referenceImageUrl);
      if (refResponse.ok) {
        const refBuffer = await refResponse.arrayBuffer();
        referenceImage = Array.from(new Uint8Array(refBuffer));
      }
    } catch (err) {
      console.warn("IMAGE_GEN_REFERENCE_IMAGE_FETCH_FAILED", { postId, error: err instanceof Error ? err.message : String(err) });
    }
  }

  const ai = e.AI;
  const runModel = async (model: string, inputs: Record<string, unknown>): Promise<ArrayBuffer> => {
    const response = await (ai.run as (m: string, i: Record<string, unknown>) => Promise<unknown>).call(ai, model, inputs);
    if (response instanceof ReadableStream) return readStream(response as ReadableStream<Uint8Array>);
    if (response instanceof ArrayBuffer) return response;
    if (response instanceof Uint8Array) return response.buffer as ArrayBuffer;
    throw new Error(`IMAGE_GEN_UNEXPECTED_RESPONSE_TYPE from ${model}`);
  };

  try {
    let imageBuffer: ArrayBuffer | null = null;
    if (referenceImage) {
      try {
        imageBuffer = await runModel(IMG2IMG_MODEL, {
          prompt: finalPrompt,
          negative_prompt: negativePrompt,
          num_steps: 20,
          width: IMG2IMG_SIZE,
          height: IMG2IMG_SIZE,
          image: referenceImage,
          strength: 0.35,
        });
      } catch (img2imgErr) {
        console.warn("IMAGE_GEN_IMG2IMG_FAILED_FALLING_BACK_TO_TXT2IMG", {
          postId,
          error: img2imgErr instanceof Error ? img2imgErr.message : String(img2imgErr),
        });
      }
    }

    // Reintentos solo para txt2img con SDXL (img2img ya tiene su propio fallback
    // arriba): fallos transitorios de Workers AI dejaban posts de Instagram en DRAFT
    // con IMAGE_GENERATION_FAILED. Si se agotan los intentos, el último error sube al
    // catch de abajo y se devuelve null como siempre.
    for (let attempt = 1; !imageBuffer; attempt++) {
      try {
        imageBuffer = await runModel(MODEL, {
          prompt: finalPrompt,
          negative_prompt: negativePrompt,
          num_steps: 20,
          width: 1024,
          height: 1024,
        });
      } catch (txt2imgErr) {
        if (attempt > TXT2IMG_MAX_RETRIES) throw txt2imgErr;
        console.warn("IMAGE_GEN_TXT2IMG_RETRY", {
          postId,
          attempt,
          error: txt2imgErr instanceof Error ? txt2imgErr.message : String(txt2imgErr),
        });
        await new Promise((resolve) => setTimeout(resolve, TXT2IMG_RETRY_DELAY_MS));
      }
    }

    const key = `posts/${postId}/ai-image.png`;
    await e.SOCIAL_MEDIA_BUCKET.put(key, imageBuffer, {
      httpMetadata: { contentType: "image/png" },
    });

    const publicUrl = `${R2_PUBLIC_BASE}/${key}`;
    console.log("IMAGE_GEN_OK", { postId, key, bytes: imageBuffer.byteLength });
    return publicUrl;
  } catch (err) {
    console.error("IMAGE_GEN_FAILED", {
      postId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
