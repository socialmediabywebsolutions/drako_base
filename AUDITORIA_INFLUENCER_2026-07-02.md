# Auditoría técnica — Flujo Influencer (Foto → Post IA) — 2026-07-02

Auditoría de solo lectura sobre el flujo de subida de fotos de SocialFlow para cuentas tipo **Influencer** exclusivamente. Se leyó la lógica real de: `src/app/socialflow/(workspace)/upload/page.tsx`, `src/components/socialflow/upload-to-post.tsx`, `src/app/api/socialflow/posts/generate-from-image/route.ts`, `src/lib/socialflow/ai/agents/ImageAnalysisAgent.ts`, `ContentGeneratorAgent.ts`, `OptimizationAgent.ts`, `SchedulerAgent.ts`, `src/app/api/socialflow/posts/route.ts`, `src/lib/socialflow/scheduler.ts`, `src/lib/socialflow/live-publishing.ts` y `src/lib/socialflow/meta/publishing.ts`. No se modificó ningún archivo ni se tocaron datos de la cuenta de Sofía Maren (tenant_id `ea85eb95-3c1e-4192-a2de-333bba37b842`).

---

## 1. ¿El flujo completo funciona end-to-end tal como está hoy?

**Sí, en el caso normal — con dos riesgos reales que pueden romperlo.**

Cadena confirmada con código real en cada paso:
1. **Subida** → `POST /api/socialflow/media/upload` sube el archivo a R2 real.
2. **Análisis de imagen** → `ImageAnalysisAgent.run()` (`ImageAnalysisAgent.ts:15`) llama al modelo de visión real `@cf/llava-1.5-7b-hf` vía Cloudflare Workers AI, con fallback determinista si el binding falla.
3. **Caption + hashtags** → `ContentGeneratorAgent.run()` + `OptimizationAgent.run()` (ambos vía Mistral real, `posts/generate-from-image/route.ts:180-194`).
4. **Calendario** → lógica de "pasadas" inline en el mismo endpoint (ver punto 2).
5. **Aprobación** → `POST /api/socialflow/posts` con `status:"SCHEDULED"` — persiste en `saas_social_posts` (real, D1).
6. **Publicación real** → el worker Cloudflare (`scheduled()`, corre cada 5 min según auditoría previa) ejecuta `processScheduledPosts()` (`src/lib/socialflow/scheduler.ts:15`), que llama `publishSocialPostLive()` → `publishInstagramContent()` (`meta/publishing.ts`), con llamadas POST reales a `graph.facebook.com`.

**Dos condiciones pueden romper el "end-to-end" sin avisar al usuario:**
- **`SOCIALFLOW_PRIVATE_PILOT_MODE`** (bandera de entorno, `src/lib/socialflow/private-pilot.ts:39`): si está activa, `isAutoPublishBlockedByPrivatePilotMode()` devuelve `true` y **`processScheduledPosts()` salta todos los posts due con `status:"SKIPPED"`** — los posts quedan en `SCHEDULED` indefinidamente, nunca se publican solos, sin ningún error visible para el usuario en el workspace. Esta bandera es la misma que sustenta el "requisito de piloto" mencionado en `/socialflow/setup` de la auditoría general.
- **Bug de Reels** (ver punto 5): si LLaVA marca la foto como `REEL`/`STORY`, el post se agenda con ese tipo pero la publicación real fallaría.

Fuera de esos dos casos, el flujo fotografía→publicación en Instagram es real de punta a punta, no simulado.

---

## 2. SchedulerAgent y las "3 pasadas" — corrección de la descripción

**Corrección importante: el flujo de subida de fotos NO usa la clase `SchedulerAgent.ts`.** Esa clase (`src/lib/socialflow/ai/agents/SchedulerAgent.ts`) solo la usa el orquestador de campañas multi-post (`ai/generate`), con su propio algoritmo "wave-by-wave" sobre una ventana fija de 62 días.

El flujo de subida de fotos usa una lógica **distinta e independiente**, escrita inline en `src/app/api/socialflow/posts/generate-from-image/route.ts:224-309`. El algoritmo real:

