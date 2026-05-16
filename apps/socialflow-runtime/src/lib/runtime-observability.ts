import { NextResponse } from "next/server";
import {
  getSocialFlowRuntimeActivationState,
  getSocialFlowRuntimeContractVersion,
  getSocialFlowRuntimeTarget,
  socialFlowRuntimeDeployContract,
} from "./runtime-contract";

type RuntimeLogLevel = "log" | "warn" | "error";

function readHeadersLike(input?: Request | Headers | null): Headers | null {
  if (!input) return null;
  return input instanceof Headers ? input : input.headers;
}

export function getRuntimeCorrelationId(input?: Request | Headers | null): string {
  const headers = readHeadersLike(input);
  const headerName = socialFlowRuntimeDeployContract.observability.correlationHeader;
  const fromHeaders = headers?.get(headerName)?.trim() || headers?.get("cf-ray")?.trim() || "";
  return fromHeaders || crypto.randomUUID();
}

export function buildRuntimeMetadata() {
  return {
    workerName: getSocialFlowRuntimeTarget(),
    activationState: getSocialFlowRuntimeActivationState(),
    contractVersion: getSocialFlowRuntimeContractVersion(),
    cookieName: socialFlowRuntimeDeployContract.auth.cookieName,
    localCookieName: socialFlowRuntimeDeployContract.auth.localCookieName,
  };
}

export function addRuntimeHeaders<T extends NextResponse | Response>(
  response: T,
  params?: { request?: Request | Headers | null; correlationId?: string },
): T {
  const correlationId = params?.correlationId ?? getRuntimeCorrelationId(params?.request);
  response.headers.set(socialFlowRuntimeDeployContract.observability.correlationHeader, correlationId);
  response.headers.set(socialFlowRuntimeDeployContract.observability.runtimeTargetHeader, getSocialFlowRuntimeTarget());
  response.headers.set(socialFlowRuntimeDeployContract.observability.runtimeStateHeader, getSocialFlowRuntimeActivationState());
  response.headers.set(
    socialFlowRuntimeDeployContract.observability.contractVersionHeader,
    getSocialFlowRuntimeContractVersion(),
  );
  return response;
}

export function runtimeJson(
  body: unknown,
  init?: ResponseInit,
  params?: { request?: Request | Headers | null; correlationId?: string },
) {
  const response = NextResponse.json(body, init);
  return addRuntimeHeaders(response, params);
}

export function logRuntimeEvent(
  level: RuntimeLogLevel,
  event: string,
  details: Record<string, unknown>,
) {
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  sink(`SOCIALFLOW_RUNTIME_EVENT:${event}`, {
    runtimeTarget: getSocialFlowRuntimeTarget(),
    activationState: getSocialFlowRuntimeActivationState(),
    contractVersion: getSocialFlowRuntimeContractVersion(),
    ...details,
  });
}
