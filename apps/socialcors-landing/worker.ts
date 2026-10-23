interface Env {
  ASSETS: { fetch: typeof fetch };
  DB: D1Database;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // ── POST /api/leads — guardar lead en D1 ──────────────────────────────
    if (request.method === 'POST' && url.pathname === '/api/leads') {
      try {
        let nombre = '', email = '', motivo = '', mensaje = '';

        const ct = request.headers.get('content-type') ?? '';
        if (ct.includes('application/json')) {
          const body = await request.json() as Record<string, string>;
          nombre  = (body.nombre  ?? '').toString().trim();
          email   = (body.email   ?? '').toString().trim().toLowerCase();
          motivo  = (body.motivo  ?? '').toString().trim();
          mensaje = (body.mensaje ?? '').toString().trim();
        } else {
          const fd = await request.formData();
          nombre  = (fd.get('nombre')  ?? '').toString().trim();
          email   = (fd.get('email')   ?? '').toString().trim().toLowerCase();
          motivo  = (fd.get('motivo')  ?? '').toString().trim();
          mensaje = (fd.get('mensaje') ?? '').toString().trim();
        }

        if (!nombre || !email || !motivo) {
          return Response.json(
            { ok: false, error: 'Faltan campos requeridos (nombre, email, motivo)' },
            { status: 400, headers: JSON_HEADERS }
          );
        }
        if (!EMAIL_RE.test(email)) {
          return Response.json(
            { ok: false, error: 'Email inválido' },
            { status: 400, headers: JSON_HEADERS }
          );
        }

        await env.DB
          .prepare(
            'INSERT OR IGNORE INTO leads (nombre, email, motivo, mensaje, created_at) VALUES (?, ?, ?, ?, ?)'
          )
          .bind(nombre, email, motivo, mensaje, new Date().toISOString())
          .run();

        return Response.json({ ok: true }, { headers: JSON_HEADERS });

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error interno';
        return Response.json(
          { ok: false, error: msg },
          { status: 500, headers: JSON_HEADERS }
        );
      }
    }

    // ── Todo lo demás → servir assets estáticos ───────────────────────────
    return env.ASSETS.fetch(request);
  },
};
