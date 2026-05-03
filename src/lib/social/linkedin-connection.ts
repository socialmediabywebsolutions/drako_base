/**
 * @deprecated Import LinkedIn persistence from "@/lib/socialflow/linkedin/repository".
 * This file remains as a legacy compatibility facade while SocialFlow
 * LinkedIn is verticalized under src/lib/socialflow/linkedin.
 */
export {
  persistSocialFlowLinkedInConnection as persistLinkedInConnection,
} from "@/lib/socialflow/linkedin/repository";

export type {
  PersistLinkedInConnectionResult,
} from "@/lib/socialflow/linkedin/repository";
