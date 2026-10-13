export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";

export async function POST(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }

    const rawBody = await request.json().catch(() => ({}));
    const body = typeof rawBody === "object" && rawBody !== null ? rawBody : {};

    const workerUrl =
      process.env.NEXT_PUBLIC_AI_WORKER_URL ||
      "https://socialflow-ai-worker.socialmediabywebsolutions.workers.dev";

    const response = await fetch(`${workerUrl}/generate-post`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...body,
        tenantId: session.tenantId,
        saasId: "socialcors",
      }),
    });

    if (!response.ok) {
      throw new Error(`Error en Worker AI: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error en puente AI chat:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}
