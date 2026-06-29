export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  tools?: ToolDefinition[];
  hooks?: HookDefinition[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
  handler: ToolHandler;
}

export interface ToolParameter {
  type: "string" | "number" | "boolean" | "object" | "array";
  description?: string;
  required?: boolean;
  default?: unknown;
}

export type ToolHandler = (params: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;

export interface ToolContext {
  sessionId: string;
  workDir: string;
  env: Record<string, string>;
}

export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface HookDefinition {
  name: string;
  event: "before" | "after" | "error";
  handler: HookHandler;
}

export type HookHandler = (data: unknown) => Promise<void>;

export interface Plugin {
  manifest: PluginManifest;
  activate(): Promise<void>;
  deactivate(): Promise<void>;
}
