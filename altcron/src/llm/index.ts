import { getConfig } from "../config/index.js";
import { getSettings } from "../settings/index.js";

export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
}

export interface LLMResponse {
  content: string;
  provider: string;
  model: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export interface LLMStreamChunk {
  content: string;
  done: boolean;
  provider: string;
  model: string;
}

export type StreamCallback = (chunk: LLMStreamChunk) => void;

export class LLMClient {
  private get config() {
    const settings = getSettings();
    const cfg = getConfig().llm;
    return {
      defaultProvider: settings.defaultProvider || cfg.defaultProvider,
      fallback: settings.fallback || cfg.fallback,
      ollama: {
        baseUrl: settings.providers.ollama.baseUrl || cfg.ollama.baseUrl,
        defaultModel: settings.providers.ollama.defaultModel || cfg.ollama.defaultModel,
      },
      openrouter: {
        apiKey: settings.providers.openrouter.apiKey || cfg.openrouter.apiKey,
        baseUrl: settings.providers.openrouter.baseUrl || cfg.openrouter.baseUrl,
        defaultModel: settings.providers.openrouter.defaultModel || cfg.openrouter.defaultModel,
      },
      gemini: {
        apiKey: settings.providers.gemini.apiKey || cfg.gemini.apiKey,
        model: settings.providers.gemini.model || cfg.gemini.model,
      },
    };
  }

  async chat(messages: LLMMessage[], options?: { provider?: string; model?: string }): Promise<LLMResponse> {
    const provider = options?.provider || this.config.defaultProvider;
    const providers = [provider, ...this.config.fallback.filter((p) => p !== provider)];

    for (const p of providers) {
      try {
        return await this.callProvider(p, messages, options?.model);
      } catch (err) {
        console.warn(`[LLM] Provider ${p} failed:`, (err as Error).message);
        continue;
      }
    }
    throw new Error("All LLM providers failed");
  }

  async *stream(messages: LLMMessage[], options?: { provider?: string; model?: string }): AsyncGenerator<LLMStreamChunk> {
    const provider = options?.provider || this.config.defaultProvider;
    const providers = [provider, ...this.config.fallback.filter((p) => p !== provider)];

    for (const p of providers) {
      try {
        yield* this.streamProvider(p, messages, options?.model);
        return;
      } catch (err) {
        console.warn(`[LLM] Stream provider ${p} failed:`, (err as Error).message);
        continue;
      }
    }
    throw new Error("All LLM providers failed for streaming");
  }

