---
id: how-to-contribute-to-dks
version: v1
scope: holding
status: active
owners: [drako-core]
tags: [guide, contribution, dks]
applies_to: all
not_applies_to: []
---

# 🧩 ¿Quieres añadir conocimiento al DKS?

Sigue esta guía paso a paso para contribuir correctamente al **Drako Knowledge System (DKS)**:

1. 🔀 **Clona o crea una rama:**  
   Trabaja desde `main` o una rama activa (`feat/...`) y crea una nueva feature branch para tu artefacto.

2. 🗂 **Crea tu artefacto en la carpeta correspondiente:**  
   - `standards/` → normas y especificaciones
   - `packs/` → playbooks SaaS
   - `capsules/` → conocimiento tenant-safe
   - `events/` → señales operativas y simulaciones
   - `templates/` → plantillas oficiales
   - `adr/` → decisiones estratégicas (Architecture Decision Records)

3. 🧾 **Añade frontmatter YAML:**  
   Usa como referencia `templates/registration-template.md` para incluir:  
   `id`, `version`, `status`, `scope`, `owners`, `tags`, etc.

4. 🗃 **Registra tu artefacto en el Registry:**  
   Abre `knowledge-registry.v1.md` y añade una línea a la tabla, siguiendo el formato estándar.

5. 🔗 **Asegura enlaces y consistencia:**  
   - Usa rutas relativas correctas (`../packs/...`)  
   - Valida que no haya enlaces rotos  
   - Verifica que el `scope` y `status` son coherentes

6. 📬 **Abre un Pull Request con este formato:**  

**Add [tipo] — [id] to DKS**

Ejemplo: `Add runbook — incident-escalation-v1 to DKS`

---

📘 ¿Dudas?  
Consulta el `walkthrough.md` o contacta con el equipo `drako-core`.

🚀 Este procedimiento garantiza que el conocimiento sea trazable, versionado y útil para todo el holding.
