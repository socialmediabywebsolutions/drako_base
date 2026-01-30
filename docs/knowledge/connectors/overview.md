---
id: connectors-overview
version: 1.0
scope: holding
status: draft
owners: [drako-team]
tags: [conectores, integraciones, DKS]
applies_to: [all]
not_applies_to: []
---

# 📡 Connectors Overview — Mapa Operativo de Integraciones

## Introducción
La plataforma Drako utiliza conectores para integrar canales de comunicación externos en su sistema de atención y automatización. Cada conector puede ser de tipo **Inbound** (ingesta de datos entrantes) o **Outbound** (envío de datos o notificaciones a servicios externos). Este documento ofrece una vista general (mapa operativo) del estado actual de los conectores planificados, en desarrollo o activos. Incluye ejemplos de conectores planeados y orientaciones sobre cómo registrarlos en el Drako Knowledge System (DKS).

## Tabla de conectores
| ID                | Canal           | Tipo     | Estado        | Descripción                                        |
|-------------------|-----------------|----------|---------------|----------------------------------------------------|
| whatsapp-outbound | WhatsApp        | Outbound | Planificación | Mensajes y notificaciones automáticas vía WhatsApp. |
| gmail-inbound     | Gmail           | Inbound  | Planificación | Ingesta de correos electrónicos entrantes desde Gmail. |
| facebook-graph-in | Facebook Graph  | Inbound  | Planificación | Conector para la API de Facebook Graph (datos entrantes). |
| slack-outbound    | Slack           | Outbound | Planificación | Envío de mensajes a canales de Slack.              |

## Estado general
La integración de conectores aún está en fase inicial. Actualmente no hay conectores activos: los cuatro ejemplos listados en la tabla anterior se encuentran en **planificación**. Esto resulta en el siguiente resumen de estado:

- **Planificación:** 4 conectores (ver ejemplos en la tabla anterior).  
- **En desarrollo:** 0  
- **Activos:** 0  

## Enlaces recomendados
- [Manifesto de Conectores](file:///c:/CAMPAMENTO%20BASE%20DRAKO/drako_base/docs/knowledge/connectors/manifesto.md) — Filosofía y criterios para el desarrollo e integración de nuevos conectores en Drako.  
- [Registro de Conectores](file:///c:/CAMPAMENTO%20BASE%20DRAKO/drako_base/docs/knowledge/connectors/connectors-registry.md) — Listado maestro de todos los conectores registrados en el sistema.  
- [Plantilla de Conector](file:///c:/CAMPAMENTO%20BASE%20DRAKO/drako_base/docs/knowledge/connectors/templates/connector-template.md) — Ejemplo de plantilla Markdown para definir y documentar un nuevo conector.

> **Nota:** Para registrar un nuevo conector, copie la plantilla en `templates/connector-<nombre>.md`, complete los campos requeridos y agregue su entrada en el [Registro de Conectores](file:///c:/CAMPAMENTO%20BASE%20DRAKO/drako_base/docs/knowledge/connectors/connectors-registry.md). Sigue las indicaciones del *manifesto* para definir el propósito y alcance de cada conector.
