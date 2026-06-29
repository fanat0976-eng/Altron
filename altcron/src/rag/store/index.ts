import { getDatabase } from "../../state/index.js";

export interface VectorEntry {
  id: string;
  documentId: string;
  path: string;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface SearchResult {
  entry: VectorEntry;
  score: number;
}

export class VectorStore {
  async initialize(): Promise<void> {
    // Table is created in state/index.ts during database initialization
  }

  async add(entry: Omit<VectorEntry, "createdAt">): Promise<void> {
    const db = getDatabase();
    const now = new Date().toISOString();

    await db
      .insertInto("vector_chunks")
      .values({
        id: entry.id,
        documentId: entry.documentId,
        path: entry.path,
        content: entry.content,
        embedding: JSON.stringify(entry.embedding),
        metadata: JSON.stringify(entry.metadata),
        createdAt: now,
      })
      .execute();
  }

  async addBatch(entries: Omit<VectorEntry, "createdAt">[]): Promise<void> {
    for (const entry of entries) {
      await this.add(entry);
    }
  }

  async removeByDocument(documentId: string): Promise<void> {
    const db = getDatabase();
    await db.deleteFrom("vector_chunks").where("documentId", "=", documentId).execute();
  }

  async clearAll(): Promise<void> {
    const db = getDatabase();
    await db.deleteFrom("vector_chunks").execute();
  }

  async removeByPath(path: string): Promise<void> {
    const db = getDatabase();
    await db.deleteFrom("vector_chunks").where("path", "like", `${path}%`).execute();
  }

  async search(queryEmbedding: number[], topK = 5, filter?: { path?: string }): Promise<SearchResult[]> {
    const db = getDatabase();
    let query = db.selectFrom("vector_chunks").selectAll();

    if (filter?.path) {
      query = query.where("path", "like", `${filter.path}%`);
    }

    const rows = await query.execute();
    const results: SearchResult[] = [];

    for (const row of rows) {
      const embedding: number[] = JSON.parse(row.embedding);
      const score = this.cosineSimilarity(queryEmbedding, embedding);

      results.push({
        entry: {
          id: row.id,
          documentId: row.documentId,
          path: row.path,
          content: row.content,
          embedding,
          metadata: JSON.parse(row.metadata),
          createdAt: row.createdAt,
        },
        score,
      });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  async count(): Promise<number> {
    const db = getDatabase();
    const result = await db.selectFrom("vector_chunks").select((eb) => eb.fn.count("id").as("count")).executeTakeFirst();
    return Number(result?.count || 0);
  }

  async listPaths(): Promise<string[]> {
    const db = getDatabase();
    const results = await db.selectFrom("vector_chunks").select("path").distinct().execute();
    return results.map((r) => r.path);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }
}
