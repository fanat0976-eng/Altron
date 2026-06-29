import { getConfig } from "../../config/index.js";

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  tokens: number;
}

export class Embedder {
  private baseUrl: string;
  private model: string;

  constructor(options?: { baseUrl?: string; model?: string }) {
    const cfg = getConfig().llm.ollama;
    this.baseUrl = options?.baseUrl || cfg.baseUrl;
    this.model = options?.model || "nomic-embed-text";
  }

  async embed(text: string): Promise<EmbeddingResult> {
    const res = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        prompt: text,
      }),
    });

    if (!res.ok) {
      throw new Error(`Embedding failed: ${res.status} ${await res.text()}`);
    }

    const data: any = await res.json();

    return {
      embedding: data.embedding,
      model: this.model,
      tokens: data.prompt_eval_count || 0,
    };
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];
    for (const text of texts) {
      const result = await this.embed(text);
      results.push(result);
    }
    return results;
  }

  getDimension(): number {
    return 768;
  }
}
