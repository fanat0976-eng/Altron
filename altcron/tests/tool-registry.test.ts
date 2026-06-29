import { describe, it, expect, beforeEach } from "vitest";
import { ToolRegistry } from "../src/tools/registry/index.js";
import type { ToolDefinition, ToolResult } from "../src/plugins/sdk/index.js";

const createMockTool = (name: string, output = "ok"): ToolDefinition => ({
  name,
  description: `Test tool: ${name}`,
  parameters: {
    input: { type: "string", description: "Test input", required: true },
  },
  handler: async (params): Promise<ToolResult> => ({
    success: true,
    output: `${output}: ${params.input}`,
  }),
});

const createFailingTool = (name: string): ToolDefinition => ({
  name,
  description: `Failing tool: ${name}`,
  parameters: {},
  handler: async (): Promise<ToolResult> => ({
    success: false,
    error: "Tool failed intentionally",
  }),
});

describe("ToolRegistry", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it("should register and list tools", () => {
    const tool = createMockTool("test_tool");
    registry.register(tool);

    const tools = registry.list();
    expect(tools).toHaveLength(1);
    expect(tools[0].definition.name).toBe("test_tool");
    expect(tools[0].source).toBe("builtin");
  });

  it("should register with custom source", () => {
    const tool = createMockTool("plugin_tool");
    registry.register(tool, "plugin:my-plugin");

    const tools = registry.list();
    expect(tools[0].source).toBe("plugin:my-plugin");
  });

  it("should override builtin with plugin", () => {
    const builtin = createMockTool("shared_tool", "builtin");
    const plugin = createMockTool("shared_tool", "plugin");

    registry.register(builtin, "builtin");
    registry.register(plugin, "plugin:test");

    const tools = registry.list();
    expect(tools).toHaveLength(1);
    expect(tools[0].source).toBe("plugin:test");
  });

  it("should not override plugin with builtin", () => {
    const plugin = createMockTool("shared_tool", "plugin");
    const builtin = createMockTool("shared_tool", "builtin");

    registry.register(plugin, "plugin:test");
    registry.register(builtin, "builtin");

    const tools = registry.list();
    expect(tools).toHaveLength(1);
    expect(tools[0].source).toBe("plugin:test");
  });

  it("should call tool successfully", async () => {
    const tool = createMockTool("echo");
    registry.register(tool);

    const context = {
      sessionId: "test",
      workDir: "/tmp",
      env: {},
    };

    const result = await registry.call("echo", { input: "hello" }, context);
    expect(result.success).toBe(true);
    expect(result.output).toBe("ok: hello");
  });

  it("should return error for unknown tool", async () => {
    const context = {
      sessionId: "test",
      workDir: "/tmp",
      env: {},
    };

    const result = await registry.call("nonexistent", {}, context);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Tool not found");
  });

  it("should handle tool failure", async () => {
    const tool = createFailingTool("fail_tool");
    registry.register(tool);

    const context = {
      sessionId: "test",
      workDir: "/tmp",
      env: {},
    };

    const result = await registry.call("fail_tool", {}, context);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Tool failed intentionally");
  });

  it("should enable/disable tools", () => {
    const tool = createMockTool("toggle_tool");
    registry.register(tool);

    expect(registry.listEnabled()).toHaveLength(1);

    registry.disable("toggle_tool");
    expect(registry.listEnabled()).toHaveLength(0);

    registry.enable("toggle_tool");
    expect(registry.listEnabled()).toHaveLength(1);
  });

  it("should return error for disabled tool", async () => {
    const tool = createMockTool("disabled_tool");
    registry.register(tool);
    registry.disable("disabled_tool");

    const context = {
      sessionId: "test",
      workDir: "/tmp",
      env: {},
    };

    const result = await registry.call("disabled_tool", { input: "test" }, context);
    expect(result.success).toBe(false);
    expect(result.error).toContain("disabled");
  });

  it("should unregister tools", () => {
    const tool = createMockTool("removable");
    registry.register(tool);

    expect(registry.list()).toHaveLength(1);
    expect(registry.unregister("removable")).toBe(true);
    expect(registry.list()).toHaveLength(0);
    expect(registry.unregister("nonexistent")).toBe(false);
  });

  it("should generate function definitions", () => {
    const tool = createMockTool("def_tool");
    registry.register(tool);

    const defs = registry.toFunctionDefinitions();
    expect(defs).toHaveLength(1);
    expect(defs[0].name).toBe("def_tool");
    expect(defs[0].description).toContain("Test tool");
  });
});
