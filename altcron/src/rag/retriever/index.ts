import { Embedder } from "../embedder/index.js";
import { VectorStore, type SearchResult } from "../store/index.js";
import { DocumentLoader, type Document } from "../loader/index.js";

export interface RetrieveOptions {
  topK?: number;
  path?: string;
  minScore?: number;
}

export interface IndexOptions {
  path: string;
  extensions?: string[];
}

export class Retriever {
  private embedder: Embedder;
  private store: VectorStore;
  private loader: DocumentLoader;
  private workDir: string;

  constructor(workDir: string) {
    this.workDir = workDir;
    this.embedder = new Embedder();
    this.store = new VectorStore();
    this.loader = new DocumentLoader({ workDir });
  }

  async initialize(): Promise<void> {
    await this.store.initialize();
  }

  async index(path: string, options?: { extensions?: string[] }): Promise<{ indexed: number; skipped: number; errors: number }> {
    await this.store.clearAll();

    const docs = await this.loader.load(path);
    let indexed = 0;
    let errors = 0;

    for (const doc of docs) {
      try {
        const result = await this.embedder.embed(doc.content);
        await this.store.add({
          id: doc.id,
          documentId: doc.path,
          path: doc.path,
          content: doc.content,
          embedding: result.embedding,
          metadata: doc.metadata,
        });
        indexed++;
      } catch (err) {
        errors++;
        console.error(`[RAG] Embed failed for ${doc.path}:`, (err as Error).message);
      }
    }

    return { indexed, skipped: docs.length - indexed - errors, errors };
  }

  async query(text: string, options?: RetrieveOptions): Promise<SearchResult[]> {
    const topK = options?.topK || 5;
    const minScore = options?.minScore || 0.3;

    const result = await this.embedder.embed(text);
    const results = await this.store.search(result.embedding, topK, {
      path: options?.path,
    });

    return results.filter((r) => r.score >= minScore);
  }

  async getContext(query: string, options?: RetrieveOptions): Promise<string> {
    const results = await this.query(query, options);
    if (results.length === 0) return "";

    const context = results
      .map((r, i) => `[${i + 1}] (score: ${r.score.toFixed(3)}) ${r.entry.path}\n${r.entry.content}`)
      .join("\n\n---\n\n");

    return context;
  }

  async getStats(): Promise<{ chunks: number; paths: string[] }> {
    const chunks = await this.store.count();
    const paths = await this.store.listPaths();
    return { chunks, paths };
  }

  async removeDocument(path: string): Promise<void> {
    await this.store.removeByDocument(path);
  }
}
