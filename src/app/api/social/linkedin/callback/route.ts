import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.json(
      { error: `LinkedIn OAuth error: ${error}` },
      { status: 400 }
    );
  }

  if (!code || !state) {
    return NextResponse.json(
      { error: "Missing code or state parameter" },
      { status: 400 }
    );
  }

  try {
    const [tenantId, saasId] = state.split("__");
    
    if (!tenantId || !saasId) {
      throw new Error("Invalid state format");
    }

    return NextResponse.json({
      success: true,
      code,
      saasId,
      tenantId,
      message: "LinkedIn OAuth callback processed",
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid state parameter" },
      { status: 400 }
    );
  }
}
