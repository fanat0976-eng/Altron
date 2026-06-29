export interface ToolPolicy {
  toolName: string;
  allowed: boolean;
  conditions?: ToolCondition[];
}

export interface ToolCondition {
  type: "path" | "command" | "extension";
  pattern: string;
  allowed: boolean;
}

export class ToolPolicyManager {
  private policies = new Map<string, ToolPolicy>();
  private defaultAllowed = true;

  constructor(defaultAllowed = true) {
    this.defaultAllowed = defaultAllowed;
  }

  setPolicy(policy: ToolPolicy): void {
    this.policies.set(policy.toolName, policy);
  }

  getPolicy(toolName: string): ToolPolicy | undefined {
    return this.policies.get(toolName);
  }

  isAllowed(toolName: string, params?: Record<string, unknown>): boolean {
    const policy = this.policies.get(toolName);

    if (!policy) return this.defaultAllowed;
    if (!policy.allowed) return false;

    if (policy.conditions && params) {
      return this.checkConditions(policy.conditions, params);
    }

    return true;
  }

  private checkConditions(conditions: ToolCondition[], params: Record<string, unknown>): boolean {
    for (const condition of conditions) {
      const value = this.getParamValue(params, condition.type);
      if (value === undefined) continue;

      const matches = new RegExp(condition.pattern).test(String(value));
      if (condition.allowed && !matches) return false;
      if (!condition.allowed && matches) return false;
    }
    return true;
  }

  private getParamValue(params: Record<string, unknown>, type: string): unknown {
    switch (type) {
      case "path":
        return params.path || params.filepath || params.directory;
      case "command":
        return params.command || params.cmd;
      case "extension":
        return params.path ? String(params.path).split(".").pop() : undefined;
      default:
        return undefined;
    }
  }

  export(): ToolPolicy[] {
    return Array.from(this.policies.values());
  }

  import(policies: ToolPolicy[]): void {
    for (const policy of policies) {
      this.policies.set(policy.toolName, policy);
    }
  }
}
