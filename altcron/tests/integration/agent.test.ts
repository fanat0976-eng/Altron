import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loadConfig } from "../../src/config/index.js";
import { getDatabase, closeDatabase } from "../../src/state/index.js";
import { LLMClient } from "../../src/llm/index.js";
import { ToolRegistry } from "../../src/tools/registry/index.js";
import { Agent } from "../../src/agents/core/index.js";
import { fileTools } from "../../src/extensions/file-tool/index.js";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";

// Load config and init DB
beforeAll(() => {
  try {
    loadConfig();
  } catch {}
  getDatabase();
});

afterAll(() => {
  closeDatabase();
});

const OLLAMA_URL = "http://localhost:11434";
let ollamaAvailable = false;
const TEST_DIR = join(process.cwd(), "test-agent-integration");

beforeAll(async () => {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    const data = await res.json();
    ollamaAvailable = data.models?.some((m: any) => m.name.includes("qwen2.5"));
  } catch {
    ollamaAvailable = false;
  }

  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true });
  }
  mkdirSync(TEST_DIR, { recursive: true });
  writeFileSync(join(TEST_DIR, "hello.txt"), "Hello World!", "utf-8");
});

describe("Agent Integration (Real LLM)", { timeout: 60000 }, () => {
  let agent: Agent;

  beforeAll(() => {
    const llm = new LLMClient();
    const tools = new ToolRegistry();

    for (const tool of fileTools) {
      tools.register(tool);
    }

    agent = new Agent(llm, tools, {
      maxIterations: 3,
      systemPrompt: `You are a helpful assistant. Keep responses very short.`,
    });
  });

  it("should respond to simple question", async () => {
    if (!ollamaAvailable) {
      console.log("⏭️  Skipping: Ollama not available");
      return;
    }

    const result = await agent.run("test-session", "What is 2+2? Reply with just the number.", []);
    expect(result.response).toBeDefined();
    expect(result.response.length).toBeGreaterThan(0);
  });

  it("should have accessible memory", () => {
    const memory = agent.getMemory();
    expect(memory).toBeDefined();
    expect(typeof memory.remember).toBe("function");
  });

  it("should have accessible planner", () => {
    const planner = agent.getPlanner();
    expect(planner).toBeDefined();
  });
});
