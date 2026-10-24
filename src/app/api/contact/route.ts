import { NextResponse } from "next/server";
import { getDb, run } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (
      typeof body !== "object" ||
      body === null ||
      typeof (body as any).name !== "string" ||
      typeof (body as any).email !== "string" ||
      typeof (body as any).message !== "string"
    ) {
      return NextResponse.json(
        { ok: false, error: "Invalid request body" },
        { status: 400 },
      );
    }

    const { name, email, role, interest, message } = body as {
      name: string;
      email: string;
      role?: string;
      interest?: string;
      message: string;
    };

    // Basic validation
    if (!name || !email || !message) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const db = getDb();
    if (!db) {
      console.error("DB_UNAVAILABLE: Cannot save contact form submission");
      // In production, we might want to fallback to logging or sending an email via API
      return NextResponse.json(
        { ok: false, error: "Service temporarily unavailable" },
        { status: 503 }
      );
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    // Construct the message body
    const fullBody = `
Nombre: ${name}
Email: ${email}
Rol: ${role || "N/A"}
Interés: ${interest || "General"}

Mensaje:
${message}
    `.trim();

    const subject = `Contacto Web: ${name} - ${interest || "General"}`;

    // Insert into inbox_messages
    // We map this to 'core_sales' department by default
    // We treat it as an 'email' channel inbound message
    const sql = `
      INSERT INTO inbox_messages (
        id, channel, direction, from_address, to_address, 
        subject, body_preview, full_body, 
        status, department_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const success = await run(
      sql,
      id,
      "email", // channel
      "inbound", // direction
      email, // from_address
      "hola@drakosystems.com", // to_address (dummy internal)
      subject, // subject
      message.substring(0, 200), // body_preview
      fullBody, // full_body
      "nuevo", // status
      "core_sales", // department_id
      now, // created_at
      now // updated_at
    );

    if (!success) {
      throw new Error("Failed to insert into inbox_messages");
    }

    // Notificación interna a hola@drako.systems (best-effort — no falla si Resend no está configurado)
    void sendEmail({
      to: "hola@drako.systems",
      subject: `🔔 Nuevo lead: ${name}${role ? ` · ${role}` : ""}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:2rem;color:#0a0f1e">
          <h2 style="font-size:1.3rem;margin-bottom:1rem">Nuevo lead desde drako.systems</h2>
          <table style="width:100%;border-collapse:collapse;font-size:.92rem">
            <tr><td style="padding:.4rem 0;color:#64748b;width:120px">Nombre</td><td><strong>${name}</strong></td></tr>
            <tr><td style="padding:.4rem 0;color:#64748b">Email</td><td><a href="mailto:${email}" style="color:#3b82f6">${email}</a></td></tr>
            ${role ? `<tr><td style="padding:.4rem 0;color:#64748b">Empresa</td><td>${role}</td></tr>` : ""}
            ${interest ? `<tr><td style="padding:.4rem 0;color:#64748b">Presupuesto</td><td>${interest}</td></tr>` : ""}
          </table>
          <div style="margin-top:1.25rem;padding:1rem;background:#f8fafc;border-radius:8px;font-size:.92rem;line-height:1.6;white-space:pre-wrap">${message}</div>
          <p style="margin-top:1.5rem;font-size:.8rem;color:#94a3b8">ID: ${id} · ${now}</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error("CONTACT_API_ERROR", error);
    return NextResponse.json(
      { ok: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
