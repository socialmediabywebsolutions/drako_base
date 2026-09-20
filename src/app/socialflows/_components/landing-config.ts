// Datos del Home que dependen del estado REAL del producto. Si cambia algo aquí, cambia
// lo que promete el Home — verificar contra el código antes de tocar.

// Días de prueba: los fija src/app/api/socialflow/auths/registrations/route.ts
// (`15 * 24 * 60 * 60 * 1000`). Deben coincidir con el prompt de
// src/app/api/socialflow/public/chat/route.ts, /socialflow/auth, /socialflow/planes y el
// onboarding (plans / plans-empresa). Los trials creados antes del cambio siguen en 7 días.
export const TRIAL_DAYS = 15;

// URL del vídeo de demostración real. Mientras sea null, el Home NO muestra el botón
// "Ver la demostración" ni ningún reproductor: solo el recorrido del proceso.
// Cuando exista el vídeo (mp4/webm en public/ o URL absoluta), basta con rellenar esto.
export const DEMO_VIDEO_URL: string | null = null;

// ?mode=register abre /socialflow/auth directamente en la pestaña "Crear cuenta".
export const HREF_START = "/socialflow/auth?mode=register";
export const HREF_PLANS = "/socialflow/planes";
export const HREF_LOGIN = "/socialflow/auth";

export const SITE_URL = "https://socialcors.com";
export const LOGO_URL = "https://pub-3e782268d66e465bbe7c7fa767074ee2.r2.dev/assets/logo-perfil.png";
// Logo de cabecera (1536×1024, con su fondo oscuro): se usa tal cual, sin recortar ni redibujar.
export const LOGO_HEADER_URL = "https://pub-3e782268d66e465bbe7c7fa767074ee2.r2.dev/assets/logo-cabecera.png";

export const HEADLINE = "Tú haces la foto. SocialCors hace el resto.";
export const SUBHEADLINE =
  "Convierte tus fotos y vídeos en contenido para tus redes sociales, adaptado a tu negocio y preparado para publicar.";

// Redes que SocialCors muestra como disponibles en el Home.
// - Instagram: OAuth Meta + publicación (posts, reels, historias).
// - LinkedIn: SOLO perfil personal (scope w_member_social, imagen principal). Sin Company Page:
//   `w_organization_social` sigue apagado (SOCIALFLOW_LINKEDIN_ORGANIZATION_SCOPE_ENABLED) y
//   `linkedin_cm_enabled` es false en todas las cuentas — NO mencionar Company Page en el Home.
//   NOTA INTERNA: no está confirmado desde el repo que LINKEDIN_CLIENT_ID/SECRET estén puestos
//   en el Worker de producción (los lista apps/socialflow-runtime/runtime-deploy-contract.json
//   como secretos requeridos, pero el workflow de deploy no los inyecta). Se muestra igual por
//   decisión del owner: el flujo existe y la app "Share on LinkedIn" está aprobada.
// - TikTok/YouTube están `comingSoon` en /socialflow/redes; Facebook Page tiene publicación en
//   código (live-publishing.ts) pero no se lista hasta confirmarla en producción.
export const AVAILABLE_NETWORKS = [
  { key: "instagram", name: "Instagram", detail: "Posts, reels e historias" },
  { key: "linkedin", name: "LinkedIn", detail: "Publicaciones con imagen" },
] as const;

// ── Redes VERIFICADAS como activas en producción (las usa el motor de SocialCors) ─────────────
// Criterio: cuenta conectada Y publicaciones reales completadas con id externo. Que exista código
// o un botón de conexión NO basta. Comprobado con consultas de solo lectura sobre
// saas_socialflows_prod_db el 2026-09-20 (solo recuentos agregados, sin datos personales):
//   INSTAGRAM  4 cuentas CONNECTED_REAL · 200 posts POSTED con external_post_id ·
//              última publicación 2026-09-16 · 1.102 registros de métricas (última captura 2026-09-20)
//              → ACTIVA Y FUNCIONANDO.
//   LINKEDIN   1 cuenta CONNECTED_REAL (sin actividad desde 2026-05-21) + 2 DISCONNECTED ·
//              0 posts POSTED (61 CANCELLED, 2 REJECTED)
//              → conectable, pero SIN ninguna publicación completada: NO se muestra como activa.
//   FACEBOOK   0 cuentas, 0 posts → no activa.   TIKTOK / YOUTUBE → `comingSoon` en el producto.
// Antes de añadir una red aquí, repetir la comprobación (cuenta conectada + posts POSTED recientes).
export const VERIFIED_ACTIVE_NETWORKS = [
  { key: "instagram", name: "Instagram", detail: "Posts, reels e historias" },
] as const;

