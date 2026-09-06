export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { SocialContextError } from "@/lib/socialflow/repository";
import { updateEmployeeProfile, softDeleteEmployeeProfile, buildEmployeeFaceUrl } from "@/lib/socialflow/profile/employee-profiles-repository";
import { env } from "@/lib/cf";

const DEFAULT_SAAS_ID = "socialflow";

function resolveSaasId(request: Request): string {
  return new URL(request.url).searchParams.get("saasId")?.trim() || DEFAULT_SAAS_ID;
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const body = (await request.json().catch(() => null)) as {
      name?: string;
      job_title?: string;
      jobTitle?: string;
      job_description?: string | null;
      jobDescription?: string | null;
    } | null;

    if (!body) {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const jobTitleRaw = body.jobTitle ?? body.job_title;
    const jobDescriptionRaw = body.jobDescription ?? body.job_description;

    const saasId = resolveSaasId(request);
    const employee = await updateEmployeeProfile(
      params.id,
      session.tenantId,
      {
        name: typeof body.name === "string" ? body.name : undefined,
        jobTitle: typeof jobTitleRaw === "string" ? jobTitleRaw : undefined,
        jobDescription: jobDescriptionRaw !== undefined ? jobDescriptionRaw : undefined,
      },
      saasId,
    );

    if (!employee) {
      return NextResponse.json({ ok: false, error: "EMPLOYEE_NOT_FOUND" }, { status: 404 });
    }
    const r2PublicUrl = env()?.SOCIAL_MEDIA_R2_PUBLIC_URL;
    return NextResponse.json({ ok: true, employee: { ...employee, faceUrl: buildEmployeeFaceUrl(employee, r2PublicUrl) } });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ ok: false, error: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_EMPLOYEE_PATCH_ERROR", error);
    return NextResponse.json({ ok: false, error: "EMPLOYEE_UPDATE_FAILED" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const saasId = resolveSaasId(request);
    const deleted = await softDeleteEmployeeProfile(params.id, session.tenantId, saasId);
    if (!deleted) {
      return NextResponse.json({ ok: false, error: "EMPLOYEE_NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ ok: false, error: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_EMPLOYEE_DELETE_ERROR", error);
    return NextResponse.json({ ok: false, error: "EMPLOYEE_DELETE_FAILED" }, { status: 500 });
  }
}