- **Ventana**: 30 días **rodantes desde hoy** (`windowDays`, líneas 242-247) — NO es el mes calendario. No hay concepto de "fin de mes"; la ventana se recalcula en cada request tomando "hoy" como ancla.
- **Tope diario**: `MAX_POSTS_PER_DAY = isTrial ? 1 : 3` (línea 261) — 3 posts/día como máximo para cualquier plan de pago (no hay diferencia entre Influencer Básico y Pro en este límite).
- **Cálculo de la pasada actual** (líneas 262-268): recorre los niveles `p = 0, 1, 2`. Si encuentra **al menos un día** en la ventana con exactamente `p` posts ya ocupados, fija `currentPass = p + 1` y se detiene. Solo avanza de pasada cuando **todos los 30 días** de la ventana ya tienen `≥ p` posts — no basta con llenar unos pocos días.
- **Pool de días elegibles** (línea 271-273): `dayPool` = únicamente los días que tienen **exactamente** `currentPass - 1` posts. Cada foto nueva del lote elige `dayPool[batchIndex % dayPool.length]` — es decir, **cicla dentro de ese pool**, no asigna literalmente "1 foto por día en orden hasta fin de mes".
- **La hora es independiente de la pasada**: se deriva del contenido de la imagen vía `pickHourFromContent()` (comida→12h, descanso→21h, motivacional/texto→18h) o, si es ambiguo, rota entre 2-3 horas óptimas del nicho usando `batchIndex`.

**Sobre "vuelve al día actual y hace una segunda pasada"**: esto solo ocurre cuando la ventana completa de 30 días ya está saturada al nivel anterior — no es un comportamiento garantizado por subir un lote de fotos una sola vez. Con un lote típico (pocas fotos, calendario vacío), todas las fotos del lote caen en Pasada 1 repartidas en los primeros N días de la ventana; el "regreso a hoy" solo se activa cuando, por subidas acumuladas a lo largo del tiempo, los 30 días ya tienen al menos 1 post cada uno.

**Corrección adicional sobre el límite de fotos**: el límite real de fotos por lote **no es 8**. Ese `8` es solo el valor de *fallback* si falla la consulta de plan (`upload/page.tsx:14`, `.catch(() => 8)`). El límite real viene de `getUploadBatchLimit()` (`billing/enforce.ts:96-110`) vía `PLAN_MAX_UPLOADS_PER_BATCH`: **Influencer Básico = 30 fotos/lote, Influencer Pro = 60 fotos/lote**, con tope de 1 foto/lote durante el trial activo.

---

## 3. ¿Qué pasa si el mes ya está casi lleno (ej. 60 posts programados)?

**No hay bloqueo ni aviso — el sistema degrada silenciosamente amontonando posts en el día de hoy, con riesgo real de colisión de horario.**

Con la ventana de 30 días ya saturada a `MAX_POSTS_PER_DAY = 3` en todos los días:
- El bucle de detección de pasada (líneas 263-268) no encuentra ningún día con 0, 1 o 2 posts ocupados, así que `currentPass` se queda en su valor por defecto (`MAX_POSTS_PER_DAY = 3`, línea 262).
- `dayPool` se filtra por días con exactamente `currentPass - 1 = 2` posts — como **ningún** día tiene 2 (todos tienen 3, el máximo), `dayPool` queda **vacío**.
- Con `dayPool.length === 0`, el código cae al fallback explícito: `targetDate = windowDays[0]` (línea 277) — **literalmente hoy**, sin importar que ya esté al tope.
- Para la hora: si las 2-3 horas candidatas del nicho ya están todas ocupadas hoy, el `.find()` de la línea 296-301 no encuentra ninguna libre y cae al último fallback: `contentHourCandidates[0]` **aunque ya esté ocupada** — es decir, puede terminar generando **dos posts agendados exactamente al mismo día y hora**, sin ninguna validación que lo impida ni mensaje al usuario.

No existe ningún tope duro de "calendario lleno" ni error `423`/`409` — el único límite que sí bloquea con mensaje visible es el de **fotos por lote** (`Límite de {maxImages} fotos alcanzado`, `upload-to-post.tsx:734`), que es un límite de *cuántas fotos subes de una vez*, no de *cuánto está lleno el calendario*.

