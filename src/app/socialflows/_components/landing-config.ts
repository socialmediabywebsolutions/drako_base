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
    a: "Hoy SocialCors publica en Instagram y LinkedIn. Puedes conectarlas desde el propio panel.",
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
