import {
  buildSocialFlowLinkedInConnectUrl,
  handleSocialFlowLinkedInCallback,
} from "@/lib/socialflow/linkedin/oauth";
import { publishPost } from "@/lib/socialflow/linkedin/publishing";
import type { RuntimeSocialAccount } from "./contracts";

export function buildRuntimeLinkedInConnectUrl(input: {
  request: Request;
  tenantId: string;
  saasId: string;
  redirectTo?: string | null;
}) {
  return buildSocialFlowLinkedInConnectUrl(input);
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
  return handleSocialFlowLinkedInCallback(request, session);
}

export async function buildRuntimeLinkedInPublishResult(account: RuntimeSocialAccount, content: string) {
  return publishPost(account as never, content);
}
