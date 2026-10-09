export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const saasId = searchParams.get("saasId");

  if (!saasId) {
    return new Response(JSON.stringify({ error: "saasId is required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const redirectUrl = new URL("/api/socialflow/linkedin/connect", request.url);
  redirectUrl.search = searchParams.toString();

  return Response.redirect(redirectUrl.toString(), 308);
}
