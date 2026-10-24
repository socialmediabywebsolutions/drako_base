export const dynamic = "force-dynamic";

import { getSocialFlowRuntimeHealthSnapshot } from "../../../../../lib/runtime-readiness";
import { runtimeJson } from "../../../../../lib/runtime-observability";

export async function GET(request: Request) {
  return runtimeJson(getSocialFlowRuntimeHealthSnapshot(), { status: 200 }, { request });
}
