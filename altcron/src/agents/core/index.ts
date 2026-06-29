import { LLMClient, type LLMMessage } from "../../llm/index.js";
import { ToolRegistry } from "../../tools/registry/index.js";
import type { ToolContext, ToolResult } from "../../plugins/sdk/index.js";
import { MemoryManager } from "../memory/index.js";
import { ContextManager } from "../context/index.js";
import { Planner, type Plan } from "../planning/index.js";

export interface AgentConfig {
  maxIterations: number;
  systemPrompt: string;
  model?: string;
  provider?: string;
}

export interface AgentStep {
  type: "thought" | "action" | "observation" | "response";
  content: string;
  toolName?: string;
  toolParams?: Record<string, unknown>;
  toolResult?: ToolResult;
  timestamp: Date;
}

export interface AgentResult {
  response: string;
  steps: AgentStep[];
  plan?: Plan;
  usage?: { promptTokens: number; completionTokens: number };
}

const DEFAULT_SYSTEM_PROMPT = `You are Altron, an AI assistant with access to tools. You can read/write files, execute commands, search the web, and more.

When you need to use a tool, respond with a JSON block:
\`\`\`json
{"name": "tool_name", "params": {"param1": "value1"}}
\`\`\`

After receiving tool results, continue reasoning and either use another tool or provide your final answer.

Always explain your reasoning before taking actions.`;

export class Agent {
  private llm: LLMClient;
  private tools: ToolRegistry;
  private memory: MemoryManager;
  private context: ContextManager;
  private planner: Planner;
  private config: AgentConfig;

  constructor(
    llm: LLMClient,
    tools: ToolRegistry,
    config?: Partial<AgentConfig>
  ) {
    this.llm = llm;
    this.tools = tools;
    this.memory = new MemoryManager();
    this.context = new ContextManager();
    this.planner = new Planner();
    this.config = {
      maxIterations: 10,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      ...config,
    };
  }

  async run(sessionId: string, userMessage: string, history: LLMMessage[] = []): Promise<AgentResult> {
    const steps: AgentStep[] = [];
    const messages: LLMMessage[] = [...history];
    messages.push({ role: "user", content: userMessage });

    const memories = await this.memory.getImportantFacts(sessionId);
    const contextMessages = this.context.buildContext(
      this.config.systemPrompt,
      messages,
      memories
    );

    for (let i = 0; i < this.config.maxIterations; i++) {
      const response = await this.llm.chat(contextMessages, {
        provider: this.config.provider,
        model: this.config.model,
      });

      const content = response.content;

      const toolMatch = content.match(/```(?:tool|json)\s*\n([\s\S]*?)\n```/);
      if (toolMatch) {
        try {
          const toolCall = JSON.parse(toolMatch[1]);
          if (!toolCall.name) throw new Error("No tool name in JSON block");
          const step: AgentStep = {
            type: "thought",
            content: content.replace(/```(?:tool|json)\s*\n[\s\S]*?\n```/, "").trim(),
            timestamp: new Date(),
          };
          if (step.content) {
            steps.push(step);
            await this.memory.remember(sessionId, "thought", step.content, "short_term");
          }

          const toolContext: ToolContext = {
            sessionId,
            workDir: process.cwd(),
            env: process.env as Record<string, string>,
          };

          const toolResult = await this.tools.call(toolCall.name, toolCall.params || {}, toolContext);

          const actionStep: AgentStep = {
            type: "action",
            content: `Called ${toolCall.name}`,
            toolName: toolCall.name,
            toolParams: toolCall.params,
            toolResult,
            timestamp: new Date(),
          };
          steps.push(actionStep);

          await this.memory.remember(
            sessionId,
            `tool:${toolCall.name}`,
            toolResult.success ? (toolResult.output || "success") : `Error: ${toolResult.error}`,
            "short_term"
          );

          const observationStep: AgentStep = {
            type: "observation",
            content: toolResult.success ? (toolResult.output || "OK") : `Error: ${toolResult.error}`,
            timestamp: new Date(),
          };
          steps.push(observationStep);

          contextMessages.push({ role: "assistant", content });
          contextMessages.push({
            role: "tool",
            content: JSON.stringify(toolResult),
            tool_call_id: toolCall.name,
          });

          continue;
        } catch (e) {
          steps.push({
            type: "thought",
            content: `Failed to parse tool call: ${(e as Error).message}`,
            timestamp: new Date(),
          });
        }
      }

      steps.push({
        type: "response",
        content,
        timestamp: new Date(),
      });

      await this.memory.remember(sessionId, "last_response", content.slice(0, 500), "short_term");

      return {
        response: content,
        steps,
        usage: response.usage,
      };
    }

    return {
      response: "I've reached the maximum number of iterations. Here's what I found so far:",
      steps,
    };
  }

  async planAndExecute(sessionId: string, goal: string): Promise<AgentResult> {
    const steps: AgentStep[] = [];

    const availableTools = this.tools.listEnabled().map((t) => t.definition.name);

    const planResponse = await this.llm.chat([
      { role: "system", content: "Create a step-by-step plan to achieve the goal. Use the available tools." },
      { role: "user", content: `Goal: ${goal}\n\nAvailable tools: ${availableTools.join(", ")}\n\nProvide a numbered list of steps.` },
    ], {
      provider: this.config.provider,
      model: this.config.model,
    });

    const plan = await this.planner.parsePlanFromLLM(goal, availableTools, planResponse.content);

    steps.push({
      type: "thought",
      content: `Created plan with ${plan.steps.length} steps`,
      timestamp: new Date(),
    });

    let stepCount = 0;
    const maxPlanSteps = 20;

    while (stepCount < maxPlanSteps) {
      const nextStep = this.planner.getNextStep(plan.id);
      if (!nextStep) break;

      stepCount++;
      this.planner.startStep(plan.id, nextStep.id);

      steps.push({
        type: "action",
        content: nextStep.description,
        toolName: nextStep.toolName,
        timestamp: new Date(),
      });

      if (nextStep.toolName) {
        const toolContext: ToolContext = {
          sessionId,
          workDir: process.cwd(),
          env: process.env as Record<string, string>,
        };

        const result = await this.tools.call(nextStep.toolName, nextStep.toolParams || {}, toolContext);

        if (result.success) {
          this.planner.completeStep(plan.id, nextStep.id, result.output || "OK");
          steps.push({
            type: "observation",
            content: result.output || "OK",
            timestamp: new Date(),
          });
        } else {
          this.planner.failStep(plan.id, nextStep.id, result.error || "Failed");
          steps.push({
            type: "observation",
            content: `Error: ${result.error}`,
            timestamp: new Date(),
          });
        }
      } else {
        const response = await this.llm.chat([
          { role: "system", content: this.config.systemPrompt },
          { role: "user", content: nextStep.description },
        ], {
          provider: this.config.provider,
          model: this.config.model,
        });

        this.planner.completeStep(plan.id, nextStep.id, response.content);
        steps.push({
          type: "response",
          content: response.content,
          timestamp: new Date(),
        });
      }
    }

    if (stepCount >= maxPlanSteps) {
      steps.push({
        type: "thought",
        content: `Plan execution stopped: reached max steps (${maxPlanSteps})`,
        timestamp: new Date(),
      });
    }

    const summary = this.planner.getPlanSummary(plan);

    return {
      response: summary,
      steps,
      plan,
    };
  }

  getMemory(): MemoryManager {
    return this.memory;
  }

  getPlanner(): Planner {
    return this.planner;
  }
}
