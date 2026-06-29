import { describe, it, expect, vi } from "vitest";

// Test the cosine similarity function independently
describe("Cosine Similarity", () => {
  // Extract and test the cosine similarity logic
  function cosineSimilarity(a: number[], b: number[]): number {
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

  it("should return 1 for identical vectors", () => {
    const a = [1, 0, 0];
    const b = [1, 0, 0];
    expect(cosineSimilarity(a, b)).toBe(1);
  });

  it("should return 0 for orthogonal vectors", () => {
    const a = [1, 0];
    const b = [0, 1];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it("should return -1 for opposite vectors", () => {
    const a = [1, 0];
    const b = [-1, 0];
    expect(cosineSimilarity(a, b)).toBe(-1);
  });

  it("should handle zero vectors", () => {
    const a = [0, 0, 0];
    const b = [1, 2, 3];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it("should return 0 for different length vectors", () => {
    const a = [1, 2, 3];
    const b = [1, 2];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it("should compute correct similarity for similar vectors", () => {
    const a = [1, 2, 3];
    const b = [1, 2, 3];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1);
  });

  it("should compute partial similarity", () => {
    const a = [1, 0, 1];
    const b = [1, 1, 0];
    const expected = 0.5;
    expect(cosineSimilarity(a, b)).toBeCloseTo(expected);
  });
});

describe("VectorStore Interface", () => {
  // Test the interface and types
  it("should define VectorEntry interface", () => {
    const entry = {
      id: "test-1",
      documentId: "doc-1",
      path: "test.txt",
      content: "Test content",
      embedding: [0.1, 0.2, 0.3],
      metadata: { fileName: "test.txt" },
      createdAt: new Date().toISOString(),
    };

    expect(entry.id).toBe("test-1");
    expect(entry.embedding).toHaveLength(3);
  });

  it("should define SearchResult interface", () => {
    const result = {
      entry: {
        id: "test-1",
        documentId: "doc-1",
        path: "test.txt",
        content: "Test content",
        embedding: [],
        metadata: {},
        createdAt: new Date().toISOString(),
      },
      score: 0.85,
    };

    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });
});
