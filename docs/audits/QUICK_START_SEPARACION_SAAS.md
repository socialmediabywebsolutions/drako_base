# 🚀 QUICK START — Separación SaaS Independientes

**Fecha:** 5 de Junio de 2026  
**Para:** Equipo de Desarrollo  
**Objetivo:** Primeros pasos concretos para iniciar la separación

---

## ⚡ TLDR

**¿Qué vamos a hacer?**  
Convertir el monolito `drako_base` en múltiples SaaS independientes (SocialFlow, Mentoría, Clinic) conectados a **Campamento Base** como control plane.

**¿Por qué?**  
- Deploy independiente por producto
- Escalado granular
- Aislamiento de errores
- Equipos autónomos
- Desarrollo más rápido

**¿Cuánto tiempo?**  
14-18 semanas dividido en 5 fases

**¿Dónde empezamos?**  
Fase 0 (Preparación) — Ver checklist abajo ⬇️

---

## 📋 CHECKLIST FASE 0 (Próximas 2-3 semanas)

### Week 1: Foundation

#### ✅ Día 1-2: Estructura Base
```bash
# 1. Crear estructura de workers
mkdir -p workers/{socialflow,mentoria,clinic,drako-systems,campamento-base}
mkdir -p workers/shared

# 2. Crear configs base
cat > workers/socialflow/wrangler.toml << 'EOF'
name = "socialflow-worker"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "drako_db_prod"
database_id = "<id>"
EOF

# Similar para otros productos...

# 3. Crear package.json para cada worker
cat > workers/socialflow/package.json << 'EOF'
{
  "name": "@drako/socialflow-worker",
  "version": "1.0.0",
  "private": true,
  "type": "module"
}
EOF
```

#### ✅ Día 3-4: Shared Capabilities Neutral

**Tarea:** Extraer `social-publishing` neutral

```bash
# 1. Crear módulo neutral
mkdir -p src/lib/social-publishing

# 2. Copiar lógica desde social-core
# (Preservar imports, limpiar dependencies product-specific)

# 3. Crear exports
cat > src/lib/social-publishing/index.ts << 'EOF'
export * from './types';
export * from './publishing';
EOF
```

**Archivos a crear:**
- `src/lib/social-publishing/types.ts` — Tipos neutrales
- `src/lib/social-publishing/publishing.ts` — Lógica de publishing
- `src/lib/social-publishing/config.ts` — Config neutral
- `src/lib/social-publishing/README.md` — Documentación

**Archivos a actualizar:**
- `src/lib/mentoria/acquisition-publishing.ts`
  - Cambiar: `from "@/lib/social-core/publishing"` 
  - A: `from "@/lib/social-publishing"`
- `src/lib/mentoria/resilience/socialflow-validation.ts` (mismo cambio)

**Validación:**
```bash
pnpm typecheck
pnpm test -- --run tests/lib/mentoria
pnpm build
```

#### ✅ Día 5: Campamento Base API Contract

**Tarea:** Documentar API Contract v1.0

✅ **Ya creado:** `docs/contracts/campamento-base-api-v1.0.md`

**Next steps:**
1. Revisar contract con equipo
2. Añadir endpoints faltantes
3. Crear TypeScript types:

```typescript
// src/lib/campamento-base/contracts/api-v1.ts

export namespace CampamentoBaseAPI {
  export namespace Auth {
    export type ValidateSessionRequest = {
      token: string;
      requestContext?: {
        ip?: string;
        userAgent?: string;
      };
    };

    export type ValidateSessionResponse = {
      valid: boolean;
      session?: {
        userId: string;
        tenantId: string;
        email: string;
        roles: string[];
        permissions: string[];
        expiresAt: string;
      };
      error?: {
        code: string;
        message: string;
      };
    };
  }
  
  // ... más namespaces
}
```

---

### Week 2: Tenant Isolation Hardening

#### ✅ Día 6-8: Auditar Queries sin tenant_id

**Script de auditoría:**

