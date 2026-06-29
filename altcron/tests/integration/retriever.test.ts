import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loadConfig } from "../../src/config/index.js";
import { getDatabase, closeDatabase } from "../../src/state/index.js";
import { Retriever } from "../../src/rag/retriever/index.js";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";

// Load config first
beforeAll(() => {
  try {
    loadConfig();
  } catch {}
  // Initialize database
  getDatabase();
});

afterAll(() => {
  closeDatabase();
});

const OLLAMA_URL = "http://localhost:11434";
let ollamaAvailable = false;
const TEST_DIR = join(process.cwd(), "test-rag-integration");

beforeAll(async () => {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    const data = await res.json();
    ollamaAvailable = data.models?.some((m: any) => m.name.includes("nomic-embed-text"));
  } catch {
    ollamaAvailable = false;
  }

  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true });
  }
  mkdirSync(TEST_DIR, { recursive: true });

  writeFileSync(
    join(TEST_DIR, "ai-intro.md"),
    `# Introduction to Artificial Intelligence

Artificial Intelligence (AI) is a branch of computer science that aims to create intelligent machines.
AI systems can learn from experience, adjust to new inputs, and perform human-like tasks.
Machine learning is a subset of AI that enables systems to learn and improve from experience.
Deep learning is a subset of machine learning that uses neural networks with multiple layers.`,
    "utf-8"
  );

  writeFileSync(
    join(TEST_DIR, "web-dev.md"),
    `# Web Development Guide

Web development involves building and maintaining websites and web applications.
Frontend development focuses on what users see: HTML, CSS, and JavaScript.
Backend development handles server-side logic, databases, and APIs.
React, Vue, and Angular are popular frontend frameworks.
Node.js, Python, and Go are commonly used for backend development.`,
    "utf-8"
  );
});

afterAll(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true });
  }
});

describe("Retriever Integration (Full RAG Pipeline)", { timeout: 60000 }, () => {
  let retriever: Retriever;

  beforeAll(async () => {
    retriever = new Retriever(TEST_DIR);
    await retriever.initialize();
  });

  it("should index documents", async () => {
    if (!ollamaAvailable) {
      console.log("⏭️  Skipping: Ollama not available");
      return;
    }

    const result = await retriever.index(TEST_DIR);
    expect(result.indexed).toBeGreaterThan(0);
  });

  it("should query indexed documents", async () => {
    if (!ollamaAvailable) {
      console.log("⏭️  Skipping: Ollama not available");
      return;
    }

    const results = await retriever.query("What is machine learning?", { topK: 2 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].score).toBeGreaterThan(0);
  });

  it("should return relevant context", async () => {
    if (!ollamaAvailable) {
      console.log("⏭️  Skipping: Ollama not available");
      return;
    }

    const context = await retriever.getContext("How to build a website?");
    expect(context.length).toBeGreaterThan(0);
  });

  it("should get stats after indexing", async () => {
    if (!ollamaAvailable) {
      console.log("⏭️  Skipping: Ollama not available");
      return;
    }

    const stats = await retriever.getStats();
    expect(stats.chunks).toBeGreaterThan(0);
  });
});
