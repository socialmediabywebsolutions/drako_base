import { getDb } from "@/lib/db";

export function leak() {
  return getDb();
}
