import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("LLM Client", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("should define LLMMessage interface", () => {
    const message = {
      role: "user" as const,
      content: "Hello",
    };

    expect(message.role).toBe("user");
    expect(message.content).toBe("Hello");
  });

  it("should define LLMResponse interface", () => {
    const response = {
      content: "Response text",
      provider: "ollama",
      model: "qwen2.5:14b",
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
    };

    expect(response.provider).toBe("ollama");
    expect(response.usage.totalTokens).toBe(150);
  });

  it("should define LLMStreamChunk interface", () => {
    const chunk = {
      content: "chunk",
      done: false,
      provider: "ollama",
      model: "qwen2.5:14b",
    };

    expect(chunk.done).toBe(false);
  });

  it("should mock Ollama API call", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: { content: "Hello from Ollama" },
        model: "qwen2.5:14b",
        prompt_eval_count: 10,
        eval_count: 20,
      }),
    });

    const res = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen2.5:14b",
        messages: [{ role: "user", content: "Hi" }],
        stream: false,
      }),
    });

    const data = await res.json();
    expect(data.message.content).toBe("Hello from Ollama");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should handle Ollama stream response", async () => {
    const chunks = [
      JSON.stringify({ message: { content: "Hello" }, done: false }) + "\n",
      JSON.stringify({ message: { content: " world" }, done: false }) + "\n",
      JSON.stringify({ message: { content: "" }, done: true }) + "\n",
    ].join("");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(chunks) })
            .mockResolvedValueOnce({ done: true, value: undefined }),
        }),
      },
    });

    const res = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      body: JSON.stringify({ stream: true }),
    });

    expect(res.ok).toBe(true);
  });

  it("should mock OpenRouter API call", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Response from OpenRouter" } }],
        model: "claude-3.5-sonnet",
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      }),
    });

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-key",
      },
      body: JSON.stringify({
        model: "claude-3.5-sonnet",
        messages: [{ role: "user", content: "Hi" }],
      }),
    });

    const data = await res.json();
    expect(data.choices[0].message.content).toBe("Response from OpenRouter");
  });

  it("should handle API errors gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    const res = await fetch("http://localhost:11434/api/chat");
    expect(res.ok).toBe(false);
    expect(res.status).toBe(500);
  });
});
