---
id: saas-activation-test-run
version: v1
scope: holding
status: active
owners: [drako-team]
tags: [playbook, activation, saas, test-run, automation]
applies_to: [holding, campamento-base]
---

# 🚀 Playbook de Activación: SaaS Hijo (Test Run)

Este documento es la guía maestra para ejecutar la activación de un nuevo SaaS de forma 100% automatizada.

## 1. Precondiciones
Antes de iniciar el flujo, asegúrate de contar con:
- **Tokens de Infraestructura**: Cloudflare API Token (con permisos de D1, Pages y DNS).
- **Billing**: Stripe Secret Key configurada en Campamento Base.
- **Identidad**: Acceso a los Client IDs de Google/Meta para los flujos OAuth.
- **Ambiente**: Base de datos D1 (`DRAKO_DB`) accesible y con las migraciones base aplicadas.
- **Variables de Entorno**: `WHATSAPP_TOKEN`, `STRIPE_WEBHOOK_SECRET` y `BASE_DOMAIN` configurados.

## 2. Secuencia Paso a Paso (Flujo de Agentes)

### Paso 1: Entrevista Inicial (`interview-prompt`)
1. El **Drako Partner** inicia la conversación.
2. Captura: Tipo de negocio, módulos (ej. Support, Economy), y preferencias de canales.
3. **Resultado**: Generación de un objeto JSON con el `blueprint` inicial.

### Paso 2: Planificación Técnica (`saas-builder-prompt`)
1. El **SaaS Builder** recibe el JSON del blueprint.
2. Ejecuta la provisión de recursos en Cloudflare.
3. Enlaza los agentes core según los packs seleccionados.
4. **Resultado**: Infraestructura desplegada y base de datos inicializada para el tenant.

### Paso 3: Vinculación de Canales (`domain-oauth-prompt`)
1. Se solicita al Owner la autorización de WhatsApp y Gmail.
2. El agente gestiona el flujo OAuth y valida el estado de los tokens.
3. **Resultado**: Canales activos en el `connectors-registry` del tenant.

### Paso 4: Activación de Orquestación (`autopilot-prompt`)
1. El Autopiloto se conecta a la `Action Queue`.
2. Realiza el primer "triage" de los mensajes o eventos pendientes.
3. **Resultado**: El sistema responde autónomamente a los primeros eventos entrantes.

## 3. Verificaciones Esperadas (Checklist)
- [ ] **DNS/SSL**: El subdominio `[tenant].apps.drako.systems` responde con HTTPS.
- [ ] **Stripe**: El producto y precio aparecen correctamente en el Dashboard de Stripe.
- [ ] **D1**: La tabla `tenants` y `tenant_users` tiene los registros correctos.
- [ ] **Logs**: Se visualizan entradas en `agent_logs` confirmando la clonación de agentes.
- [ ] **Knowledge**: Se han creado los namespaces en Vectorize para el nuevo tenant.

## 4. Notas para Producción (Go-Live)
| Elemento | Modo Dry-Run / Test | Modo Producción |
| :--- | :--- | :--- |
| **Dominios** | Subdominio `*.apps.drako.systems` | Dominio propio del cliente (DNS externo). |
| **WhatsApp** | Token de prueba y número registrado. | Token permanente y Business API verificado. |
| **Stripe** | Modo Test (keys `sk_test_...`) | Modo Live (keys `sk_live_...`). |
| **Logs** | Nivel Debug activo. | Nivel Error/Info con alertas a Slack/Discord. |

## 5. Check de Seguridad
- **Mínimo Privilegio**: Verificar que los tokens del tenant solo tengan acceso a sus propios recursos (D1/R2/KV).
- **Secretos**: Las credenciales OAuth deben guardarse en el Vault (KV encripado) y nunca en texto plano.
- **Auditoría**: Confirmar que todas las acciones del Builder Agent se registran en `audit_events` con el `actor_id` correspondiente.

---
*Drako Factory — Automating the implementation of the future.*
