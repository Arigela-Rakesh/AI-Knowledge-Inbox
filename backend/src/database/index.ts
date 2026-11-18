import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { config } from '../config';
import { logger } from '../utils/logger';

let db: Database | undefined;
let SQL: SqlJsStatic | undefined;
let dbFilePath: string | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Persist the in-memory sql.js database to disk.
 * Debounced to avoid excessive writes on bulk inserts.
 */
function scheduleSave(): void {
  if (!dbFilePath) return; // :memory: mode — no persistence needed
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (db && dbFilePath) {
      const data = db.export();
      fs.writeFileSync(dbFilePath, Buffer.from(data));
    }
  }, 200);
}

export function getDb(): Database {
  if (db) return db;

  if (!SQL) {
    throw new Error('Database not initialized. Call initDb() first.');
  }

  const dbPath = config.databasePath;

  if (dbPath === ':memory:') {
    db = new SQL.Database();
    dbFilePath = null;
  } else {
    const resolved = path.resolve(dbPath);
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    dbFilePath = resolved;
    if (fs.existsSync(resolved)) {
      const fileBuffer = fs.readFileSync(resolved);
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
    }
  }

  logger.info('Database connected', { path: dbPath });
  initSchema();
  return db;
}

export async function initDb(): Promise<void> {
  if (SQL) return;
  SQL = await initSqlJs();
  getDb();
}

function initSchema(): void {
  if (!db) return;
  db.run(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      source_type TEXT NOT NULL CHECK(source_type IN ('note','url')),
      source_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      token_count INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_chunks_item_id ON chunks(item_id);

    CREATE TABLE IF NOT EXISTS embeddings (
      id TEXT PRIMARY KEY,
      chunk_id TEXT NOT NULL,
      model TEXT NOT NULL,
      dimensions INTEGER NOT NULL,
      vector BLOB NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(chunk_id) REFERENCES chunks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_embeddings_chunk_id ON embeddings(chunk_id);
  `);
  scheduleSave();
  logger.info('Database schema initialized');
}

/** Execute a statement that returns no rows (INSERT/UPDATE/DELETE/CREATE) */
export function dbRun(sql: string, params: (string | number | null | Uint8Array)[] = []): void {
  getDb().run(sql, params);
  scheduleSave();
}

/** Execute a SELECT and return all rows as objects */
export function dbAll<T = Record<string, unknown>>(sql: string, params: (string | number | null | Uint8Array)[] = []): T[] {
  const stmt = getDb().prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

/** Execute a SELECT and return the first row or undefined */
export function dbGet<T = Record<string, unknown>>(sql: string, params: (string | number | null | Uint8Array)[] = []): T | undefined {
  const rows = dbAll<T>(sql, params);
  return rows[0];
}

export function closeDb(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    // Final sync save
    if (db && dbFilePath) {
      const data = db.export();
      fs.writeFileSync(dbFilePath, Buffer.from(data));
    }
  }
  if (db) {
    db.close();
    db = undefined;
  }
  SQL = undefined;
}
