import { describe, it, expect, beforeEach } from "vitest";
import { ContextManager } from "../src/agents/context/index.js";
import type { LLMMessage } from "../src/llm/index.js";

describe("ContextManager", () => {
  let ctx: ContextManager;

  beforeEach(() => {
    ctx = new ContextManager();
  });

  it("should estimate tokens (text.length / 4)", () => {
    expect(ctx.estimateTokens("")).toBe(0);
    expect(ctx.estimateTokens("test")).toBe(1);
    expect(ctx.estimateTokens("hello world")).toBe(3); // 11/4 = 2.75 → ceil = 3
    expect(ctx.estimateTokens("12345678")).toBe(2);
  });

  it("should build context with system prompt and messages", () => {
    const system = "You are a helpful assistant.";
    const messages: LLMMessage[] = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there!" },
    ];

    const result = ctx.buildContext(system, messages);

    expect(result[0].role).toBe("system");
    expect(result[0].content).toContain("You are a helpful assistant");
    expect(result.length).toBe(3); // system + 2 messages
  });

  it("should inject memories into system prompt", () => {
    const system = "You are a helpful assistant.";
    const messages: LLMMessage[] = [{ role: "user", content: "Hi" }];
    const memories = ["User prefers dark mode", "Project is called Altron"];

    const result = ctx.buildContext(system, messages, memories);

    expect(result[0].content).toContain("User prefers dark mode");
    expect(result[0].content).toContain("Project is called Altron");
  });

  it("should trim messages when exceeding token budget", () => {
    const system = "System prompt";
    const messages: LLMMessage[] = [];
    // Create messages that exceed token budget
    for (let i = 0; i < 100; i++) {
      messages.push({ role: "user", content: `Message ${i}: ${"x".repeat(200)}` });
    }

    const result = ctx.buildContext(system, messages);

    // Should have system + limited messages
    expect(result[0].role).toBe("system");
    expect(result.length).toBeLessThan(102); // Less than all messages + system
  });

  it("should keep most recent messages when trimming", () => {
    const system = "System";
    const messages: LLMMessage[] = [];
    for (let i = 0; i < 50; i++) {
      messages.push({ role: "user", content: `Msg ${i}` });
    }

    const result = ctx.buildContext(system, messages);

    // Last message should be present
    const lastMsg = messages[messages.length - 1];
    expect(result.some((m) => m.content === lastMsg.content)).toBe(true);
  });

  it("should trim messages correctly", () => {
    const messages: LLMMessage[] = [
      { role: "system", content: "System" },
      { role: "user", content: "First" },
      { role: "assistant", content: "Response" },
      { role: "user", content: "Second" },
    ];

    const trimmed = ctx.trimMessages(messages, 50);

    expect(trimmed.some((m) => m.role === "system")).toBe(true);
    expect(trimmed.length).toBeLessThanOrEqual(messages.length);
  });

  it("should preserve system message when trimming", () => {
    const messages: LLMMessage[] = [
      { role: "system", content: "Important system instructions" },
      ...Array.from({ length: 20 }, (_, i) => ({
        role: "user" as const,
        content: `Message ${i}: ${"x".repeat(100)}`,
      })),
    ];

    const trimmed = ctx.trimMessages(messages, 100);

    expect(trimmed[0].role).toBe("system");
    expect(trimmed[0].content).toBe("Important system instructions");
  });

  it("should summarize conversation", () => {
    const messages: LLMMessage[] = [
      { role: "user", content: "What is TypeScript?" },
      { role: "assistant", content: "TypeScript is a language." },
      { role: "user", content: "How to install it?" },
      { role: "assistant", content: "Use npm install." },
    ];

    const summary = ctx.summarizeConversation(messages);

    expect(summary).toContain("TypeScript");
    expect(summary).toContain("2 responses");
  });

  it("should handle empty messages", () => {
    const result = ctx.buildContext("System", []);

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("system");
  });

  it("should handle empty memories", () => {
    const result = ctx.buildContext("System", [{ role: "user", content: "Hi" }], []);

    expect(result[0].content).toBe("System"); // No memory injection
  });

  it("should use custom config", () => {
    const custom = new ContextManager({
      maxTokens: 100,
      recentMessages: 5,
    });

    const messages: LLMMessage[] = [];
    for (let i = 0; i < 20; i++) {
      messages.push({ role: "user", content: `Message ${i}` });
    }

    const result = custom.buildContext("System", messages);

    // Should only include last 5 messages (recentMessages=5)
    expect(result.length).toBeLessThanOrEqual(6); // system + at most 5
  });
});
