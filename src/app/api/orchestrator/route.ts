import { NextResponse } from "next/server";
import { queryAll, run } from "@/lib/db";

export const runtime = "edge";

type MessageRow = {
  id: string;
  thread_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata: string | null;
  created_at: string;
};

type ContextInfo = {
  path?: string;
  scope?: "saas" | "inbox";
  saas?: {
    id: string;
    name: string;
    slug: string;
    domain: string | null;
    status: string;
  };
  detalle?: {
    provisiones?: { id: string; paso: string; estado: string; creado: string; detalles?: string | null }[];
    alertas?: { id: string; severidad: string; fuente: string; mensaje: string; creado: string }[];
    agentes?: { id: string; nombre: string; departamento: string; departamento_id?: string; estado: string }[];
  };
  inbox?: {
    id: string;
    channel: string;
    status: string;
    department_id: string | null;
    department_label?: string | null;
    subject: string | null;
    preview: string;
    saas_id: string | null;
    saas_name?: string | null;
  };
};

const departmentLabels: Record<string, string> = {
  core_dir: "Dirección y Estrategia",
  core_mkt: "Marketing y Redes Sociales",
  core_sales: "Ventas y Atención al Cliente",
  core_support: "Atención al cliente y Soporte",
  core_dev: "Programación y Desarrollo",
  core_sec: "Ciberseguridad",
  core_legal: "Legal y Cumplimiento",
  core_grants: "Subvenciones y Ayudas",
  core_acc: "Contabilidad",
  core_tax: "Contabilidad fiscal e impuestos",
};

const departmentAgents: Record<string, { dept: string; agent: string }> = {
  core_dir: { dept: departmentLabels.core_dir, agent: "Agente estratega del negocio" },
  core_mkt: { dept: departmentLabels.core_mkt, agent: "Agente de marketing omnicanal" },
  core_sales: { dept: departmentLabels.core_sales, agent: "Agente comercial" },
  core_support: { dept: departmentLabels.core_support, agent: "Agente de soporte" },
  core_dev: { dept: departmentLabels.core_dev, agent: "Agente de desarrollo" },
  core_sec: { dept: departmentLabels.core_sec, agent: "Agente de ciberseguridad" },
  core_legal: { dept: departmentLabels.core_legal, agent: "Agente legal" },
  core_grants: { dept: departmentLabels.core_grants, agent: "Agente de subvenciones" },
  core_acc: { dept: departmentLabels.core_acc, agent: "Agente contable" },
  core_tax: { dept: departmentLabels.core_tax, agent: "Agente de impuestos y declaraciones" },
};

function newId(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}_${Date.now()}`;
}

function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function buildAssistantReply(message: string, context?: ContextInfo) {
  const text = normalize(message);
  const contextHint = context?.path ? `Contexto actual (${context.path}).` : "";

  if (context?.scope === "inbox" && context.inbox) {
    const inbox = context.inbox;
    const canal = inbox.channel === "whatsapp" ? "WhatsApp" : "Email";
    const estado = statusLabel(inbox.status);
    const deptMeta = inbox.department_id ? departmentAgents[inbox.department_id] : undefined;
    const departamento = deptMeta?.dept ?? inbox.department_label ?? "Operaciones generales";
    const agente = deptMeta?.agent ?? "Orquestador";
    const pasos = [
      `Entra en /inbox → "Filtros activos" y revisa los mensajes en estado "${estado}" para mantener la prioridad.`,
      `En la tarjeta "Detalle" usa el selector "Departamento" para confirmar o cambiar a ${departamento}.`,
      `Pulsa "Responder al cliente" o los atajos de estado (Pendiente/En proceso/Resuelto) para dejar trazabilidad y cerrar el caso.`,
    ];
    const resumen = inbox.subject ?? inbox.preview;
    return `${contextHint} Estoy actuando como Departamento de ${departamento} junto al ${agente}. Canal ${canal}, estado ${estado}. Resumen: "${resumen}".
Próximos pasos en DRĀKO:
1) ${pasos[0]}
2) ${pasos[1]}
3) ${pasos[2]}
Si necesitas, puedo redactar la respuesta, reclasificar el mensaje o preparar una nota para el SaaS ${inbox.saas_name ?? inbox.saas_id ?? "general"}.`;
  }

  if (context?.scope === "saas" && context.saas) {
    const saas = context.saas;
    const detalle = context.detalle;
    const dominio = saas.domain ?? "sin dominio publicado";
    const primerAgente = detalle?.agentes?.[0];
    const agentePrincipal = primerAgente
      ? `${primerAgente.departamento} (${primerAgente.nombre})`
      : "Dirección y Estrategia";
    const tareasProvision = detalle?.provisiones ?? [];
    const pendienteProvision = tareasProvision.find((p) => p.estado !== "completed" && p.estado !== "done");
    const resumenProvision = pendienteProvision
      ? `${pendienteProvision.paso} (${pendienteProvision.estado})`
      : tareasProvision[0]
        ? `${tareasProvision[0].paso} (${tareasProvision[0].estado})`
        : "sin registros";
    const alertas = detalle?.alertas ?? [];
    const alertasCriticas = alertas.filter((a) => a.severidad === "error").length;
    const alertasTotal = alertas.length;
    const tieneLegal = detalle?.agentes?.some((a) => a.departamento_id === "core_legal");
    const pasos = [
      `Abrir la tarjeta "Provisión" del SaaS y registrar el siguiente paso (último registro: ${resumenProvision}).`,
      alertasTotal > 0
        ? `Visitar "Alertas del SaaS" y atender ${alertasCriticas > 0 ? `${alertasCriticas} alerta(s) crítica(s)` : "las alertas abiertas"}.`
        : `Confirmar en la tarjeta "Alertas del SaaS" que no existan pendientes.`,
      tieneLegal
        ? `Revisar la sección "Agentes asignados" y actualizar el estado del departamento involucrado.`
        : `Asignar un agente de Legal desde "Agentes asignados" para garantizar cobertura regulatoria.`,
    ];
    return `${contextHint} Estoy actuando como ${agentePrincipal} sobre el SaaS "${saas.name}" (slug ${saas.slug}, dominio ${dominio}, estado ${saas.status}).
