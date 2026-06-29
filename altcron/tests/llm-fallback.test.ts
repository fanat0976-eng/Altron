import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.mock("../src/config/index.js", () => ({
  loadConfig: vi.fn(),
  getConfig: vi.fn().mockReturnValue({
    llm: {
      defaultProvider: "ollama",
      fallback: ["ollama", "openrouter", "gemini"],
      ollama: { baseUrl: "http://localhost:11434", defaultModel: "qwen2.5:14b" },
      openrouter: { apiKey: "test-key", baseUrl: "https://openrouter.ai/api/v1", defaultModel: "claude-3.5-sonnet" },
      gemini: { apiKey: "test-key", model: "gemini-pro" },
    },
  }),
}));

vi.mock("../src/settings/index.js", () => ({
  getSettings: vi.fn().mockReturnValue({
    defaultProvider: "ollama",
    fallback: ["ollama", "openrouter", "gemini"],
    providers: {
      ollama: { baseUrl: "http://localhost:11434", defaultModel: "qwen2.5:14b" },
      openrouter: { apiKey: "test-key", baseUrl: "https://openrouter.ai/api/v1", defaultModel: "claude-3.5-sonnet" },
      gemini: { apiKey: "test-key", model: "gemini-pro" },
    },
  }),
}));

import { LLMClient } from "../src/llm/index.js";

describe("LLM Fallback Chain", () => {
  let client: LLMClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new LLMClient();
  });

  it("should use primary provider when it works", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: { content: "Hello from Ollama" },
        model: "qwen2.5:14b",
      }),
    });

    const result = await client.chat([{ role: "user", content: "Hi" }]);

    expect(result.provider).toBe("ollama");
    expect(result.content).toBe("Hello from Ollama");
  });

  it("should fallback to next provider when primary fails", async () => {
    // Ollama fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    // OpenRouter succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Hello from OpenRouter" } }],
        model: "claude-3.5-sonnet",
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    });

    const result = await client.chat([{ role: "user", content: "Hi" }]);

    expect(result.provider).toBe("openrouter");
    expect(result.content).toBe("Hello from OpenRouter");
  });

  it("should fallback through all providers", async () => {
    // Ollama fails
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    // OpenRouter fails
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    // Gemini succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "Hello from Gemini" }] } }],
      }),
    });

    const result = await client.chat([{ role: "user", content: "Hi" }]);

    expect(result.provider).toBe("gemini");
    expect(result.content).toBe("Hello from Gemini");
  });

  it("should throw when all providers fail", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    await expect(
      client.chat([{ role: "user", content: "Hi" }])
    ).rejects.toThrow("All LLM providers failed");
  });

  it("should allow specifying provider explicitly", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Direct OpenRouter" } }],
        model: "claude-3.5-sonnet",
      }),
    });

    const result = await client.chat(
      [{ role: "user", content: "Hi" }],
      { provider: "openrouter" }
    );

    expect(result.provider).toBe("openrouter");
  });

  it("should throw for unknown provider", async () => {
    await expect(
      client.chat([{ role: "user", content: "Hi" }], { provider: "unknown" })
    ).rejects.toThrow();
  });

  it("should fallback during streaming", async () => {
    // Ollama stream fails
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    // OpenRouter stream succeeds
    const encoder = new TextEncoder();
    const streamData = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: "Hi" } }] })}\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: " there" } }] })}\n`,
      "data: [DONE]\n",
    ].join("");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({ done: false, value: encoder.encode(streamData) })
            .mockResolvedValueOnce({ done: true, value: undefined }),
        }),
      },
    });

    const chunks: any[] = [];
    for await (const chunk of client.stream([{ role: "user", content: "Hi" }])) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].provider).toBe("openrouter");
  });

  it("should list Ollama models", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        models: [{ name: "qwen2.5:14b" }, { name: "gemma:latest" }],
      }),
    });

    const models = await client.listOllamaModels();

    expect(models).toEqual(["qwen2.5:14b", "gemma:latest"]);
  });

  it("should return empty array when Ollama is unavailable", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const models = await client.listOllamaModels();

    expect(models).toEqual([]);
  });
});
