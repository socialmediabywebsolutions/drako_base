# Cloudflare API Token Setup - Permisos Requeridos

## 🎯 Token para GitHub Actions Deploy

### Permisos Necesarios

Para que `wrangler deploy` funcione con D1, Workers AI, y bindings:

**Account:**
- ✅ **Account Settings:Read**

**Workers:**
- ✅ **Workers Scripts:Edit**
- ✅ **Workers Routes:Edit** (si usas custom domains/routes)

**D1:**
- ✅ **D1:Edit**

**Workers AI:**
- ✅ No requiere permiso extra (incluido en Workers)

**KV/R2/DO** (si los usas):
- ✅ **Workers KV Storage:Edit**
- ✅ **R2:Edit**
- ✅ **Durable Objects:Edit**

---

## 📋 Paso a Paso

### 1. Crear Token

**Cloudflare Dashboard:**
1. My Profile → **API Tokens**
2. **Create Token**
3. **Custom token** (no usar template)

### 2. Configurar Permisos

**Token name:** `GitHub Actions - Workers Deploy`

**Permissions:**

| Resource | Permission |
|----------|-----------|
| Account | Account Settings:Read |
| Zone | Workers Routes:Edit |
| Account | Workers Scripts:Edit |
| Account | D1:Edit |

**Account Resources:**
- Include → Specific account → [tu account]

**Zone Resources:**
- Include → Specific zone → drako.systems (si usas custom domain)
- O "All zones" si quieres flexibilidad

**TTL:** Start now, No expiration

### 3. Guardar Token

```
⚠️ IMPORTANTE: Copia el token ahora - solo se muestra una vez
```

Guárdalo como `CLOUDFLARE_API_TOKEN` en GitHub Secrets.

---

## 🔧 Template Alternativo (Más Simple)

Si no quieres configurar manual, usa:

**Template:** "Edit Cloudflare Workers"

Luego agrega manualmente:
- ✅ D1:Edit (Account permission)
- ✅ Account Settings:Read

---

## ❌ Errores Comunes

### "Permission denied: D1"

**Causa:** Token sin permiso D1:Edit

**Fix:** Crear nuevo token con D1:Edit incluido

### "Account access denied"

**Causa:** No seleccionaste "Account Resources: Specific account"

**Fix:** Editar token, agregar Account Resources

### "Zone not found"

**Causa:** No incluiste la zone para custom domain

**Fix:** 
- Si no usas custom domain: ignorar
- Si usas: agregar Zone Resources

---

## ✅ Verificar Token

```bash
# Test token locally (opcional)
export CLOUDFLARE_API_TOKEN="tu-token"
wrangler whoami

# Debe mostrar:
# Account: [tu account name]
# Account ID: [tu account id]
```

---

## 📝 GitHub Secrets

Agregar 2 secrets en GitHub:

**CLOUDFLARE_API_TOKEN**
```
[el token que acabas de crear]
```

**CLOUDFLARE_ACCOUNT_ID**
```
Cloudflare Dashboard → Workers & Pages → Overview → Account ID
```

---

## 🎯 Resumen

**Permisos mínimos para este proyecto:**

```
Account Settings:Read
Workers Scripts:Edit  
Workers Routes:Edit   (solo si usas custom domain)
D1:Edit              (tienes D1 databases)
```

**NO necesitas:**
- KV/R2 (no los usas)
- Durable Objects (no los usas)
- Zone DNS (Pages/Routes los maneja)

---

## ⚡ Quick Create

**Comando template:**

```json
{
  "name": "GitHub Actions - Workers Deploy",
  "policies": [
    {
      "effect": "allow",
      "resources": {
        "com.cloudflare.edge.account.<ACCOUNT_ID>": "*"
      },
      "permission_groups": [
        {"id": "c8fed203ed3043cba015a93ad1616f1f", "name": "Account Settings Read"},
        {"id": "e086da7e2179491d91ee5f35b3ca210a", "name": "Workers Scripts Edit"},
        {"id": "d1ede1cde93e443b8e4c6e79c9b36f64", "name": "D1 Edit"}
      ]
    }
  ]
}
```

Reemplaza `<ACCOUNT_ID>` con tu account ID real.

---

## 🚀 Deploy Test

Después de configurar secrets:

```bash
# Push trigger workflow
git push origin feat/migrate-to-opennext-workers

# O manual trigger en GitHub Actions
```

Si falla con "permission denied", revisa permisos del token.
