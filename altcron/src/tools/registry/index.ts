import type { ToolDefinition, ToolHandler, ToolResult, ToolContext } from "../../plugins/sdk/index.js";
import { ToolPolicyManager, type ToolPolicy } from "../policy/index.js";

export interface ToolRegistryItem {
  definition: ToolDefinition;
  source: string;
  enabled: boolean;
}

export class ToolRegistry {
  private tools = new Map<string, ToolRegistryItem>();
  private policyManager = new ToolPolicyManager();

  register(tool: ToolDefinition, source = "builtin"): void {
    if (this.tools.has(tool.name)) {
      const existing = this.tools.get(tool.name)!;
      if (source.startsWith("plugin:") && existing.source === "builtin") {
        this.tools.set(tool.name, { definition: tool, source, enabled: true });
        console.log(`[ToolRegistry] Overridden: ${tool.name} (${existing.source} → ${source})`);
      }
      return;
    }
    this.tools.set(tool.name, { definition: tool, source, enabled: true });
    console.log(`[ToolRegistry] Registered: ${tool.name} (from ${source})`);
  }

  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  get(name: string): ToolRegistryItem | undefined {
    return this.tools.get(name);
  }

  list(): ToolRegistryItem[] {
    return Array.from(this.tools.values());
  }

  listEnabled(): ToolRegistryItem[] {
    return this.list().filter((t) => t.enabled);
  }

  enable(name: string): void {
    const tool = this.tools.get(name);
    if (tool) tool.enabled = true;
  }

  disable(name: string): void {
    const tool = this.tools.get(name);
    if (tool) tool.enabled = false;
  }

  setPolicy(policy: ToolPolicy): void {
    this.policyManager.setPolicy(policy);
  }

  setPolicies(policies: ToolPolicy[]): void {
    this.policyManager.import(policies);
  }

  isAllowed(name: string, params?: Record<string, unknown>): boolean {
    return this.policyManager.isAllowed(name, params);
  }

  toFunctionDefinitions(): { name: string; description: string; parameters: Record<string, unknown> }[] {
    return this.listEnabled().map((item) => ({
      name: item.definition.name,
      description: item.definition.description,
      parameters: item.definition.parameters,
    }));
  }

  async call(name: string, params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const item = this.tools.get(name);
    if (!item) {
      return { success: false, error: `Tool not found: ${name}` };
    }
    if (!item.enabled) {
      return { success: false, error: `Tool disabled: ${name}` };
    }
    if (!this.policyManager.isAllowed(name, params)) {
      return { success: false, error: `Tool blocked by policy: ${name}` };
    }

    try {
      return await item.definition.handler(params, context);
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
