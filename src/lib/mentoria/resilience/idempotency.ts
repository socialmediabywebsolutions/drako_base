import { getDb } from "@/lib/db";

export type IdempotencyResult<T> = {
  isNew: boolean;
  result: T;
};

type IdempotencyKeyRow = {
  id: string;
  tenant_id: string;
  idempotency_key: string;
  operation_type: string;
  result_json: string;
  created_at: string;
};

export class IdempotencyManager {
  constructor(private db: D1Database = getDb()) {}

  /**
   * Execute operation with idempotency guarantee
   * If same key is called twice, returns cached result
   */
  async executeIdempotent<T>(input: {
    tenantId: string;
    idempotencyKey: string;
    operationType: string;
    operation: () => Promise<T>;
  }): Promise<IdempotencyResult<T>> {
    // Check if operation already executed
    const existing = await this.db
      .prepare(
        `SELECT result_json FROM mentoria_idempotency_keys
         WHERE tenant_id = ? AND idempotency_key = ? AND operation_type = ?
         LIMIT 1`
      )
      .bind(input.tenantId, input.idempotencyKey, input.operationType)
      .first<{ result_json: string }>();

    if (existing) {
      return {
        isNew: false,
        result: JSON.parse(existing.result_json) as T,
      };
    }

    // Execute operation
    const result = await input.operation();

    // Store result
    const now = new Date().toISOString();
    try {
      await this.db
        .prepare(
          `INSERT INTO mentoria_idempotency_keys (
            id, tenant_id, idempotency_key, operation_type, result_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(crypto.randomUUID(), input.tenantId, input.idempotencyKey, input.operationType, JSON.stringify(result), now)
        .run();
    } catch (error) {
      // If insert fails (duplicate key), that's OK - another request beat us to it
      console.warn("[IdempotencyManager] Failed to store idempotency key:", error);
    }

    return {
      isNew: true,
      result,
    };
  }

  /**
   * Check if operation was already executed
   */
  async hasExecuted(input: {
    tenantId: string;
    idempotencyKey: string;
    operationType: string;
  }): Promise<boolean> {
    const result = await this.db
      .prepare(
        `SELECT id FROM mentoria_idempotency_keys
         WHERE tenant_id = ? AND idempotency_key = ? AND operation_type = ?
         LIMIT 1`
      )
      .bind(input.tenantId, input.idempotencyKey, input.operationType)
      .first<{ id: string }>();

    return !!result;
  }

  /**
   * Get cached result of previous execution
   */
  async getResult<T>(input: {
    tenantId: string;
    idempotencyKey: string;
    operationType: string;
  }): Promise<T | null> {
    const result = await this.db
      .prepare(
        `SELECT result_json FROM mentoria_idempotency_keys
         WHERE tenant_id = ? AND idempotency_key = ? AND operation_type = ?
         LIMIT 1`
      )
      .bind(input.tenantId, input.idempotencyKey, input.operationType)
      .first<{ result_json: string }>();

    if (!result) {
      return null;
    }

    return JSON.parse(result.result_json) as T;
  }

  /**
   * Clean up old idempotency keys (older than 24 hours)
   */
  async cleanup(): Promise<number> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const result = await this.db
      .prepare(
        `DELETE FROM mentoria_idempotency_keys
         WHERE created_at < ?`
      )
      .bind(oneDayAgo)
      .run();

    return (result.meta as any)?.changes ?? 0;
  }
}