```typescript
// scripts/audit-tenant-isolation.ts

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const DANGEROUS_PATTERNS = [
  /SELECT\s+.*\s+FROM\s+(\w+)/gi,
  /UPDATE\s+(\w+)\s+SET/gi,
  /DELETE\s+FROM\s+(\w+)/gi,
];

async function auditFile(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf8');
  const violations: any[] = [];

  // Find SQL queries
  const queryMatches = content.matchAll(/`([^`]*(?:SELECT|UPDATE|DELETE)[^`]*)`/gis);
  
  for (const match of queryMatches) {
    const query = match[1];
    const lineNumber = content.substring(0, match.index).split('\n').length;
    
    // Check if query has WHERE tenant_id
    if (!query.includes('tenant_id') && !query.includes('TENANT_ID')) {
      violations.push({
        file: filePath,
        line: lineNumber,
        query: query.substring(0, 100) + '...',
        severity: 'HIGH'
      });
    }
  }
  
  return violations;
}

async function main() {
  const files = await glob('src/lib/**/*.ts');
  const allViolations: any[] = [];
  
  for (const file of files) {
    const violations = await auditFile(file);
    allViolations.push(...violations);
  }
  
  console.log(`Found ${allViolations.length} potential tenant isolation violations`);
  
  // Write report
  fs.writeFileSync(
    'docs/audits/TENANT_ISOLATION_VIOLATIONS.json',
    JSON.stringify(allViolations, null, 2)
  );
}

main();
```

**Run:**
```bash
pnpm tsx scripts/audit-tenant-isolation.ts
```

#### ✅ Día 9-10: Crear Guards de Tenant Isolation

```typescript
// src/lib/db/tenant-guards.ts

import { queryOne, queryAll, run } from '@/lib/db';

type TenantContext = {
  tenantId: string;
  userId?: string;
};

export class TenantIsolationError extends Error {
  constructor(message: string) {
    super(`TENANT_ISOLATION_VIOLATION: ${message}`);
    this.name = 'TenantIsolationError';
  }
}

/**
 * Guarded query methods that REQUIRE tenant_id
 */
export async function queryOneTenant<T>(
  context: TenantContext,
  sql: string,
  ...params: any[]
): Promise<T | null> {
  // Validate SQL contains tenant_id filter
  if (!sql.toLowerCase().includes('tenant_id')) {
    throw new TenantIsolationError(
      `Query must filter by tenant_id: ${sql.substring(0, 100)}`
    );
  }
  
  return queryOne<T>(sql, context.tenantId, ...params);
}

export async function queryAllTenant<T>(
  context: TenantContext,
  sql: string,
  ...params: any[]
): Promise<T[]> {
  if (!sql.toLowerCase().includes('tenant_id')) {
    throw new TenantIsolationError(
      `Query must filter by tenant_id: ${sql.substring(0, 100)}`
    );
  }
  
  return queryAll<T>(sql, context.tenantId, ...params);
}

export async function runTenant(
  context: TenantContext,
  sql: string,
  ...params: any[]
): Promise<void> {
  if (!sql.toLowerCase().includes('tenant_id')) {
    throw new TenantIsolationError(
      `Query must include tenant_id: ${sql.substring(0, 100)}`
    );
  }
  
  return run(sql, context.tenantId, ...params);
}
```

**Tests:**
```typescript
// tests/lib/db/tenant-guards.test.ts

import { describe, it, expect } from 'vitest';
import { queryOneTenant, TenantIsolationError } from '@/lib/db/tenant-guards';

describe('Tenant Guards', () => {
  it('should throw if query missing tenant_id filter', async () => {
    const context = { tenantId: 'test-tenant' };
    
    await expect(
      queryOneTenant(context, 'SELECT * FROM users WHERE id = ?', 'user_123')
    ).rejects.toThrow(TenantIsolationError);
  });
  
  it('should allow query with tenant_id filter', async () => {
    const context = { tenantId: 'test-tenant' };
    
    // This should NOT throw (even if query fails for other reasons)
    await queryOneTenant(
      context,
      'SELECT * FROM users WHERE tenant_id = ? AND id = ?',
      'user_123'
    );
  });
});
```

---

### Week 3: Nomenclatura y Documentación

#### ✅ Día 11-13: Resolver "Campamento Base" vs "Campobase"

**Decisión (ya en memoria):**
- **Campamento Base** = Control Plane (nuevo, canónico)
- **Campobase** = Operator Layer (legacy técnico, se mantiene por ahora)
- **Campo Base** = PROHIBIDO (eliminar)

**Cleanup:**
```bash
# 1. Buscar "Campo Base" en todo el código
grep -r "Campo Base" src/ docs/

# 2. Reemplazar por "Campamento Base" o "Campobase" según contexto

# 3. Actualizar documentación
# docs/architecture/nomenclature-canonical.md (crear)
```

