import Database from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";
import { getConfig } from "../config/index.js";

export interface MessagesTable {
  id: string;
  sessionId: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolName?: string;
  createdAt: string;
}

export interface SessionsTable {
  id: string;
  name: string;
  model: string;
  systemPrompt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemoriesTable {
  id: string;
  sessionId: string;
  type: "short_term" | "long_term";
  key: string;
  value: string;
  metadata?: string;
  createdAt: string;
  expiresAt?: string;
}

export interface VectorChunksTable {
  id: string;
  documentId: string;
  path: string;
  content: string;
  embedding: string;
  metadata: string;
  createdAt: string;
}

export interface DatabaseSchema {
  messages: MessagesTable;
  sessions: SessionsTable;
  memories: MemoriesTable;
  vector_chunks: VectorChunksTable;
}

let db: Kysely<DatabaseSchema> | null = null;
let sqliteDb: Database.Database | null = null;

export function getDatabase(): Kysely<DatabaseSchema> {
  if (db) return db;

  const config = getConfig();
  sqliteDb = new Database(config.database.path);

  sqliteDb.pragma("journal_mode = WAL");
  sqliteDb.pragma("foreign_keys = ON");

  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      model TEXT NOT NULL DEFAULT 'qwen2.5:14b',
      systemPrompt TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
      content TEXT NOT NULL,
      toolCallId TEXT,
      toolName TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(sessionId);
    CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(createdAt);

    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('short_term', 'long_term')),
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      expiresAt TEXT,
      FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_memories_session ON memories(sessionId);
    CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
    CREATE INDEX IF NOT EXISTS idx_memories_key ON memories(key);

    CREATE TABLE IF NOT EXISTS vector_chunks (
      id TEXT PRIMARY KEY,
      documentId TEXT NOT NULL,
      path TEXT NOT NULL,
      content TEXT NOT NULL,
      embedding TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}',
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_vector_chunks_path ON vector_chunks(path);
    CREATE INDEX IF NOT EXISTS idx_vector_chunks_doc ON vector_chunks(documentId);
  `);

  db = new Kysely<DatabaseSchema>({
    dialect: new SqliteDialect({
      database: sqliteDb,
    }),
  });

  return db;
}

export function closeDatabase(): void {
  if (sqliteDb) {
    sqliteDb.close();
    sqliteDb = null;
    db = null;
  }
}