// ── Cifras reales de cada red (opcional) ──────────────────────────────────────────────────────
// null = el Home NO muestra ninguna cifra (solo la estructura visual). El Home es público y no
// tiene acceso a BD, y las métricas de los clientes son privadas: solo se rellena con datos REALES
// y autorizados (p. ej. la cuenta propia @socialcors), siempre con `source` y `asOf`. Nunca
// inventar valores. Los campos son opcionales: solo se pintan los que existan.
// NOTA: /api/socialflow/public/stats existe pero hoy devuelve 0/0/0 en producción (lee el binding
// `DB` en vez de `SOCIAL_DB`) y mezcla todos los proveedores; no usarlo como fuente.
export type NetworkStats = {
  followers?: number;
  posts?: number;
  likes?: number;
  comments?: number;
  views?: number;
  source: string; // p. ej. "@socialcors"
  asOf: string; // fecha de los datos, p. ej. "20 sep 2026"
};
export const NETWORK_STATS: Record<(typeof VERIFIED_ACTIVE_NETWORKS)[number]["key"], NetworkStats | null> = {
  instagram: null,
};

// ── Mini interfaces de Redes ──────────────────────────────────────────────────────────────────
// SIN cifras: el Home no muestra ninguna métrica inventada. Solo el nombre de ejemplo de cada panel
// y un mensaje hasta que existan métricas reales y autorizadas de cuentas propias.
export const EXAMPLE_LABEL = "Vista de ejemplo";
export const SOON_LABEL = "Próximamente";
export const METRICS_SOON_MESSAGE = "Las métricas reales de nuestras cuentas estarán disponibles próximamente.";
export const EXAMPLE_PANELS = {
  instagram: { handle: "@negocioejemplo" },
  linkedin: { handle: "Tu negocio" },
} as const;

// Redes que se muestran como "Próximamente" (conectables o en código, pero SIN publicaciones reales
// confirmadas en producción). LinkedIn: 0 publicaciones completadas a 2026-09-20. Para sacarla de
// aquí hace falta confirmar publicaciones reales (ver VERIFIED_ACTIVE_NETWORKS).
export const SOON_NETWORKS: readonly string[] = ["linkedin"];

export const FAQ: { q: string; a: string }[] = [
  {
    q: "¿Qué es SocialCors?",
    a: "Una plataforma que convierte tus fotos y vídeos en contenido para tus redes: propone el texto, los hashtags, el formato y el mejor momento para publicar, usando la información de tu negocio.",
  },
  {
    q: "¿Necesito saber de redes sociales?",
    a: "No. Tú aportas la foto o el vídeo. SocialCors te propone el caption, los hashtags, el formato (post, reel o historia) y la hora, y tú decides qué se publica.",
  },
  {
    q: "¿Qué tengo que subir?",
    a: "Fotos o vídeos de tu negocio. Además, en Mi Perfil y en la Base de conocimiento puedes añadir información para que el contenido tenga contexto: descripción, tono, público, documentos PDF, tu web, tu catálogo o tus competidores.",
  },
  {
    q: "¿Cómo utiliza SocialCors la información de mi negocio?",
    a: "Usa tu perfil y tu Base de conocimiento como contexto al generar cada pieza, para que el texto hable de tu negocio y con tu tono, no con frases genéricas.",
  },
  {
    q: "¿Qué redes sociales puedo conectar?",
    a: "Hoy SocialCors publica en Instagram, que puedes conectar desde el propio panel. LinkedIn llegará próximamente.",
  },
  {
    q: "¿Puedo revisar el contenido antes de publicarlo?",
    a: "Sí. Al subir tus fotos o vídeos, cada pieza generada puedes editarla y aprobarla antes de que se programe.",
  },
  {
    q: `¿Cómo funciona la prueba?`,
    a: `Tienes ${TRIAL_DAYS} días gratis, sin tarjeta de crédito, y puedes cancelar cuando quieras. Después eliges el plan que mejor se adapte a ti en la página de planes.`,
  },
];
