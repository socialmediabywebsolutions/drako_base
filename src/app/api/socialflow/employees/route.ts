export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { SocialContextError } from "@/lib/socialflow/repository";
import {
  createEmployeeProfile,
  listActiveEmployeeProfiles,
  buildEmployeeFaceUrl,
  EmployeeProfileLimitError,
} from "@/lib/socialflow/profile/employee-profiles-repository";
import { env } from "@/lib/cf";

const DEFAULT_SAAS_ID = "socialflow";

function resolveSaasId(request: Request): string {
  return new URL(request.url).searchParams.get("saasId")?.trim() || DEFAULT_SAAS_ID;
}

export async function GET(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const saasId = resolveSaasId(request);
    const employees = await listActiveEmployeeProfiles(session.tenantId, saasId);
    const r2PublicUrl = env()?.SOCIAL_MEDIA_R2_PUBLIC_URL;
    return NextResponse.json({
      ok: true,
      employees: employees.map((e) => ({ ...e, faceUrl: buildEmployeeFaceUrl(e, r2PublicUrl) })),
    });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ ok: false, error: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_EMPLOYEES_GET_ERROR", error);
    return NextResponse.json({ ok: false, error: "EMPLOYEES_LIST_FAILED" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const body = (await request.json().catch(() => null)) as {
      name?: string;
      job_title?: string;
      jobTitle?: string;
      job_description?: string | null;
      jobDescription?: string | null;
    } | null;

    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const jobTitle = typeof (body?.jobTitle ?? body?.job_title) === "string" ? (body?.jobTitle ?? body?.job_title)!.trim() : "";
    const jobDescription = (body?.jobDescription ?? body?.job_description) ?? null;

    if (!name || !jobTitle) {
      return NextResponse.json({ ok: false, error: "NAME_AND_JOB_TITLE_REQUIRED" }, { status: 400 });
    }

    const saasId = resolveSaasId(request);
    const employee = await createEmployeeProfile(
      session.tenantId,
      { name, jobTitle, jobDescription: typeof jobDescription === "string" ? jobDescription : null },
      saasId,
    );
    return NextResponse.json({ ok: true, employee: { ...employee, faceUrl: null } });
  } catch (error) {
    if (error instanceof EmployeeProfileLimitError) {
      return NextResponse.json({ ok: false, error: "EMPLOYEE_LIMIT_REACHED", message: error.message }, { status: 400 });
    }
    if (error instanceof SocialContextError) {
      return NextResponse.json({ ok: false, error: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_EMPLOYEES_POST_ERROR", error);
    return NextResponse.json({ ok: false, error: "EMPLOYEE_CREATE_FAILED" }, { status: 500 });
  }
}
