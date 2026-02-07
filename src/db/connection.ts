import { Database } from "bun:sqlite";
import { config } from "../config";

let db: Database | null = null;

/**
 * Get a read-only connection to the Things 3 SQLite database.
 * The connection is lazily initialized and reused.
 */
export function getDb(): Database {
  if (!db) {
    db = new Database(config.dbPath, { readonly: true });
    // Enable WAL mode reading for better concurrent access
    db.exec("PRAGMA journal_mode = WAL");
  }
  return db;
}

/**
 * Close the database connection (for graceful shutdown).
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
