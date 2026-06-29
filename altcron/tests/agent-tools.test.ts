import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/state/index.js", () => ({
  getDatabase: vi.fn().mockReturnValue({
    insertInto: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
    selectFrom: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    selectAll: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn().mockResolvedValue(null),
  }),
  closeDatabase: vi.fn(),
}));

vi.mock("../src/agents/memory/index.js", () => {
  class MockMemoryManager {
    async remember() {}
    async recall() { return []; }
    async getImportantFacts() { return []; }
    async forget() {}
    async list() { return []; }
  }
  return { MemoryManager: MockMemoryManager };
});

vi.mock("../src/llm/index.js", () => ({
  LLMClient: class {},
}));

import { Agent } from "../src/agents/core/index.js";
import { ToolRegistry } from "../src/tools/registry/index.js";

function makeTool(name: string, handler: (p: any) => Promise<any>, params: Record<string, any> = {}) {
  return {
    name,
    description: `Tool: ${name}`,
    parameters: Object.fromEntries(
      Object.entries(params).map(([k, v]) => [k, { type: "string", description: String(v), required: true }])
    ),
    handler,
  };
}

describe("Agent Tool-Calling Parser", () => {
  let agent: Agent;
  let tools: ToolRegistry;
  let mockChat: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockChat = vi.fn();
    tools = new ToolRegistry();
    agent = new Agent({ chat: mockChat } as any, tools, {
      maxIterations: 5,
      systemPrompt: "Test prompt",
    });
  });

  it("should parse json tool call blocks", async () => {
    mockChat
      .mockResolvedValueOnce({
        content: 'Read file.\n```json\n{"name": "read_file", "params": {"path": "/tmp/t.txt"}}\n```',
        provider: "ollama", model: "m",
      })
      .mockResolvedValueOnce({
        content: "Done.",
        provider: "ollama", model: "m",
      });

    tools.register(makeTool("read_file", async (p) => ({ success: true, output: `Content of ${p.path}` }), { path: "file path" }));

    const result = await agent.run("s1", "Read file");

    expect(result.steps.some((s) => s.type === "action" && s.toolName === "read_file")).toBe(true);
    expect(result.response).toBe("Done.");
  });

  it("should parse tool code blocks", async () => {
    mockChat
      .mockResolvedValueOnce({
        content: 'Check.\n```tool\n{"name": "bash", "params": {"command": "ls"}}\n```',
        provider: "ollama", model: "m",
      })
      .mockResolvedValueOnce({
        content: "Ok.",
        provider: "ollama", model: "m",
      });

    tools.register(makeTool("bash", async () => ({ success: true, output: "files" }), { command: "cmd" }));

    const result = await agent.run("s1", "List");

    expect(result.steps.some((s) => s.type === "action" && s.toolName === "bash")).toBe(true);
  });

  it("should handle invalid JSON gracefully", async () => {
    mockChat.mockResolvedValueOnce({
      content: '```json\n{bad json}\n```',
      provider: "ollama", model: "m",
    });

    const result = await agent.run("s1", "Do it");

    expect(result.steps.some((s) => s.content.includes("Failed to parse"))).toBe(true);
  });

  it("should handle tool call with no name", async () => {
    mockChat.mockResolvedValueOnce({
      content: '```json\n{"params": {"path": "/tmp"}}\n```',
      provider: "ollama", model: "m",
    });

    const result = await agent.run("s1", "Do it");

    expect(result.steps.some((s) => s.content.includes("Failed to parse"))).toBe(true);
  });

  it("should call tool with empty params", async () => {
    mockChat
      .mockResolvedValueOnce({
        content: '```json\n{"name": "proc_list"}\n```',
        provider: "ollama", model: "m",
      })
      .mockResolvedValueOnce({
        content: "Listed.",
        provider: "ollama", model: "m",
      });

    tools.register(makeTool("proc_list", async () => ({ success: true, output: "pid1" })));

    const result = await agent.run("s1", "List procs");

    expect(result.steps.some((s) => s.type === "action" && s.toolName === "proc_list")).toBe(true);
    expect(result.response).toBe("Listed.");
  });

  it("should handle tool failure", async () => {
    mockChat
      .mockResolvedValueOnce({
        content: '```json\n{"name": "fail_t"}\n```',
        provider: "ollama", model: "m",
      })
      .mockResolvedValueOnce({
        content: "Still answering.",
        provider: "ollama", model: "m",
      });

    tools.register(makeTool("fail_t", async () => ({ success: false, error: "Oops" })));

    const result = await agent.run("s1", "Fail");

    expect(result.steps.some((s) => s.type === "observation" && s.content.includes("Error"))).toBe(true);
    expect(result.response).toContain("Still answering");
  });

  it("should stop at max iterations", async () => {
    for (let i = 0; i < 20; i++) {
      mockChat.mockResolvedValueOnce({
        content: '```json\n{"name": "looper"}\n```',
        provider: "ollama", model: "m",
      });
    }

    tools.register(makeTool("looper", async () => ({ success: true, output: "ok" })));

    const result = await agent.run("s1", "Loop");

    expect(result.response).toContain("maximum number of iterations");
    expect(mockChat).toHaveBeenCalledTimes(5);
  });

  it("should store thoughts in memory", async () => {
    let callCount = 0;
    mockChat.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          content: 'Thinking...\n```json\n{"name": "echo", "params": {"input": "x"}}\n```',
          provider: "ollama", model: "m",
        };
      }
      return { content: "Done.", provider: "ollama", model: "m" };
    });

    tools.register(makeTool("echo", async (p) => ({ success: true, output: String(p.input) }), { input: "val" }));

    const result = await agent.run("s1", "Echo");

    expect(result.steps.some((s) => s.type === "thought" && s.content.includes("Thinking"))).toBe(true);
  });

  it("should return response without tool call", async () => {
    mockChat.mockResolvedValue({
      content: "42.",
      provider: "ollama", model: "m",
    });

    const result = await agent.run("s1", "What is 6*7?");

    expect(result.response).toBe("42.");
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].type).toBe("response");
  });

  it("should chain multiple tool calls", async () => {
    let callCount = 0;
    mockChat.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          content: 'Read:\n```json\n{"name": "rf", "params": {"path": "/a"}}\n```',
          provider: "ollama", model: "m",
        };
      }
      if (callCount === 2) {
        return {
          content: 'Write:\n```json\n{"name": "wf", "params": {"path": "/b", "content": "d"}}\n```',
          provider: "ollama", model: "m",
        };
      }
      return { content: "Both done.", provider: "ollama", model: "m" };
    });

    tools.register(makeTool("rf", async () => ({ success: true, output: "read" }), { path: "p" }));
    tools.register(makeTool("wf", async () => ({ success: true, output: "wrote" }), { path: "p", content: "c" }));

    const result = await agent.run("s1", "Read a write b");

    const actions = result.steps.filter((s) => s.type === "action");
    expect(actions).toHaveLength(2);
    expect(actions[0].toolName).toBe("rf");
    expect(actions[1].toolName).toBe("wf");
  });
});
