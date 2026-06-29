import { getDatabase } from "../../state/index.js";

export interface MemoryEntry {
  id: string;
  sessionId: string;
  type: "short_term" | "long_term";
  key: string;
  value: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  expiresAt?: Date;
}

export class MemoryManager {
  private shortTerm = new Map<string, MemoryEntry[]>();
  private readonly SHORT_TERM_LIMIT = 100;

  async remember(sessionId: string, key: string, value: string, type: "short_term" | "long_term" = "short_term", metadata?: Record<string, unknown>): Promise<MemoryEntry> {
    const entry: MemoryEntry = {
      id: crypto.randomUUID(),
      sessionId,
      type,
      key,
      value,
      metadata,
      createdAt: new Date(),
      expiresAt: type === "short_term" ? new Date(Date.now() + 30 * 60 * 1000) : undefined,
    };

    if (type === "short_term") {
      const sessionMemory = this.shortTerm.get(sessionId) || [];
      sessionMemory.push(entry);
      if (sessionMemory.length > this.SHORT_TERM_LIMIT) {
        sessionMemory.shift();
      }
      this.shortTerm.set(sessionId, sessionMemory);
    } else {
      const db = getDatabase();
      await db
        .insertInto("memories")
        .values({
          id: entry.id,
          sessionId: entry.sessionId,
          type: entry.type,
          key: entry.key,
          value: entry.value,
          metadata: JSON.stringify(metadata || {}),
          createdAt: entry.createdAt.toISOString(),
          expiresAt: entry.expiresAt?.toISOString(),
        })
        .execute();
    }

    return entry;
  }

  async recall(sessionId: string, query: string, limit = 10): Promise<MemoryEntry[]> {
    const results: MemoryEntry[] = [];

    const sessionMemory = this.shortTerm.get(sessionId) || [];
    const matchingShortTerm = sessionMemory
      .filter((e) => e.key.includes(query) || e.value.includes(query))
      .slice(-limit);
    results.push(...matchingShortTerm);

    const db = getDatabase();
    const longTermRows = await db
      .selectFrom("memories")
      .selectAll()
      .where("sessionId", "=", sessionId)
      .where("type", "=", "long_term")
      .where((eb) =>
        eb.or([
          eb("key", "like", `%${query}%`),
          eb("value", "like", `%${query}%`),
        ])
      )
      .orderBy("createdAt", "desc")
      .limit(limit)
      .execute() as any[];

    for (const row of longTermRows) {
      results.push({
        id: row.id,
        sessionId: row.sessionId,
        type: row.type as "short_term" | "long_term",
        key: row.key,
        value: row.value,
        metadata: JSON.parse(row.metadata || "{}"),
        createdAt: new Date(row.createdAt),
        expiresAt: row.expiresAt ? new Date(row.expiresAt) : undefined,
      });
    }

    return results.slice(-limit);
  }

  async forget(sessionId: string, key?: string): Promise<number> {
    if (key) {
      const sessionMemory = this.shortTerm.get(sessionId) || [];
      const filtered = sessionMemory.filter((e) => e.key !== key);
      this.shortTerm.set(sessionId, filtered);

      const db = getDatabase();
      const result = await db
        .deleteFrom("memories")
        .where("sessionId", "=", sessionId)
        .where("key", "=", key)
        .executeTakeFirst();
      return Number(result.numDeletedRows);
    } else {
      this.shortTerm.delete(sessionId);
      const db = getDatabase();
      const result = await db
        .deleteFrom("memories")
        .where("sessionId", "=", sessionId)
        .executeTakeFirst();
      return Number(result.numDeletedRows);
    }
  }

  async list(sessionId: string, type?: "short_term" | "long_term"): Promise<MemoryEntry[]> {
    if (type === "short_term") {
      return this.shortTerm.get(sessionId) || [];
    }

    const db = getDatabase();
    let query = db
      .selectFrom("memories")
      .selectAll()
      .where("sessionId", "=", sessionId)
      .orderBy("createdAt", "desc");

    if (type) {
      query = query.where("type", "=", type);
    }

    const rows = (await query.execute()) as any[];
    return rows.map((row) => ({
      id: row.id,
      sessionId: row.sessionId,
      type: row.type as "short_term" | "long_term",
      key: row.key,
      value: row.value,
      metadata: JSON.parse(row.metadata || "{}"),
      createdAt: new Date(row.createdAt),
      expiresAt: row.expiresAt ? new Date(row.expiresAt) : undefined,
    }));
  }

  async getImportantFacts(sessionId: string, limit = 20): Promise<string[]> {
    const db = getDatabase();
    const rows = await db
      .selectFrom("memories")
      .select(["key", "value"])
      .where("sessionId", "=", sessionId)
      .where("type", "=", "long_term")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .execute() as any[];

    return rows.map((r) => `${r.key}: ${r.value}`);
  }
}
