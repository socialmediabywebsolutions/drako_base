switch (workerName) {
  case "socialflows":
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  default:
    return new Response("ok");
}
