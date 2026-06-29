import { describe, it, expect, vi, beforeEach } from "vitest";
import { MCPServer } from "../src/mcp/server/index.js";
import { ToolRegistry } from "../src/tools/registry/index.js";
import type { ToolDefinition } from "../src/plugins/sdk/index.js";

const createMockTool = (name: string): ToolDefinition => ({
  name,
  description: `Test tool: ${name}`,
  parameters: {
    input: { type: "string", description: "Input", required: true },
  },
  handler: async (params) => ({
    success: true,
    output: `Result: ${params.input}`,
  }),
});

describe("MCPServer", () => {
  let server: MCPServer;
  let tools: ToolRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    tools = new ToolRegistry();
    tools.register(createMockTool("test_tool"));
    tools.register(createMockTool("another_tool"));
    server = new MCPServer(tools);
  });

  it("should handle initialize request", async () => {
    const response = await server.handleRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
      },
    });

    expect(response.jsonrpc).toBe("2.0");
    expect(response.id).toBe(1);
    expect(response.result).toBeDefined();
    expect((response.result as any).protocolVersion).toBe("2024-11-05");
  });

  it("should handle tools/list request", async () => {
    const response = await server.handleRequest({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    });

    expect(response.result).toBeDefined();
    expect((response.result as any).tools).toHaveLength(2);
    expect((response.result as any).tools[0].name).toBeDefined();
  });

  it("should handle tools/call request", async () => {
    const response = await server.handleRequest({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "test_tool",
        arguments: { input: "hello" },
      },
    });

    expect(response.result).toBeDefined();
    expect((response.result as any).content).toBeDefined();
    expect((response.result as any).content[0].text).toContain("Result: hello");
  });

  it("should handle ping request", async () => {
    const response = await server.handleRequest({
      jsonrpc: "2.0",
      id: 4,
      method: "ping",
      params: {},
    });

    expect(response.result).toBeDefined();
  });

  it("should return error for unknown method", async () => {
    const response = await server.handleRequest({
      jsonrpc: "2.0",
      id: 5,
      method: "unknown/method",
      params: {},
    });

    expect(response.error).toBeDefined();
    expect(response.error!.code).toBe(-32601);
  });

  it("should return error for invalid tool call", async () => {
    const response = await server.handleRequest({
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: {
        name: "nonexistent_tool",
        arguments: {},
      },
    });

    expect(response.result).toBeDefined();
    expect((response.result as any).isError).toBe(true);
    expect((response.result as any).content[0].text).toContain("Error");
  });

  it("should handle tools/call with missing required params", async () => {
    const response = await server.handleRequest({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: {
        name: "test_tool",
        arguments: {},
      },
    });

    expect(response.result).toBeDefined();
  });

  it("should list tool definitions with schemas", async () => {
    const response = await server.handleRequest({
      jsonrpc: "2.0",
      id: 8,
      method: "tools/list",
      params: {},
    });

    const tool = (response.result as any).tools[0];
    expect(tool.name).toBeDefined();
    expect(tool.description).toBeDefined();
    expect(tool.inputSchema).toBeDefined();
    expect(tool.inputSchema.type).toBe("object");
  });
});
