# Despliegue Automático (CI/CD) - SOLO-WORKER Architecture

Este proyecto utiliza una arquitectura de **Solo-Worker (OpenNext)**. GitHub Actions despliega UI + APIs en un único Worker de Cloudflare.

## 1. Crear Token en Cloudflare

Debes generar un token de API con los permisos específicos para que GitHub pueda realizar el despliegue:

1. Ve a **My Profile > API Tokens** en el dashboard de Cloudflare.
2. Haz clic en **Create Token**.
3. Usa el template **Edit Cloudflare Workers** o crea uno personalizado con estos permisos:
   - **Account** | **D1** | **Edit**
   - **Account** | **Workers Scripts** | **Edit**
   - **Account** | **Pages** | **Edit**
   - **Account** | **Queues** | **Edit**
   - **Account** | **Workers KV Storage** | **Edit**
   - **Account** | **R2 Storage** | **Edit** (si aplica)
4. Copia el token generado.

## 2. Configurar GitHub Secrets

En tu repositorio de GitHub, ve a **Settings > Secrets and variables > Actions** y añade los siguientes **Secrets**:

- `CLOUDFLARE_API_TOKEN`: El token que acabas de crear.
- `CLOUDFLARE_ACCOUNT_ID`: Tu ID de cuenta (puedes encontrarlo en la URL del dashboard o en la configuración de cualquier Worker).

## 3. Disparar el Despliegue

El despliegue se activa automáticamente en cada **push a la rama `main`**. Los comandos utilizados por el sistema son:

- **Build**: `npm run cf:build` (genera `.open-next/worker.js`).
- **Deploy**: `npm run cf:deploy` (despliega en el entorno `production`).

Para forzar un despliegue manual o inicial:
1. Haz un commit vacío: `git commit --allow-empty -m "trigger deploy"`
2. Sube los cambios: `git push origin main`

## 4. Verificación Automática (Smoke Test)

Tras cada despliegue, el pipeline ejecutará un "Smoke Job" que verifica:
- `GET https://drako.systems/api/health` -> 200 OK.
- `GET https://drako.systems/api/saas` -> 200 OK.
- `GET https://drako.systems/api/agents` -> 200 OK.

---

## 🛠️ Configuración de Dominio (Drako Solo-Worker)

Para que el dominio funcione correctamente, Cloudflare debe apuntar al Worker:

### A. Limpieza de conflicto (OBLIGATORIO)
1. **Borra** `drako.systems` de cualquier proyecto de **Pages**.
2. **Borra** registros `A` de DNS que apunten a `76.76.21.21` (Vercel).

### B. Vinculación al Worker
1. Ve a **Workers & Pages > drako-base-3 (Worker) > Settings > Triggers**.
2. En **Custom Domains**, añade `drako.systems` y `www.drako.systems`.

### C. DNS Recomendado
- El dominio raíz `@` debe tener un registro **CNAME** o **A** administrado por el Custom Domain del Worker.
- Asegúrate de que el SSL esté en modo **Full** o **Full (Strict)**.

---

## 🚀 Cloudflare UI Configuration

Configura estos 2 comandos exactos en **Settings > Build & Deploy**:
- **Build command**: `npm run cf:build`
- **Deploy command**: `npx wrangler deploy --config wrangler.workers.toml --env production`

## 🚀 Cloudflare Dashboard Checklist

Sigue estos puntos para asegurar que la migración sea exitosa:
- [ ] **Workers & Pages > drako-base-3 (Pages)**: Asegúrate de que **NO** tiene dominios vinculados.
- [ ] **Workers & Pages > drako-base-3 (Worker) > Settings > Triggers**: Confirma que `drako.systems` aparece como **Custom Domain**.
- [ ] **DNS**: Verifica que no hay registros `A` apuntando a Vercel (`76.76.21.21`).