  private async callProvider(provider: string, messages: LLMMessage[], model?: string): Promise<LLMResponse> {
    switch (provider) {
      case "ollama":
        return this.callOllama(messages, model);
      case "openrouter":
        return this.callOpenRouter(messages, model);
      case "gemini":
        return this.callGemini(messages, model);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  private async *streamProvider(provider: string, messages: LLMMessage[], model?: string): AsyncGenerator<LLMStreamChunk> {
    switch (provider) {
      case "ollama":
        yield* this.streamOllama(messages, model);
        return;
      case "openrouter":
        yield* this.streamOpenRouter(messages, model);
        return;
      case "gemini":
        yield* this.streamGemini(messages, model);
        return;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  private async callOllama(messages: LLMMessage[], model?: string): Promise<LLMResponse> {
    const res = await fetch(`${this.config.ollama.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model || this.config.ollama.defaultModel,
        messages,
        stream: false,
      }),
    });

    if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
    const data: any = await res.json();

    return {
      content: data.message?.content || "",
      provider: "ollama",
      model: data.model || model || this.config.ollama.defaultModel,
      usage: data.prompt_eval_count
        ? {
            promptTokens: data.prompt_eval_count,
            completionTokens: data.eval_count || 0,
            totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
          }
        : undefined,
    };
  }

  private async *streamOllama(messages: LLMMessage[], model?: string): AsyncGenerator<LLMStreamChunk> {
    const res = await fetch(`${this.config.ollama.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model || this.config.ollama.defaultModel,
        messages,
        stream: true,
      }),
    });

    if (!res.ok) throw new Error(`Ollama stream error: ${res.status}`);

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line);
          yield {
            content: chunk.message?.content || "",
            done: chunk.done || false,
            provider: "ollama",
            model: chunk.model || model || this.config.ollama.defaultModel,
          };
        } catch {
          console.debug("[LLM] stream: skipped malformed chunk");
        }
      }
    }
  }

  private async callOpenRouter(messages: LLMMessage[], model?: string): Promise<LLMResponse> {
    if (!this.config.openrouter.apiKey) throw new Error("OpenRouter API key not configured");

    const res = await fetch(`${this.config.openrouter.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.openrouter.apiKey}`,
      },
      body: JSON.stringify({
        model: model || this.config.openrouter.defaultModel,
        messages,
      }),
    });

    if (!res.ok) throw new Error(`OpenRouter error: ${res.status}`);
    const data: any = await res.json();

    return {
      content: data.choices?.[0]?.message?.content || "",
      provider: "openrouter",
      model: data.model || model || this.config.openrouter.defaultModel,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }

  private async *streamOpenRouter(messages: LLMMessage[], model?: string): AsyncGenerator<LLMStreamChunk> {
    if (!this.config.openrouter.apiKey) throw new Error("OpenRouter API key not configured");

    const res = await fetch(`${this.config.openrouter.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.openrouter.apiKey}`,
      },
      body: JSON.stringify({
        model: model || this.config.openrouter.defaultModel,
        messages,
        stream: true,
      }),
    });

    if (!res.ok) throw new Error(`OpenRouter stream error: ${res.status}`);

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") {
          yield { content: "", done: true, provider: "openrouter", model: model || this.config.openrouter.defaultModel };
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content || "";
          yield {
            content,
            done: false,
            provider: "openrouter",
            model: parsed.model || model || this.config.openrouter.defaultModel,
          };
        } catch {
          console.debug("[LLM] stream: skipped malformed chunk");
        }
      }
    }
  }

  async listOllamaModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.config.ollama.baseUrl}/api/tags`);
      if (!res.ok) return [];
      const data: any = await res.json();
      return (data.models || []).map((m: { name: string }) => m.name);
    } catch {
      return [];
    }
  }

  private convertToGeminiMessages(messages: LLMMessage[]): { systemInstruction?: { parts: { text: string }[] }; contents: { role: string; parts: { text: string }[] }[] } {
    let systemInstruction: { parts: { text: string }[] } | undefined;
    const contents: { role: string; parts: { text: string }[] }[] = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        systemInstruction = { parts: [{ text: msg.content }] };
      } else {
        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        });
      }
    }

    return { systemInstruction, contents };
  }

  private async callGemini(messages: LLMMessage[], model?: string): Promise<LLMResponse> {
    if (!this.config.gemini.apiKey) throw new Error("Gemini API key not configured");

    const { systemInstruction, contents } = this.convertToGeminiMessages(messages);
    const geminiModel = model || this.config.gemini.model;

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = systemInstruction;
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${this.config.gemini.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini error: ${res.status} - ${errText}`);
    }

    const data: any = await res.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return {
      content,
      provider: "gemini",
      model: geminiModel,
      usage: data.usageMetadata
        ? {
            promptTokens: data.usageMetadata.promptTokenCount || 0,
            completionTokens: data.usageMetadata.candidatesTokenCount || 0,
            totalTokens: data.usageMetadata.totalTokenCount || 0,
          }
        : undefined,
    };
  }

  private async *streamGemini(messages: LLMMessage[], model?: string): AsyncGenerator<LLMStreamChunk> {
    if (!this.config.gemini.apiKey) throw new Error("Gemini API key not configured");

    const { systemInstruction, contents } = this.convertToGeminiMessages(messages);
    const geminiModel = model || this.config.gemini.model;

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = systemInstruction;
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:streamGenerateContent?key=${this.config.gemini.apiKey}&alt=sse`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini stream error: ${res.status} - ${errText}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        try {
          const parsed = JSON.parse(data);
          const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (content) {
            yield {
              content,
              done: false,
              provider: "gemini",
              model: geminiModel,
            };
          }
        } catch {
          console.debug("[LLM] stream: skipped malformed chunk");
        }
      }
    }

    yield { content: "", done: true, provider: "gemini", model: geminiModel };
  }
}
