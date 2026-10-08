// Threads publishing — llamado desde live-publishing.ts
// Flujo: 1) crear container → 2) publicar container → devolver ID externo del post

import { createThreadsContainer, publishThreadsContainer } from "@/lib/socialflow/threads/core";
import { requireThreadsCredentials } from "@/lib/socialflow/threads/repository";
import { ThreadsIntegrationError } from "@/lib/socialflow/threads/types";
import type { SaasSocialAccount } from "@/lib/social-core/types";

// Threads permite posts de texto puro (sin imagen) a diferencia de Instagram.
// Si hay imageUrl, se publica como IMAGE; si no, como TEXT.
export async function publishToThreads(
  account: SaasSocialAccount,
  text: string,
  imageUrl: string | null,
): Promise<{ externalPostId: string }> {
  const creds = await requireThreadsCredentials(account);

  const mediaType = imageUrl ? "IMAGE" : "TEXT";

  // Paso 1: crear container
  let container;
  try {
    container = await createThreadsContainer({
      userId: creds.userId,
      accessToken: creds.accessToken,
      text,
      mediaType,
      mediaUrl: imageUrl,
    });
  } catch (err) {
    if (err instanceof ThreadsIntegrationError) throw err;
    throw new ThreadsIntegrationError(
      `Threads container creation error: ${err instanceof Error ? err.message : String(err)}`,
      { code: "THREADS_CONTAINER_FAILED" },
    );
  }

  // Paso 2: publicar el container
  // Threads recomienda esperar 30s entre creación y publicación para procesar medios.
  // En producción este delay es aceptable porque el cron de publicación no es real-time.
  if (mediaType === "IMAGE") {
    await new Promise((resolve) => setTimeout(resolve, 5000)); // 5s mínimo para imágenes
  }

  let result;
  try {
    result = await publishThreadsContainer({
      userId: creds.userId,
      accessToken: creds.accessToken,
      creationId: container.id,
    });
  } catch (err) {
    if (err instanceof ThreadsIntegrationError) throw err;
    throw new ThreadsIntegrationError(
      `Threads publish error: ${err instanceof Error ? err.message : String(err)}`,
      { code: "THREADS_PUBLISH_FAILED" },
    );
  }

  return { externalPostId: result.id };
}
