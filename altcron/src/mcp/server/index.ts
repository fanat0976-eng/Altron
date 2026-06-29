import { createServer } from "http";
import { ToolRegistry } from "../../tools/registry/index.js";
import { getConfig } from "../../config/index.js";

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export class MCPServer {
  private tools: ToolRegistry;
  private serverInfo = {
    name: "altron",
    version: "0.1.0",
  };

  constructor(tools: ToolRegistry) {
    this.tools = tools;
  }

  private getTools(): MCPTool[] {
    return this.tools.listEnabled().map((item) => ({
      name: item.definition.name,
      description: item.definition.description,
      inputSchema: {
        type: "object",
        properties: item.definition.parameters,
        required: Object.entries(item.definition.parameters)
          .filter(([_, param]) => param.required)
          .map(([key]) => key),
      },
    }));
  }

  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    const { id, method, params } = request;

    try {
      switch (method) {
        case "initialize":
          return this.handleInitialize(id);
        case "tools/list":
          return this.handleToolsList(id);
        case "tools/call":
          return this.handleToolsCall(id, params);
        case "ping":
          return { jsonrpc: "2.0", id, result: {} };
        default:
          return {
            jsonrpc: "2.0",
            id,
            error: { code: -32601, message: `Method not found: ${method}` },
          };
      }
    } catch (err) {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32603, message: (err as Error).message },
      };
    }
  }

  private handleInitialize(id: number | string): MCPResponse {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: { listChanged: false },
        },
        serverInfo: this.serverInfo,
      },
    };
  }

  private handleToolsList(id: number | string): MCPResponse {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        tools: this.getTools(),
      },
    };
  }

  private async handleToolsCall(id: number | string, params?: Record<string, unknown>): Promise<MCPResponse> {
    const name = params?.name as string;
    const arguments_ = (params?.arguments as Record<string, unknown>) || {};

    if (!name) {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32602, message: "Missing tool name" },
      };
    }

    const context = {
      sessionId: "mcp-call",
      workDir: process.cwd(),
      env: Object.fromEntries(Object.entries(process.env).filter(([_, v]) => v !== undefined) as [string, string][]),
    };

    const result = await this.tools.call(name, arguments_, context);

    return {
      jsonrpc: "2.0",
      id,
      result: {
        content: [
          {
            type: "text",
            text: result.success ? (result.output || "OK") : `Error: ${result.error}`,
          },
        ],
        isError: !result.success,
      },
    };
  }

  startStdio(): void {
    process.stdin.setEncoding("utf-8");

    let buffer = "";

    process.stdin.on("data", async (chunk) => {
      buffer += chunk;

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const request: MCPRequest = JSON.parse(line);
          const response = await this.handleRequest(request);
          process.stdout.write(JSON.stringify(response) + "\n");
        } catch (e) {
          console.error("[MCP] Request error:", (e as Error).message);
        }
      }
    });

    process.stdin.on("end", () => {
      process.exit(0);
    });

    console.error("[MCP] Server started on stdio");
  }

  startHttp(port = 3001): void {
    const server = createServer(async (req, res) => {
      if (req.method !== "POST") {
        res.writeHead(405);
        res.end("Method not allowed");
        return;
      }

      let body = "";
      for await (const chunk of req) {
        body += chunk;
      }

      try {
        const request: MCPRequest = JSON.parse(body);
        const response = await this.handleRequest(request);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(response));
      } catch {
        res.writeHead(400);
        res.end("Invalid JSON");
      }
    });

    server.listen(port, () => {
      console.log(`[MCP] HTTP server on port ${port}`);
    });
  }
}
