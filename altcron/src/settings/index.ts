import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

export interface AppSettings {
  providers: {
    ollama: { baseUrl: string; defaultModel: string };
    openrouter: { apiKey: string; baseUrl: string; defaultModel: string };
    gemini: { apiKey: string; model: string };
  };
  defaultProvider: string;
  fallback: string[];
}

const DEFAULT_SETTINGS: AppSettings = {
  providers: {
    ollama: { baseUrl: "http://localhost:11434", defaultModel: "qwen2.5:7b" },
    openrouter: { apiKey: "", baseUrl: "https://openrouter.ai/api/v1", defaultModel: "openrouter/free" },
    gemini: { apiKey: "", model: "gemini-pro" },
  },
  defaultProvider: "ollama",
  fallback: ["ollama", "openrouter", "gemini"],
};

let settings: AppSettings | null = null;
let settingsPath = "./data/settings.json";

export function loadSettings(dataDir = "./data"): AppSettings {
  settingsPath = join(dataDir, "settings.json");
  if (!existsSync(dirname(settingsPath))) {
    mkdirSync(dirname(settingsPath), { recursive: true });
  }
  if (existsSync(settingsPath)) {
    try {
      const raw = readFileSync(settingsPath, "utf-8");
      settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      settings = { ...DEFAULT_SETTINGS };
    }
  } else {
    settings = { ...DEFAULT_SETTINGS };
  }
  return settings!;
}

export function getSettings(): AppSettings {
  if (!settings) return loadSettings();
  return settings;
}

export function saveSettings(newSettings: Partial<AppSettings>): AppSettings {
  const current = getSettings();
  settings = {
    ...current,
    ...newSettings,
    providers: {
      ...current.providers,
      ...(newSettings.providers || {}),
      ollama: { ...current.providers.ollama, ...(newSettings.providers?.ollama || {}) },
      openrouter: { ...current.providers.openrouter, ...(newSettings.providers?.openrouter || {}) },
      gemini: { ...current.providers.gemini, ...(newSettings.providers?.gemini || {}) },
    },
  };
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
  console.log("[Settings] Saved to", settingsPath);
  return settings;
}