**Nota adicional**: el frontend calcula un `startDate` por foto para espaciarlas cada 2 días (`upload-to-post.tsx:681`) y lo envía al backend, pero `generate-from-image/route.ts` **declara el campo `startDate` en el tipo del body (línea 78) y nunca lo usa** en ningún punto de la lógica de agendamiento — es un parámetro muerto; el backend siempre calcula la fecha con su propia lógica de pasadas, ignorando lo que mande el frontend.

---

## 4. ¿El botón "Aprobar" del flujo de subida SÍ publica de verdad en Instagram?

**Sí publica de verdad, pero de forma diferida — y esto NO es el mismo bug que el de conversaciones.**

- `approveItem()` (`upload-to-post.tsx:751-794`) al hacer clic en "Aprobar" llama a `POST /api/socialflow/posts` con `status: "SCHEDULED"`. Ese endpoint (`posts/route.ts`) solo **persiste el registro** en `saas_social_posts` — no intenta publicar nada de inmediato (no envía `confirmPublish:true`, que es el único parámetro que dispararía publicación inmediata, y que además exigiría rol admin).
- La diferencia clave con el bug de conversaciones (donde "Aprobar" solo cambia un estado en BD y **nada más** vuelve a tocar la API de Meta) es que aquí **sí existe un segundo mecanismo automático real** que retoma el post después: el worker programado ejecuta `processScheduledPosts()` cada 5 minutos, que busca posts `SCHEDULED`/`APPROVED` con `scheduled_at <= ahora` y llama `publishSocialPostLive()` → `publishInstagramContent()`, con la llamada POST real a la Graph API de Meta (`meta/publishing.ts`).
- Por lo tanto: aprobar en el flujo de subida de fotos **sí termina publicando en Instagram de verdad**, en el momento programado (no al instante de aprobar) — es el comportamiento esperado de un calendario editorial, no un defecto.
- **Único caveat real**: esto depende de que `SOCIALFLOW_PRIVATE_PILOT_MODE` no esté bloqueando el auto-publish (ver punto 1) y de que la cuenta de Instagram conectada mantenga `status: CONNECTED_REAL` en el momento de publicar.

---

## 5. ¿Este flujo tiene el bug de Reels?

**Sí, aplica directamente — es el mismo bug, confirmado también en el flujo de influencer.**

- `ImageAnalysisAgent` (LLaVA) puede devolver `recommendedPostType: "REEL"` o `"STORY"` para **cualquier foto subida** — el prompt se lo permite explícitamente (`ImageAnalysisAgent.ts:42`: *"El campo recommendedPostType debe ser exactamente uno de: FEED, REEL o STORY"*), y no hay ninguna restricción que fuerce `FEED` para fotos estáticas.
- Ese valor se mapea 1:1 a `suggestedPost.contentType` (`generate-from-image/route.ts:312-317`) y llega **preseleccionado** en el dropdown de tipo de contenido de la tarjeta de edición (`upload-to-post.tsx:400-408`, opciones Feed/Reel/Story).
- Si el usuario aprueba sin corregir manualmente ese dropdown a "Feed" — algo fácil de pasar por alto, sobre todo con el botón "Aprobar todo" que aprueba el lote completo sin pasar por edición individual — el post se guarda con `content_type: REEL` pero `imageHint` sigue siendo la URL de la **foto estática original**. En ningún punto del flujo de subida se genera ni se sube video.
- Al llegar la hora programada: `publishSocialPostLive` → `mapToInstagramContentType()` (`live-publishing.ts:150`) preserva `"REEL"` tal cual → `publishInstagramContent()` (`meta/publishing.ts:176-177`) arma el contenedor con `media_type=REELS` y `video_url=<la foto estática>` — esto **fallaría contra la Graph API real**, que rechaza un `video_url` que no apunta a un archivo de video válido.
- No hay ninguna validación de backend que impida guardar o intentar publicar un post `REEL`/`STORY` cuyo `imageHint` sea una imagen.

**Conclusión**: el flujo de subida de fotos **no siempre genera FEED** — depende de lo que LLaVA interprete de cada imagen, y puede terminar marcado como Reel o Story con la misma consecuencia de fallo de publicación descrita en la auditoría general.

