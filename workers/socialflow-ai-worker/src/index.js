export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Endpoint 1: Generar Post
    if (request.method === "POST" && url.pathname === "/generate-post") {
      const { topic, tone } = await request.json();
      const prompt = `Escribe una publicación para redes sociales sobre: ${topic}. Tono: ${tone || 'profesional'}.`;
      
      const response = await env.AI.run('@cf/mistral/mistral-7b-instruct-v0.2-lora', {
        messages: [{ role: 'user', content: prompt }]
      });

      const postContent = response.response || response.choices?.[0]?.message?.content;

      if (env.SOCIAL_DB && postContent) {
        await env.SOCIAL_DB.prepare(
          "CREATE TABLE IF NOT EXISTS generated_posts (id INTEGER PRIMARY KEY AUTOINCREMENT, topic TEXT, content TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);"
        ).run();

        await env.SOCIAL_DB.prepare(
          "INSERT INTO generated_posts (topic, content) VALUES (?, ?)"
        ).bind(topic, postContent).run();
      }

      return new Response(JSON.stringify({ success: true, type: "post", data: response }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // Endpoint 2: Generar Hashtags
    if (request.method === "POST" && url.pathname === "/generate-hashtags") {
      const { topic, count } = await request.json();
      const prompt = `Genera una lista de ${count || 5} hashtags relevantes para: ${topic}. Devuelve solo los hashtags separados por espacios.`;

      const response = await env.AI.run('@cf/mistral/mistral-7b-instruct-v0.2-lora', {
        messages: [{ role: 'user', content: prompt }]
      });

      const hashtagContent = response.response || response.choices?.[0]?.message?.content;

      if (env.SOCIAL_DB && hashtagContent) {
        await env.SOCIAL_DB.prepare(
          "CREATE TABLE IF NOT EXISTS generated_hashtags (id INTEGER PRIMARY KEY AUTOINCREMENT, topic TEXT, hashtags TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);"
        ).run();

        await env.SOCIAL_DB.prepare(
          "INSERT INTO generated_hashtags (topic, hashtags) VALUES (?, ?)"
        ).bind(topic, hashtagContent).run();
      }

      return new Response(JSON.stringify({ success: true, type: "hashtags", data: response }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response("Ruta no encontrada", { status: 404 });
  }
};
