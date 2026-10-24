import { resolveSocialFlowAuthsDb } from "@/lib/socialflow/platform/auth/repository";

// Registro de la aceptación de los Términos y de la Política de privacidad al crear la cuenta.
// Guarda la fecha/hora (ISO 8601, UTC) en socialflow_users.accepted_terms_at como prueba.
//
// MIGRACIÓN DEFENSIVA: SQLite/D1 NO soporta `ALTER TABLE … ADD COLUMN IF NOT EXISTS`, y el workflow
// de deploy ejecuta las migraciones de SOCIALFLOW_AUTHS_DB una a una (un ALTER incondicional en un
// fichero de migraciones fallaría al repetirse; ver 0198_socialflow_users_account_type.sql). Por eso
// la columna se crea aquí, solo si falta: se intenta el UPDATE y, si la columna no existe, se
// comprueba con PRAGMA y se añade antes de reintentar.
const TABLE = "socialflow_users";
const COLUMN = "accepted_terms_at";

const isMissingColumn = (error: unknown) =>
  /no such column|has no column named/i.test(error instanceof Error ? error.message : String(error));
const isDuplicateColumn = (error: unknown) =>
  /duplicate column name/i.test(error instanceof Error ? error.message : String(error));

async function ensureAcceptedTermsColumn(db: D1Database): Promise<void> {
  const info = await db.prepare(`PRAGMA table_info(${TABLE})`).all<{ name: string }>();
  if (info.results?.some((column) => column.name === COLUMN)) return;
  try {
    await db.prepare(`ALTER TABLE ${TABLE} ADD COLUMN ${COLUMN} TEXT`).run();
  } catch (error) {
    // Otra petición concurrente pudo crearla entre la comprobación y el ALTER.
    if (!isDuplicateColumn(error)) throw error;
  }
}

async function writeAcceptance(db: D1Database, userId: string, acceptedAt: string): Promise<void> {
  await db.prepare(`UPDATE ${TABLE} SET ${COLUMN} = ? WHERE id = ?`).bind(acceptedAt, userId).run();
}

/**
 * Registra la aceptación. No lanza: un fallo aquí se registra en el log pero no impide el alta
 * (devuelve false), para no bloquear registros por un problema de esquema.
 */
export async function recordTermsAcceptance(userId: string, acceptedAt: string = new Date().toISOString()): Promise<boolean> {
  const db = resolveSocialFlowAuthsDb();
  if (!db) {
    console.error("SOCIALFLOW_TERMS_ACCEPTANCE_DB_MISSING", { userId });
    return false;
  }
  try {
    await writeAcceptance(db, userId, acceptedAt);
    return true;
  } catch (error) {
    if (!isMissingColumn(error)) {
      console.error("SOCIALFLOW_TERMS_ACCEPTANCE_ERROR", { userId, message: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }
  try {
    await ensureAcceptedTermsColumn(db);
    await writeAcceptance(db, userId, acceptedAt);
    return true;
  } catch (error) {
    console.error("SOCIALFLOW_TERMS_ACCEPTANCE_MIGRATION_ERROR", { userId, message: error instanceof Error ? error.message : String(error) });
    return false;
  }
}
