import {
  getRuntimeChannelKnowledgeFromDb,
  saveRuntimeChannelCompetitorInDb,
  saveRuntimeChannelProfileInDb,
  SocialContextError,
} from "./profile-repository";

export { SocialContextError };

export function getRuntimeChannelKnowledge(tenantId: string) {
  return getRuntimeChannelKnowledgeFromDb(tenantId);
}

export function saveRuntimeChannelProfile(tenantId: string, profile: unknown) {
  return saveRuntimeChannelProfileInDb(tenantId, profile);
}

export function saveRuntimeChannelCompetitor(tenantId: string, competitor: unknown) {
  return saveRuntimeChannelCompetitorInDb(tenantId, competitor);
}
