import { describe, it, expect, beforeAll } from "vitest";
import { loadConfig } from "../../src/config/index.js";
import { Embedder } from "../../src/rag/embedder/index.js";

// Load config first
beforeAll(() => {
  try {
    loadConfig();
  } catch {}
});

const OLLAMA_URL = "http://localhost:11434";
let ollamaAvailable = false;

beforeAll(async () => {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    const data = await res.json();
    ollamaAvailable = data.models?.some((m: any) => m.name.includes("nomic-embed-text"));
  } catch {
    ollamaAvailable = false;
  }
});

describe("Embedder Integration (nomic-embed-text)", { timeout: 30000 }, () => {
  let embedder: Embedder;

  beforeAll(() => {
    embedder = new Embedder();
  });

  it("should generate embedding for simple text", async () => {
    if (!ollamaAvailable) {
      console.log("⏭️  Skipping: nomic-embed-text not available");
      return;
    }

    const result = await embedder.embed("Hello world");

    expect(result.embedding).toBeDefined();
    expect(Array.isArray(result.embedding)).toBe(true);
    expect(result.embedding.length).toBe(768);
    expect(result.model).toBe("nomic-embed-text");
  });

  it("should generate different embeddings for different texts", async () => {
    if (!ollamaAvailable) {
      console.log("⏭️  Skipping: nomic-embed-text not available");
      return;
    }

    const result1 = await embedder.embed("The cat sat on the mat");
    const result2 = await embedder.embed("Python is a programming language");

    const isSame = result1.embedding.every((v, i) => v === result2.embedding[i]);
    expect(isSame).toBe(false);
  });

  it("should generate similar embeddings for similar texts", async () => {
    if (!ollamaAvailable) {
      console.log("⏭️  Skipping: nomic-embed-text not available");
      return;
    }

    const result1 = await embedder.embed("The cat sat on the mat");
    const result2 = await embedder.embed("A cat was sitting on a mat");

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < result1.embedding.length; i++) {
      dotProduct += result1.embedding[i] * result2.embedding[i];
      normA += result1.embedding[i] * result1.embedding[i];
      normB += result2.embedding[i] * result2.embedding[i];
    }
    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));

    expect(similarity).toBeGreaterThan(0.7);
  });

  it("should handle batch embedding", async () => {
    if (!ollamaAvailable) {
      console.log("⏭️  Skipping: nomic-embed-text not available");
      return;
    }

    const texts = [
      "First document about technology",
      "Second document about nature",
      "Third document about science",
    ];

    const results = await embedder.embedBatch(texts);

    expect(results).toHaveLength(3);
    for (const result of results) {
      expect(result.embedding.length).toBe(768);
    }
  });

  it("should return correct dimension", () => {
    expect(embedder.getDimension()).toBe(768);
  });
});
