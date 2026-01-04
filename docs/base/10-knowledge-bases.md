# Knowledge Bases (Holding / SaaS / Tenant / Agentes)

## Capas
1) Holding (Campamento Base):
   - reglas, costes, runbooks, catálogo
2) Por SaaS:
   - blueprint, módulos, dominios, flujos
3) Por tenant/cliente:
   - negocio, assets, integraciones, historial
4) Por agente:
   - rol, límites, herramientas, playbooks

## Reglas
- Nada de conocimiento mágico: solo docs + inputs + data registrada.
- Cada SaaS debe poder exportar su KB.
- Cada cambio de arquitectura se refleja aquí (para alinear chats).

## Knowledge Space 0: Base canónica (estos 20 archivos)

Existe un espacio “0” de conocimiento que no pertenece a ningún cliente: **la base canónica** del holding.
Ahí viven estos 20 archivos y se cargan siempre antes de ejecutar:

- entrevistas,
- creación de SaaS,
- provisioning,
- routing multi-tenant,
- release a producción.

Si falta, el sistema debe considerarse “sin mapa” y no debe actuar a ciegas.
## Uso en ChatGPT (Proyectos)

- Estos 20 archivos se suben al **proyecto** de ChatGPT como “base canónica”.
- Cualquier chat nuevo debe **leerlos primero** (mínimo `00-index.md` + `01-drako-overview.md`).
- Regla: si un archivo del código contradice a esta base, se considera **desalineado** y hay que actualizar o el código o estos documentos (no vivir con dos verdades).
- Cuando actualices la arquitectura: regenera el pack y **reemplaza los 20** (sin duplicados).
