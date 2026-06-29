import { readFileSync } from "fs";
import { parse } from "yaml";
import { z } from "zod";
import "dotenv/config";

const ConfigSchema = z.object({
  server: z.object({
    port: z.number().default(3000),
    host: z.string().default("0.0.0.0"),
  }),
  database: z.object({
    path: z.string().default("./data/altcron.db"),
  }),
  llm: z.object({
    defaultProvider: z.string().default("ollama"),
    fallback: z.array(z.string()).default(["ollama", "openrouter", "gemini"]),
    ollama: z.object({
      baseUrl: z.string().default("http://localhost:11434"),
      defaultModel: z.string().default("qwen2.5:14b"),
    }),
    openrouter: z.object({
      apiKey: z.string().default(process.env.OPENROUTER_API_KEY || ""),
      baseUrl: z.string().default("https://openrouter.ai/api/v1"),
      defaultModel: z.string().default("anthropic/claude-3.5-sonnet"),
    }),
    gemini: z.object({
      apiKey: z.string().default(process.env.GEMINI_API_KEY || ""),
      model: z.string().default("gemini-pro"),
    }),
  }),
  rag: z.object({
    embeddingModel: z.string().default("nomic-embed-text"),
    chunkSize: z.number().default(1000),
    chunkOverlap: z.number().default(200),
    defaultTopK: z.number().default(5),
    minScore: z.number().default(0.3),
  }),
  skills: z.object({
    dir: z.string().default("./skills"),
  }),
  sessions: z.object({
    maxConcurrent: z.number().default(10),
    historyLimit: z.number().default(100),
  }),
  logging: z.object({
    level: z.enum(["debug", "info", "warn", "error"]).default("info"),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

let config: Config | null = null;

export function loadConfig(path = "./config.yaml"): Config {
  if (config) return config;

  const raw = readFileSync(path, "utf-8");
  const parsed = parse(raw);
  config = ConfigSchema.parse(parsed);
  return config;
}

export function getConfig(): Config {
  if (!config) {
    throw new Error("Config not loaded. Call loadConfig() first.");
  }
  return config;
}
