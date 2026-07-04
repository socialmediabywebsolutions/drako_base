import type { SaasSocialProvider } from "@/lib/social-core/types";

export type SocialFlowNetworkKey = SaasSocialProvider | "YOUTUBE";

export const SOCIAL_PROVIDER_LABEL: Record<SocialFlowNetworkKey, string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK_PAGE: "Facebook",
  LINKEDIN: "LinkedIn",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  WHATSAPP: "WhatsApp",
  TWITTER_X: "X / Twitter",
  OTHER: "Otra red",
};

export const SOCIAL_PROVIDER_ABBR: Record<SocialFlowNetworkKey, string> = {
  INSTAGRAM: "IG",
  FACEBOOK_PAGE: "FB",
  LINKEDIN: "LI",
  TIKTOK: "TT",
  YOUTUBE: "YT",
  WHATSAPP: "WA",
  TWITTER_X: "X",
  OTHER: "?",
};

// Mismos tonos que src/components/socialflow/editorial-calendar.tsx para LINKEDIN/INSTAGRAM/FACEBOOK_PAGE/TIKTOK.
export const SOCIAL_PROVIDER_COLOR: Record<SocialFlowNetworkKey, string> = {
  INSTAGRAM: "bg-rose-500 text-white",
  FACEBOOK_PAGE: "bg-blue-600 text-white",
  LINKEDIN: "bg-sky-600 text-white",
  TIKTOK: "bg-white/10 text-white",
  YOUTUBE: "bg-red-600 text-white",
  WHATSAPP: "bg-emerald-600 text-white",
  TWITTER_X: "bg-white/15 text-white",
  OTHER: "bg-white/10 text-white",
};
