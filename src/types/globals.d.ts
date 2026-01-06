// Ambient types to allow development without @cloudflare/workers-types installed.
// Replace with official types by installing devDependency: @cloudflare/workers-types

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<{ success: boolean; meta?: T }>; 
  all<T = unknown>(): Promise<{ results: T[] }>; 
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump?(): Promise<ArrayBuffer>;
}
