export type SocialCampaign = {
  id: string;
  name: string;
  status: string;
};

export type SocialPost = {
  id: string;
  title: string;
  body: string;
  status: string;
  campaignId: string | null;
  campaignName?: string | null;
  scheduledAt: string | null;
  postedAt: string | null;
};
