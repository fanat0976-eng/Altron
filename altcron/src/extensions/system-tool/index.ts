import { exec } from "child_process";
import { promisify } from "util";
import type { ToolDefinition, ToolResult, ToolContext } from "../../plugins/sdk/index.js";

const execAsync = promisify(exec);

export const bashTool: ToolDefinition = {
  name: "bash",
  description: "Execute a shell command. Returns stdout and stderr.",
  parameters: {
    command: { type: "string", description: "Shell command to execute", required: true },
    timeout: { type: "number", description: "Timeout in seconds (default: 30)" },
    cwd: { type: "string", description: "Working directory (default: workDir)" },
  },
  handler: async (params, context): Promise<ToolResult> => {
    const command = params.command as string;
    const timeout = ((params.timeout as number) || 30) * 1000;
    const cwd = (params.cwd as string) || context.workDir;

    try {
      const { stdout, stderr } = await execAsync(command, { cwd, timeout, encoding: "utf-8" });
      const output = [stdout, stderr].filter(Boolean).join("\n").trim();
      return { success: true, output: output || "(no output)" };
    } catch (err: any) {
      const output = [err.stdout, err.stderr].filter(Boolean).join("\n").trim();
      return {
        success: false,
        output: output || undefined,
        error: err.message,
      };
    }
  },
};

export const processTool: ToolDefinition = {
  name: "process_list",
  description: "List running processes.",
  parameters: {
    filter: { type: "string", description: "Filter by process name" },
  },
  handler: async (params): Promise<ToolResult> => {
    const filter = params.filter as string | undefined;
    try {
      const isWin = process.platform === "win32";
      const cmd = isWin ? "tasklist /FO CSV" : "ps aux";
      const { stdout } = await execAsync(cmd, { encoding: "utf-8" });

      let lines = stdout.trim().split("\n");
      if (filter) {
        lines = lines.filter((l) => l.toLowerCase().includes(filter.toLowerCase()));
      }

      return { success: true, output: lines.slice(0, 50).join("\n") };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};

export const envTool: ToolDefinition = {
  name: "env_get",
  description: "Get environment variables.",
  parameters: {
    name: { type: "string", description: "Variable name (returns all if empty)" },
  },
  handler: async (params): Promise<ToolResult> => {
    const name = params.name as string | undefined;
    if (name) {
      return { success: true, output: process.env[name] || "(not set)" };
    }
    const vars = Object.entries(process.env)
      .slice(0, 50)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");
    return { success: true, output: vars };
  },
};

export const bashTools: ToolDefinition[] = [bashTool, processTool, envTool];