---

## 6. Variedad de captions — riesgo de repetición

**El riesgo es real y mayor de lo que sugiere el diseño: hay 5 aperturas por categoría, no 10.**

- Los "openers" (primeras líneas plantilla del caption) están agrupados por categoría de imagen — `gym`, `cocina`, `outdoor`, `lifestyle` — en `ContentGeneratorAgent.ts:35-64`, con **exactamente 5 opciones por categoría**.
- El endpoint calcula `openerIndex: (body.batchIndex ?? 0) % 10` (`generate-from-image/route.ts:187`), pero dentro de `ContentGeneratorAgent.run()` ese valor se vuelve a reducir con `% openers.length` (`ContentGeneratorAgent.ts:79`), y `openers.length` es **5**, no 10. El resultado: el `% 10` del endpoint no aporta variedad real, porque siempre se pliega de nuevo a un ciclo de 5 (`0,1,2,3,4,0,1,2,3,4,...`).
- `batchIndex` arranca en `activeCount` del componente React (`upload-to-post.tsx:746`), que se reinicia cada vez que el usuario recarga o vuelve a `/socialflow/upload` — no es un contador acumulativo histórico del tenant. Esto implica que **la primera foto de cada sesión de subida siempre cae en el opener índice 0** de su categoría.
- Con el plan **Influencer Pro (60 fotos/lote)** y una temática de nicho consistente (p. ej. una influencer fitness, donde la mayoría de fotos se clasifican como `"gym"` vía `pickOpenerCategory`), un solo lote de 60 fotos cicla por solo 5 aperturas plantilla — cada apertura se reutiliza **~12 veces dentro del mismo lote**.
- Mitigante parcial: el prompt le exige al LLM "adaptar la apertura al tema concreto del post" (`ContentGeneratorAgent.ts:117`), así que el texto final no es literalmente idéntico entre repeticiones — pero la **estructura y el gancho** de la primera línea se repiten cada 5 posts, lo cual es detectable tanto por un lector atento como potencialmente por los sistemas de detección de contenido repetitivo de Instagram.
- Los **hashtags** tienen más variedad real: combinan hashtags del perfil del tenant + un pool fijo de 12 hashtags de nicho fitness (si aplica) + hashtags de tendencia reales de `TrendAgent` + hashtags derivados de los temas que LLaVA detectó en cada imagen específica — varían más entre fotos que las aperturas de caption.

---

## Resumen de hallazgos nuevos (específicos de este flujo)

| Hallazgo | Severidad |
|---|---|
| Bug de Reels confirmado también en subida de fotos de influencer: LLaVA puede marcar cualquier foto como REEL/STORY sin generar video, y el post fallaría al publicarse si el usuario no corrige el dropdown manualmente. | Alta |
| `SOCIALFLOW_PRIVATE_PILOT_MODE` puede bloquear el auto-publish para todos los tenants sin ningún aviso visible en el workspace — los posts quedan "programados" para siempre. | Alta (depende de si está activo en producción) |
| Cuando el calendario de 30 días está saturado (3 posts/día en todos los días), las fotos nuevas se amontonan silenciosamente en el día de hoy, con riesgo de colisión de horario exacto sin ninguna validación ni aviso. | Media |
| Solo 5 aperturas de caption únicas por categoría de imagen (no 10) — con lotes grandes (Influencer Pro, 60 fotos) hay repetición estructural real de la primera línea cada 5 posts. | Media |
| El botón "Aprobar" del flujo de subida SÍ desemboca en publicación real (a diferencia del botón "Aprobar" de conversaciones, que no publica nada) — el mecanismo de cron/scheduler es real y correcto. | N/A (confirmación positiva) |
| El campo `startDate` calculado por el frontend para espaciar fotos se envía al backend pero nunca se usa — código muerto, sin impacto funcional porque la lógica de pasadas lo reemplaza igualmente. | Baja |

---

*Metodología: lectura directa del código fuente real (no nombres de archivo) de los 10 archivos listados al inicio. No se realizaron cambios de código ni se consultaron datos de tenants de producción, incluida explícitamente la cuenta de Sofía Maren.*
