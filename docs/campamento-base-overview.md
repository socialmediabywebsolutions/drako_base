# Campamento Base Overview

## Que es Campamento Base
Campamento Base es el cerebro y centro de mando de todo el imperio de SaaS de Cris.

Coordina:
- Minimo vital y baseline (vida + trabajo).
- Tesoreria global (cuentas, reservas de impuestos, IA, infra, gastos personales).
- Contabilidad vendor (costes de cloud, IA, equipo, herramientas).
- Pricing Engine (precios minimo/objetivo/stretch por SaaS).
- Packs de departamentos (Marketing, Contabilidad, Atencion al Cliente, etc.).
- WhatsApp Gateway + alertas, acciones y resumenes.

## Que hace Campamento Base por cada SaaS alquilado
Cada SaaS (peluqueria, clinica, grooming, lavanderia, tutorias, cripto, etc.) tiene:
- Contabilidad propia para su dueno (Cris NO ve detalle interno: ingresos, clientes, etc., salvo lo que haga falta para cobrar su suscripcion).
- Automatizacion por agentes IA de:
  - Marketing (organico + diseno de campanas pagadas; el dinero de Ads lo paga el cliente).
  - Fiscalidad (IVA, IRPF, trimestrales, modelo de impuestos).
  - Contabilidad (facturas, proveedores, libros contables).
  - Atencion al cliente (emails, WhatsApp, citas, recordatorios).
  - Atencion tecnica (incidencias con el SaaS).
  - Recepcion y routing de emails a cada departamento.

Campamento Base solo ve lo necesario para:
- Calcular cuanto gana Cris por cada SaaS.
- Ver margen por SaaS vertical.
- Ajustar precios y packs para que cada SaaS sea rentable.

## Que hace Campamento Base por el imperio completo (Cris)
Suma todos los SaaS (los que alquilan clientes + los que crea Cris: SaaS de educacion, SaaS de cripto, etc.).

Calcula:
- Si el minimo vital (vida + trabajo + vendor) esta cubierto.
- Cuanto hay en tesoreria y reservas.
- Que SaaS estan UNDERWATER / AT_RISK / ABOVE_TARGET.
- Que packs de marketing/contabilidad/lo que sea estan desequilibrados.

Genera:
- Acciones de autopilot ("sube precio", "baja pack", "duplica este SaaS", etc.).
- Resumenes por WhatsApp para Cris (baseline, tesoreria, pricing, vendor, marketing).

## Creador de SaaS (vision futura)
Campamento Base tendra un Creador de SaaS conversacional donde Cris dice:
- Que idea de SaaS tiene.
- Para que nicho.
- Que departamentos/packs quiere (marketing, contabilidad, soporte...).
- Que dominio quiere.
- Rangos de precio.

Campamento Base:
- Disena el blueprint.
- Elige packs y precios iniciales.
- Genera la estructura de SaaS en drako.systems (Cloudflare).
- Conecta Stripe.
- Registra el SaaS en todos los snapshots (baseline, tesoreria, vendor, pricing, marketing).
- Elige la IA recomendada por agente (segun un policy multi-IA), pero esta parte se implementara mas adelante.

## SaaS Factory v2
- Blueprint central (SaasBlueprintDraft) con packs, IA y pricing inicial.
- Agent Factory para seleccionar agentes por vertical y packs.
- Provisioning preparado para Cloudflare, Stripe e IA (sin llamadas reales aun).

## SaaS Factory v2 — UI 3 columnas
- Columna izquierda: Checklist con estado de definicion, packs, IA y provisioning.
- Columna central: Preview con nombre, vertical, packs, pricing e IA, mas el boton de crear SaaS.
- Columna derecha: Chat con Campamento Base que actualiza el blueprint en tiempo real.

## Provisioning & Wiring
- Cada SaaS sale con wiring listo para Campamento Base: marketing, tax, vendor, treasury y baseline.
- El objetivo es ver el SaaS en /owner con estado de provisioning (Cloudflare, Stripe, IA) desde el primer minuto.

## Modulos principales disponibles hoy
- Baseline (0041_drako_baseline_core.sql + src/lib/owner/baseline.ts).
- Vendor (0040_drako_vendor_core.sql + src/lib/owner/vendor-accounting.ts + src/app/owner/OwnerVendorSection.tsx).
- Tesoreria (0042_drako_treasury_core.sql + src/lib/owner/treasury.ts).
- Pricing (src/lib/owner/pricing-engine.ts + src/app/owner/OwnerPricingSection.tsx).
- Packs de Marketing (0043_saas_marketing_core.sql + src/lib/marketing/...).
- WhatsApp Gateway (src/lib/whatsapp/ + intents + automation).
- Autopilot de crecimiento (src/lib/owner/growth-autopilot.ts).
- Bloques de /owner (src/app/owner/page.tsx y secciones asociadas).
