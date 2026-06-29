export interface PlanStep {
  id: string;
  description: string;
  toolName?: string;
  toolParams?: Record<string, unknown>;
  dependsOn?: string[];
  status: "pending" | "in_progress" | "completed" | "failed";
  result?: string;
  error?: string;
}

export interface Plan {
  id: string;
  goal: string;
  steps: PlanStep[];
  status: "created" | "in_progress" | "completed" | "failed";
  createdAt: Date;
  completedAt?: Date;
}

export class Planner {
  private plans = new Map<string, Plan>();

  createPlan(goal: string, steps: Omit<PlanStep, "id" | "status">[]): Plan {
    const plan: Plan = {
      id: crypto.randomUUID(),
      goal,
      steps: steps.map((s) => ({
        ...s,
        id: crypto.randomUUID(),
        status: "pending" as const,
      })),
      status: "created",
      createdAt: new Date(),
    };

    this.plans.set(plan.id, plan);
    return plan;
  }

  getPlan(id: string): Plan | undefined {
    return this.plans.get(id);
  }

  getNextStep(planId: string): PlanStep | undefined {
    const plan = this.plans.get(planId);
    if (!plan) return undefined;

    for (const step of plan.steps) {
      if (step.status !== "pending") continue;

      if (step.dependsOn?.length) {
        const depsComplete = step.dependsOn.every((depId) => {
          const dep = plan.steps.find((s) => s.id === depId);
          return dep?.status === "completed";
        });
        if (!depsComplete) continue;
      }

      return step;
    }

    return undefined;
  }

  updateStep(planId: string, stepId: string, update: { status?: PlanStep["status"]; result?: string; error?: string }): void {
    const plan = this.plans.get(planId);
    if (!plan) return;

    const step = plan.steps.find((s) => s.id === stepId);
    if (!step) return;

    if (update.status) step.status = update.status;
    if (update.result) step.result = update.result;
    if (update.error) step.error = update.error;

    if (step.status === "failed") {
      plan.status = "failed";
    } else if (step.status === "completed") {
      const allDone = plan.steps.every((s) => s.status === "completed");
      if (allDone) {
        plan.status = "completed";
        plan.completedAt = new Date();
      }
    }
  }

  completeStep(planId: string, stepId: string, result: string): void {
    this.updateStep(planId, stepId, { status: "completed", result });
  }

  failStep(planId: string, stepId: string, error: string): void {
    this.updateStep(planId, stepId, { status: "failed", error });
  }

  startStep(planId: string, stepId: string): void {
    this.updateStep(planId, stepId, { status: "in_progress" });
  }

  async parsePlanFromLLM(goal: string, availableTools: string[], llmResponse: string): Promise<Plan> {
    const steps: Omit<PlanStep, "id" | "status">[] = [];

    const lines = llmResponse.split("\n").filter((l) => l.trim());
    for (const line of lines) {
      const match = line.match(/^(?:\d+[\.\)]\s*|\-\s*|\*\s*)(.+)/);
      if (match) {
        const desc = match[1].trim();
        let toolName: string | undefined;
        let toolParams: Record<string, unknown> | undefined;

        for (const tool of availableTools) {
          if (desc.toLowerCase().includes(tool.toLowerCase())) {
            toolName = tool;
            break;
          }
        }

        steps.push({ description: desc, toolName, toolParams });
      }
    }

    if (steps.length === 0) {
      steps.push({ description: goal });
    }

    return this.createPlan(goal, steps);
  }

  getPlanSummary(plan: Plan): string {
    const completed = plan.steps.filter((s) => s.status === "completed").length;
    const failed = plan.steps.filter((s) => s.status === "failed").length;
    const total = plan.steps.length;

    return `Plan: ${plan.goal}\nStatus: ${plan.status}\nProgress: ${completed}/${total} completed, ${failed} failed`;
  }
}
