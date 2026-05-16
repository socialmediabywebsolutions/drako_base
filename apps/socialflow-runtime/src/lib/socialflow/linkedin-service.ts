import type { RuntimeSocialAccount } from "./contracts";
import {
  buildRuntimeLinkedInConnectUrl as buildRuntimeLinkedInConnectUrlLocal,
  handleRuntimeLinkedInCallback as handleRuntimeLinkedInCallbackLocal,
} from "./linkedin/oauth";
import { publishRuntimeLinkedInPost } from "./linkedin/publishing";

export function buildRuntimeLinkedInConnectUrl(input: {
  request: Request;
  tenantId: string;
  saasId: string;
  redirectTo?: string | null;
}) {
  return buildRuntimeLinkedInConnectUrlLocal(input);
}

export async function handleRuntimeLinkedInCallback(
  request: Request,
  session: {
    userId: string;
    email: string;
    tenantId: string;
    role: "admin" | "user";
    issuedAt: number;
    authMode: "isolated";
  } | null,
) {
  return handleRuntimeLinkedInCallbackLocal(request, session);
}

export async function buildRuntimeLinkedInPublishResult(account: RuntimeSocialAccount, content: string) {
  return publishRuntimeLinkedInPost(account, content);
}
