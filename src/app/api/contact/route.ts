import { NextResponse } from "next/server";
import { getDb, run } from "@/lib/db";

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

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error("CONTACT_API_ERROR", error);
    return NextResponse.json(
      { ok: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
