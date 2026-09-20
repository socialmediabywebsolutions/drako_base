// Datos legales REALES del titular de SocialCors, facilitados por el propietario. Fuente única para
// todas las páginas legales: si algo cambia, se cambia SOLO aquí. No inventar ni completar datos.
export const LEGAL_HOLDER = {
  name: "Cristóbal Cors Bernal",
  dni: "79231401N",
  address: "Calle Ruayer 15, Casomera, Aller, Asturias, España",
  email: "info@socialcors.com",
  web: "socialcors.com",
  webUrl: "https://socialcors.com",
  activity: "Plataforma SaaS de automatización de marketing y redes sociales con IA",
} as const;

export const LEGAL_UPDATED_LABEL = "septiembre de 2026";

// Línea de copyright de los pies (páginas legales y Home).
export const LEGAL_COPYRIGHT = "© 2026 Cristóbal Cors Bernal · SocialCors";

// Directorio de autoridades de protección de datos de la UE (EDPB), para que cada usuario encuentre la suya.
export const EDPB_MEMBERS_URL = "https://edpb.europa.eu/about-edpb/about-edpb/members_es";

// Documentos legales (navegación cruzada en el pie de las páginas legales).
export const LEGAL_LINKS = [
  { label: "Aviso Legal", href: "/aviso-legal" },
  { label: "Política de Privacidad", href: "/privacidad" },
  { label: "Política de Cookies", href: "/cookies" },
  { label: "Términos y Condiciones", href: "/terminos" },
  { label: "DPA", href: "/dpa" },
  { label: "Contacto", href: "/contacto" },
] as const;
