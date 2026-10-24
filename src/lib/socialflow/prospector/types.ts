export type ProspectStatus =
  | "DISCOVERED"    // encontrado, sin contactar
  | "EMAIL_SENT"    // primer email enviado
  | "WA_SENT"       // WhatsApp enviado
  | "REPLIED"       // respondió (positivo o negativo)
  | "DEMO_BOOKED"   // demo / llamada agendada
  | "CONVERTED"     // cliente de pago
  | "LOST";         // descartado

export type ProspectSource =
  | "GOOGLE_MAPS"   // buscado via Places API
  | "AI_GENERATED"  // generado por Mistral como sugerencia
  | "MANUAL";       // añadido a mano por el operador

export type SocialFlowProspect = {
  id: string;
  tenantId: string;
  saasId: string;
  campaignId: string | null;

  // Datos del negocio
  businessName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  instagramHandle: string | null;

  // Contexto
  niche: string;
  location: string;
  description: string | null;       // breve descripción pública del negocio
  source: ProspectSource;
  rating: number | null;            // valoración Google Maps (1-5)
  reviewCount: number | null;

  // Campaña
  status: ProspectStatus;
  outreachCount: number;            // número de veces contactado
  lastOutreachAt: string | null;
  notes: string | null;

  createdAt: string;
  updatedAt: string;
};

export type SocialFlowCampaign = {
  id: string;
  tenantId: string;
  saasId: string;

  name: string;
  niche: string;
  location: string;
  status: "ACTIVE" | "PAUSED" | "COMPLETED";

  prospectCount: number;
  emailSentCount: number;
  repliedCount: number;
  convertedCount: number;

  createdAt: string;
  updatedAt: string;
};

export type OutreachResult = {
  ok: boolean;
  channel: "EMAIL" | "WHATSAPP";
  code?: string;
};
