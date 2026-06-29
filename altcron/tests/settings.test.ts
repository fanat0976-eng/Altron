import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";

const TEST_DIR = join(process.cwd(), "test-settings-data");

describe("SettingsStore", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  it("should load default settings when no file exists", async () => {
    const { loadSettings } = await import("../src/settings/index.js");
    const settings = loadSettings(TEST_DIR);

    expect(settings.defaultProvider).toBe("ollama");
    expect(settings.providers.ollama.baseUrl).toBe("http://localhost:11434");
    expect(settings.providers.ollama.defaultModel).toBe("qwen2.5:7b");
    expect(settings.fallback).toContain("ollama");
  });

  it("should read existing settings file", async () => {
    const customSettings = {
      defaultProvider: "openrouter",
      providers: {
        ollama: { baseUrl: "http://custom:11434", defaultModel: "custom-model" },
        openrouter: { apiKey: "test-key", baseUrl: "https://custom.api", defaultModel: "custom" },
        gemini: { apiKey: "", model: "custom-gemini" },
      },
      fallback: ["openrouter", "ollama"],
    };

    writeFileSync(join(TEST_DIR, "settings.json"), JSON.stringify(customSettings), "utf-8");

    const { loadSettings } = await import("../src/settings/index.js");
    const settings = loadSettings(TEST_DIR);

    expect(settings.defaultProvider).toBe("openrouter");
    expect(settings.providers.ollama.baseUrl).toBe("http://custom:11434");
  });

  it("should save and read back settings", async () => {
    const { loadSettings, saveSettings, getSettings } = await import("../src/settings/index.js");

    loadSettings(TEST_DIR);
    saveSettings({
      providers: {
        openrouter: { apiKey: "my-api-key", baseUrl: "https://openrouter.ai/api/v1", defaultModel: "claude-3.5-sonnet" },
      } as any,
    });

    const settings = getSettings();
    expect(settings.providers.openrouter.apiKey).toBe("my-api-key");
  });

  it("should merge partial settings on save", async () => {
    const { loadSettings, saveSettings, getSettings } = await import("../src/settings/index.js");

    loadSettings(TEST_DIR);

    saveSettings({
      providers: {
        ollama: { baseUrl: "http://new-host:11434", defaultModel: "qwen2.5:14b" },
      } as any,
    });

    const settings = getSettings();
    expect(settings.providers.ollama.baseUrl).toBe("http://new-host:11434");
    // OpenRouter should still have defaults
    expect(settings.providers.openrouter.baseUrl).toBe("https://openrouter.ai/api/v1");
  });

  it("should handle corrupted settings file gracefully", async () => {
    writeFileSync(join(TEST_DIR, "settings.json"), "not valid json {{{", "utf-8");

    const { loadSettings } = await import("../src/settings/index.js");
    const settings = loadSettings(TEST_DIR);

    // Should fall back to defaults
    expect(settings.defaultProvider).toBe("ollama");
  });

  it("should get settings without explicit load", async () => {
    const { getSettings } = await import("../src/settings/index.js");
    const settings = getSettings();

    expect(settings).toBeDefined();
    expect(settings.providers).toBeDefined();
  });
});
