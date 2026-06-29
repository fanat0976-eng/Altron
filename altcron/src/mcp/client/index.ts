import { spawn, type ChildProcess } from "child_process";

export interface MCPClientTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPClientConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export class MCPClient {
  private process: ChildProcess | null = null;
  private config: MCPClientConfig;
  private requestId = 0;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private buffer = "";
  private tools: MCPClientTool[] = [];
  private connected = false;

  constructor(config: MCPClientConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    this.process = spawn(this.config.command, this.config.args || [], {
      env: { ...process.env, ...this.config.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.process.stdout?.on("data", (data: Buffer) => {
      this.buffer += data.toString();
      const lines = this.buffer.split("\n");
      this.buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const response = JSON.parse(line);
          const pending = this.pending.get(response.id);
          if (pending) {
            this.pending.delete(response.id);
            if (response.error) {
              pending.reject(new Error(response.error.message));
            } else {
              pending.resolve(response.result);
            }
          }
        } catch {}
      }
    });

    this.process.stderr?.on("data", (data: Buffer) => {
      console.error(`[MCP Client] ${data.toString().trim()}`);
    });

    this.process.on("exit", () => {
      this.connected = false;
    });

    const result = await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "altron", version: "0.1.0" },
    });

    this.connected = true;
    const toolsResult = await this.request("tools/list", {});
    this.tools = (toolsResult as any).tools || [];
  }

  disconnect(): void {
    this.process?.kill();
    this.process = null;
    this.connected = false;
  }

  getTools(): MCPClientTool[] {
    return this.tools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const result = await this.request("tools/call", { name, arguments: args });
    const content = (result as any).content;
    if (Array.isArray(content)) {
      return content.map((c: any) => c.text || "").join("\n");
    }
    return String(result);
  }

  private request(method: string, params: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin) {
        reject(new Error("Not connected"));
        return;
      }

      const id = ++this.requestId;
      this.pending.set(id, { resolve, reject });

      const request = {
        jsonrpc: "2.0",
        id,
        method,
        params,
      };

      this.process.stdin.write(JSON.stringify(request) + "\n");

      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error("Request timeout"));
        }
      }, 30000);
    });
  }
}