Próximos pasos recomendados:
1) ${pasos[0]}
2) ${pasos[1]}
3) ${pasos[2]}
También puedo preparar un resumen operativo, revisar métricas o activar a otro departamento según lo necesites.`;
  }

  if (/(alerta|riesgo|incidente|error)/.test(text)) {
    return `${contextHint} Activaré el protocolo de alertas: 1) verifico métricas del módulo implicado, 2) notifico al responsable mediante la bandeja unificada y 3) preparo un plan de mitigación. ¿Deseas que priorice algún SaaS en particular?`;
  }

  if (/(provision|dns|domain|cloudflare|ssl)/.test(text)) {
    return `${contextHint} Puedo ejecutar el playbook de provisión: validar DNS en Cloudflare, conectar Pages y confirmar certificados. Indícame el slug del SaaS y lo añado a la timeline de provisión.`;
  }

  if (/(agente|departamento|rol|ia)/.test(text)) {
    return `${contextHint} Los departamentos base están listos. Puedo asignar agentes activos, revisar modelos o preparar métricas de ejecución. Dime si necesitas un agente nuevo o ajustar credenciales.`;
  }

  if (/(bandeja|inbox|whatsapp|email|mensaje)/.test(text)) {
    return `${contextHint} La bandeja unificada enruta Email y WhatsApp por palabras clave. Puedo resumir conversaciones abiertas o escalar un ticket a Soporte o Finanzas. Indica el ID del mensaje para actuar.`;
  }

  if (/(grant|subvencion|ayuda|financiacion)/.test(text)) {
    return `${contextHint} Revisaré el pipeline de ayudas y prepararé un resumen con deadlines, presupuesto y requisitos. ¿Debo priorizar alguna región o ticket existente?`;
  }

  return `${contextHint} Registré tu instrucción. Puedo coordinar provisión, agentes, alertas o bandejas. Itera con más detalles y te devolveré el siguiente paso recomendado.`;
}

function statusLabel(value: string) {
  const map: Record<string, string> = {
    nuevo: "nuevo",
    en_proceso: "en proceso",
    resuelto: "resuelto",
    archivado: "archivado",
    error: "en error",
  };
  return map[value] ?? value;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const threadId = url.searchParams.get("thread_id");
  if (!threadId) {
    return NextResponse.json({ error: "thread_id requerido" }, { status: 400 });
  }
  const items = await queryAll<MessageRow>(
    "SELECT id, thread_id, role, content, metadata, created_at FROM orchestrator_messages WHERE thread_id = ? ORDER BY created_at ASC",
    threadId
  );
  return NextResponse.json({ thread_id: threadId, items });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    thread_id?: string;
    message?: string;
    context?: ContextInfo;
  } | null;

  if (!body?.message || typeof body.message !== "string") {
    return NextResponse.json({ error: "message requerido" }, { status: 400 });
  }

  const threadId = body.thread_id || newId("thread");
  const metadata = body.context ? JSON.stringify(body.context) : null;

  const userMsgId = newId("msg");
  const okUser = await run(
    "INSERT INTO orchestrator_messages (id, thread_id, role, content, metadata) VALUES (?, ?, 'user', ?, ?)",
    userMsgId,
    threadId,
    body.message,
    metadata
  );
  if (!okUser) {
    return NextResponse.json({ error: "error registrando mensaje" }, { status: 500 });
  }

  const reply = buildAssistantReply(body.message, body.context);
  const assistantMsgId = newId("msg");
  const okAssistant = await run(
    "INSERT INTO orchestrator_messages (id, thread_id, role, content, metadata) VALUES (?, ?, 'assistant', ?, ?)",
    assistantMsgId,
    threadId,
    reply,
    metadata
  );
  if (!okAssistant) {
    return NextResponse.json({ error: "error registrando respuesta" }, { status: 500 });
  }

  const items = await queryAll<MessageRow>(
    "SELECT id, thread_id, role, content, metadata, created_at FROM orchestrator_messages WHERE thread_id = ? ORDER BY created_at ASC",
    threadId
  );

  return NextResponse.json({ thread_id: threadId, reply, items });
}
