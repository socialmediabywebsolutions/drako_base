# Client Portal v1 (SaaS genérico, hair-salon-first)

## Tablas y migraciones

- `migrations/0021_saas_customers.sql`: crea `saas_customers` con campos multi-tenant, preferencias, perfil de estilo, y flags VIP.
- `migrations/0025_saas_appointments_customer_id.sql`: añade `customer_id` a `saas_appointments` e índice por cliente.

Campos clave nuevos en `saas_customers`:

- `preferred_employee_id`: profesional preferido (opcional).
- `preferred_services`: JSON con lista de `service_id`.
- `style_profile`: JSON flexible (hair_length, hair_type, risk_level, favorite_colors, event_type, metadata, etc.).

## Flujo del Client Portal

Ruta pública: `/site/saas/[slug]`

1) El cliente selecciona servicio, fecha/hora, contacto y preferencias.
2) El portal crea (o reutiliza) `saas_customers` por contacto.
3) Se crea una `saas_appointment` con `status = REQUESTED` y `customer_id` vinculado.
4) Se devuelve un mensaje de confirmación y sugerencias deterministas v1.

El flujo es multi-tenant y compatible con demo-store.

## CustomerPartner v1

Motor determinista (sin IA externa) que:

- Excluye servicios con inventario insuficiente.
- Prioriza servicios con margen OK según pricing.
- Considera presupuesto y tipo de evento (boda, fiesta, etc.).

Salida: lista de sugerencias con `serviceId`, `reason`, `price`, `marginStatus`, `estimatedDuration`.

## Conexión con Economy, HR y Owner Control

- Economy: servicios activos, inventario por servicio y pricing/margen.
- HR/Employees: se respeta `preferred_employee_id` al crear solicitudes.
- Owner Control: no cambia lógica, solo se amplía el contexto disponible en citas y clientes.

## Pendiente (v2)

- Login de cliente y panel de historial completo.
- Slots de agenda avanzados y confirmación automática.
- IA generativa para recomendaciones con imagen/conversación.

## Customer Experience v2: Style Advisor + CustomerPartner

Flujo v2 (texto):

Cliente → StyleAdvisorWidget → `POST /api/customer-partner/ensure-and-suggestions` → CustomerPartner → sugerencias → BookingWidget

Staff → Staff Portal → agenda diaria + sugerencias CustomerPartner por cita

Notas:

- El enlace público `/site/saas/<slug>` ya es apto para bio de Instagram, Google Maps o botón “Reservar”.
- Cuando se active `saas_domains`, se mapeará a dominio propio vía Cloudflare (pendiente de DNS/rutas).
