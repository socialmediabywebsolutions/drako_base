# Estado del Campamento Base

## Departamentos y agentes base
- Dirección y Estrategia → Agente estratega del negocio (define foco trimestral, reporta KPIs).
- Marketing y Redes Sociales → Agente de marketing omnicanal (campañas, contenido y paid media).
- Ventas y Atención al cliente → Agente comercial (demos, renovaciones y pipeline).
- Atención al cliente y Soporte → Agente de soporte (SLA, runbooks, incidencias nivel 1).
- Contabilidad → Agente contable (cashflow, facturas, conciliaciones).
- Contabilidad fiscal e impuestos → Agente fiscal (IVA, modelos 303/390, obligaciones AEAT).
- Legal y cumplimiento → Agente legal (contratos, reclamaciones, normativa sectorial).
- Programación y Desarrollo → Agente de desarrollo (despliegues, calidad del código, CI/CD).
- Ciberseguridad → Agente de ciberseguridad (monitoreo, accesos, respuestas a incidentes).
- Subvenciones y ayudas → Agente de subvenciones (detección y tramitación de programas públicos).

## Herencia al crear un SaaS
1. Al ejecutar **Crear SaaS**, DRĀKO invoca `ensureCampamentoBase()` y clona automáticamente todos los agentes base en `saas_agents`.
2. Cada agente hereda su departamento, tipo y descripción original; en `/saas/[id]` se muestran agrupados por departamento con su estado (activo/pausado) y descripción en español.
3. El Chat Orquestador recibe contexto del SaaS recién creado (nombre, estado, timeline, alertas, métricas y agentes) para responder con recomendaciones específicas.

## Bandeja unificada (/inbox)
- Integra Email y WhatsApp con filtros por canal, estado, SaaS y departamento. Todos los estados están en español (Pendiente, En proceso, Resuelto, Archivado, Error).
- El ruteo automático asigna departamentos según palabras clave: factura/IVA/impuestos → Contabilidad fiscal; presupuesto/pago/cobro/impago → Contabilidad o Ventas según el texto; Instagram/Facebook/campaña/publicación → Marketing; contrato/reclamación/denuncia/devolución → Legal; además cubre soporte, devops, ciberseguridad y subvenciones.
- Desde la tarjeta «Detalle» se ofrecen acciones rápidas: responder (abre mailto), marcar pendiente/en proceso/resuelto y reclasificar por departamento (selector + botones rápidos).
- Cada mensaje seleccionado envía contexto al Chat Orquestador con canal, estado, departamento (label y id) y SaaS vinculado, de forma que las respuestas incluyan pasos concretos dentro de DRĀKO.

## Chat Orquestador
- Columna derecha permanente (glass) que muestra resúmenes dinámicos: «Mensaje en foco» o «SaaS seleccionado», con iconografía e información clave.
- Contexto de `/saas/[id]`: analiza timeline de provisión, alertas y agentes para responder como el departamento/agente correspondiente (p.ej., «Programación y Desarrollo (Agente de desarrollo)») y proponer próximos pasos (registrar pasos en Provisión, revisar alertas, ajustar agentes o métricas).
- Contexto de `/inbox`: responde como el departamento asignado (ej. «Contabilidad fiscal e impuestos junto al Agente de impuestos y declaraciones»), sugiere acciones en `/inbox` (filtrar, reclasificar, resolver) y ofrece atajos («Redactar respuesta», «Reclasificar este mensaje», «Escalar a otro departamento», etc.).
- Todas las respuestas están en español natural, mencionan el departamento/agente y listan 1–3 pasos concretos dentro de DRĀKO (ubicación en la UI incluida).

## Estado actual del frontend
- Todas las páginas principales (`/`, `/saas`, `/saas/create`, `/saas/[id]`, `/departments`, `/agents`, `/alerts`, `/metrics`, `/grants`, `/inbox`) usan el layout de tres columnas con estilo glass blanco + celeste, textos en español y estados vacíos consistentes.
- Accesibilidad básica aplicada: controles con `aria-label`, roles en listas y tablas, focus visible en enlaces y botones, panel derecho con `role="complementary"` y registros marcados con `aria-live` donde corresponde.
- El Chat Orquestador está integrado con SaaS e Inbox, incorpora atajos contextualizados y burbujas glass; utiliza el contexto real para proponer acciones concretas.
- La bandeja `/inbox` enruta y gestiona mensajes por departamento automáticamente, permite reclasificar manualmente y mantiene sincronía con el Chat Orquestador.
