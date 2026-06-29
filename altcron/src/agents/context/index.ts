import type { LLMMessage } from "../../llm/index.js";

export interface ContextConfig {
  maxTokens: number;
  systemPromptReserve: number;
  memoryReserve: number;
  recentMessages: number;
}

const DEFAULT_CONFIG: ContextConfig = {
  maxTokens: 16384,
  systemPromptReserve: 2000,
  memoryReserve: 2000,
  recentMessages: 20,
};

export class ContextManager {
  private config: ContextConfig;

  constructor(config?: Partial<ContextConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  buildContext(
    systemPrompt: string,
    messages: LLMMessage[],
    memories: string[] = []
  ): LLMMessage[] {
    const result: LLMMessage[] = [];

    const systemTokens = this.estimateTokens(systemPrompt);
    const memoryText = memories.length > 0 ? `\n\nImportant facts:\n${memories.map((m) => `- ${m}`).join("\n")}` : "";
    const memoryTokens = this.estimateTokens(memoryText);

    const availableForMessages = this.config.maxTokens
      - this.config.systemPromptReserve
      - this.config.memoryReserve;

    const fullSystem = systemPrompt + memoryText;
    result.push({ role: "system", content: fullSystem });

    const recentMessages = messages.slice(-this.config.recentMessages);
    let tokenCount = 0;
    const selectedMessages: LLMMessage[] = [];

    for (let i = recentMessages.length - 1; i >= 0; i--) {
      const msg = recentMessages[i];
      const msgTokens = this.estimateTokens(msg.content);
      if (tokenCount + msgTokens > availableForMessages) break;
      tokenCount += msgTokens;
      selectedMessages.unshift(msg);
    }

    result.push(...selectedMessages);

    return result;
  }

  trimMessages(messages: LLMMessage[], maxTokens: number): LLMMessage[] {
    let tokenCount = 0;
    const result: LLMMessage[] = [];

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const msgTokens = this.estimateTokens(msg.content);
      if (tokenCount + msgTokens > maxTokens) break;
      tokenCount += msgTokens;
      result.unshift(msg);
    }

    const systemMsg = messages.find((m) => m.role === "system");
    if (systemMsg && !result.some((m) => m.role === "system")) {
      result.unshift(systemMsg);
    }

    return result;
  }

  summarizeConversation(messages: LLMMessage[]): string {
    const userMessages = messages.filter((m) => m.role === "user");
    const assistantMessages = messages.filter((m) => m.role === "assistant");

    const topics: string[] = [];
    for (const msg of userMessages.slice(-5)) {
      const firstSentence = msg.content.split(/[.!?]/)[0];
      if (firstSentence) topics.push(firstSentence.trim());
    }

    return `Conversation summary: User asked about ${topics.join("; ")}. ${assistantMessages.length} responses given.`;
  }
}
