import { describe, it, expect, beforeAll } from "vitest";
import { loadConfig } from "../../src/config/index.js";
import { LLMClient, type LLMMessage } from "../../src/llm/index.js";

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
    ollamaAvailable = res.ok;
  } catch {
    ollamaAvailable = false;
  }
});

describe("LLM Client Integration (Ollama)", { timeout: 30000 }, () => {
  let client: LLMClient;

  beforeAll(() => {
    client = new LLMClient();
  });

  it("should connect to Ollama and list models", async () => {
    if (!ollamaAvailable) {
      console.log("⏭️  Skipping: Ollama not available");
      return;
    }

    const models = await client.listOllamaModels();
    expect(models.length).toBeGreaterThan(0);
  });

  it("should chat with qwen2.5:14b", async () => {
    if (!ollamaAvailable) {
      console.log("⏭️  Skipping: Ollama not available");
      return;
    }

    const messages: LLMMessage[] = [
      { role: "user", content: "Say hello in one word" },
    ];

    const response = await client.chat(messages, {
      provider: "ollama",
      model: "qwen2.5:14b",
    });

    expect(response.content).toBeDefined();
    expect(response.content.length).toBeGreaterThan(0);
    expect(response.provider).toBe("ollama");
  });

  it("should stream response from Ollama", async () => {
    if (!ollamaAvailable) {
      console.log("⏭️  Skipping: Ollama not available");
      return;
    }

    const messages: LLMMessage[] = [
      { role: "user", content: "Count from 1 to 3" },
    ];

    const chunks: string[] = [];
    for await (const chunk of client.stream(messages, {
      provider: "ollama",
      model: "qwen2.5:14b",
    })) {
      chunks.push(chunk.content);
    }

    const fullResponse = chunks.join("");
    expect(fullResponse.length).toBeGreaterThan(0);
  });

  it("should handle multi-turn conversation", async () => {
    if (!ollamaAvailable) {
      console.log("⏭️  Skipping: Ollama not available");
      return;
    }

    const messages: LLMMessage[] = [
      { role: "system", content: "You are a helpful assistant. Keep responses very short." },
      { role: "user", content: "What is 2+2?" },
      { role: "assistant", content: "4" },
      { role: "user", content: "And plus 3?" },
    ];

    const response = await client.chat(messages, {
      provider: "ollama",
      model: "qwen2.5:14b",
    });

    expect(response.content).toBeDefined();
  });
});
