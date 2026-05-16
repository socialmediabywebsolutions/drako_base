import {
  getChannelKnowledge,
  upsertChannelCompetitor,
  upsertChannelProfile,
} from "@/lib/socialflow/profile/repository";

export function getRuntimeChannelKnowledge(tenantId: string) {
  return getChannelKnowledge(tenantId);
}

export function saveRuntimeChannelProfile(tenantId: string, profile: unknown) {
  return upsertChannelProfile(tenantId, profile as Record<string, unknown>);
}

export function saveRuntimeChannelCompetitor(tenantId: string, competitor: unknown) {
  return upsertChannelCompetitor(tenantId, competitor as Record<string, unknown>);
}