#### ✅ Día 14-15: Crear Documentación de Arquitectura

**Archivos a crear:**

1. **`docs/architecture/multi-saas-architecture.md`**
   - Diagrama de arquitectura target
   - Explicación de capas
   - Flujo de datos
   - Security boundaries

2. **`docs/architecture/deployment-topology.md`**
   - Workers por producto
   - Domains mapping
   - DNS configuration
   - CDN strategy

3. **`docs/runbooks/saas-separation-runbook.md`**
   - Paso a paso para separar un producto
   - Checklist operacional
   - Rollback procedures

---

## 🎯 DELIVERABLES FASE 0

Al final de Fase 0 debes tener:

- ✅ Estructura de carpetas `workers/` creada
- ✅ `@/lib/social-publishing/` extraído y funcionando
- ✅ Campamento Base API Contract v1.0 documentado
- ✅ Tenant isolation audit completado
- ✅ Tenant guards implementados y testeados
- ✅ Nomenclatura consistente (no más "Campo Base")
- ✅ Documentación de arquitectura creada

**Métricas:**
- Separation Health: 60% → 65%
- Zero "Campo Base" en código
- 100% queries auditadas para tenant_id
- API Contract aprobado por stakeholders

---

## 🔄 WORKFLOW DIARIO

### Morning Standup
1. Review yesterday's progress
2. Identify blockers
3. Plan today's tasks (max 3)

### Daily Tasks
```bash
# 1. Pull latest
git pull origin main

# 2. Create feature branch
git checkout -b phase0/day-X-task-name

# 3. Make changes
# ... work ...

# 4. Validate
pnpm typecheck
pnpm test -- --run
pnpm build

# 5. Commit
git add .
git commit -m "phase0: <description>"

# 6. Push
git push origin phase0/day-X-task-name

# 7. Create PR (if ready)
```

### End of Day
- [ ] Update progress tracker
- [ ] Document blockers
- [ ] Prepare tomorrow's tasks

---

## 📊 TRACKING PROGRESS

### GitHub Project Board

Create columns:
- **Backlog** — All Phase 0 tasks
- **In Progress** — Current work
- **Review** — PRs pending review
- **Done** — Completed

### Daily Metrics Dashboard

Track:
- Tasks completed / Total tasks
- Test coverage %
- Build time
- Separation health score

---

## 🆘 TROUBLESHOOTING

### "Mi query no tiene tenant_id, ¿es un problema?"

**Sí, a menos que:**
- Sea query a tabla sin tenant (ej: `saas`, `core_departments`)
- Sea query de admin global (requiere explicit bypass)
- Sea seed/migration script (con comment explicativo)

**Fix:**
```typescript
// ❌ ANTES
const user = await queryOne('SELECT * FROM users WHERE id = ?', userId);

// ✅ DESPUÉS
const user = await queryOneTenant(
  { tenantId },
  'SELECT * FROM users WHERE tenant_id = ? AND id = ?',
  userId
);
```

### "¿Puedo usar código de otro producto?"

**No directamente. Opciones:**

1. **Extraer a shared capability neutral**
   - Ejemplo: `@/lib/social-publishing`
   - Solo para lógica genuinamente compartida

2. **Duplicar si product-specific**
   - Cada producto tiene su copia
   - Evita acoplamiento

3. **Exponer via Campamento Base API**
   - Si es funcionalidad central
   - Via API contract

### "Tests failing después de cambios"

**Checklist:**
1. `pnpm typecheck` — Fix type errors first
2. Update mocks si cambiaste interfaces
3. Update snapshots si output esperado cambió
4. Check tenant context en tests

---

## 📞 CONTACTOS

### Questions?
- **Architecture:** [Lead Architect]
- **DB/Migrations:** [DB Lead]
- **CI/CD:** [DevOps Lead]

### Daily Sync
- **Time:** 9:30 AM
- **Duration:** 15 min
- **Format:** Async in Slack if < 3 people available

---

## 🎉 CELEBRAR WINS

Cada viernes:
- Demo lo completado esta semana
- Update separation health score
- Share learnings
- Plan next week

---

**Ready to start?** Comienza con Week 1, Día 1-2: Estructura Base ⬆️
