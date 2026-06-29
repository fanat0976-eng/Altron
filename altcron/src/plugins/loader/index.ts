import { readdir, readFile, stat } from "fs/promises";
import { join, resolve } from "path";
import type { Plugin, PluginManifest, ToolDefinition } from "../sdk/index.js";

export class PluginLoader {
  private extensionsDir: string;

  constructor(extensionsDir = "./src/extensions") {
    this.extensionsDir = resolve(extensionsDir);
  }

  async discover(): Promise<string[]> {
    const plugins: string[] = [];

    try {
      const entries = await readdir(this.extensionsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const manifestPath = join(this.extensionsDir, entry.name, "manifest.json");
          try {
            await stat(manifestPath);
            plugins.push(entry.name);
          } catch {
            continue;
          }
        }
      }
    } catch {
      console.warn(`[PluginLoader] Extensions dir not found: ${this.extensionsDir}`);
    }

    return plugins;
  }

  async load(pluginName: string): Promise<Plugin | null> {
    const pluginDir = join(this.extensionsDir, pluginName);
    const manifestPath = join(pluginDir, "manifest.json");

    try {
      const manifestRaw = await readFile(manifestPath, "utf-8");
      const manifest: PluginManifest = JSON.parse(manifestRaw);

      const modulePath = join(pluginDir, "index.ts");
      const module = await import(`file://${modulePath}`);

      const tools: ToolDefinition[] = [];
      for (const toolName of manifest.tools || []) {
        const tool = module[`${toolName}Tool`] || module[`${toolName}Tools`];
        if (Array.isArray(tool)) {
          tools.push(...tool);
        } else if (tool) {
          tools.push(tool);
        }
      }

      if (tools.length === 0) {
        const allExports = Object.values(module).flat();
        for (const exp of allExports) {
          if (exp && typeof exp === "object" && "name" in exp && "handler" in exp) {
            tools.push(exp as ToolDefinition);
          }
        }
      }

      const activate = module.activate || (async () => {});
      const deactivate = module.deactivate || (async () => {});

      return {
        manifest,
        activate: async () => {
          await activate();
        },
        deactivate: async () => {
          await deactivate();
        },
      };
    } catch (err) {
      console.error(`[PluginLoader] Failed to load ${pluginName}:`, (err as Error).message);
      return null;
    }
  }

  async loadTools(pluginName: string): Promise<ToolDefinition[]> {
    const pluginDir = join(this.extensionsDir, pluginName);
    const manifestPath = join(pluginDir, "manifest.json");

    try {
      const manifestRaw = await readFile(manifestPath, "utf-8");
      const manifest: PluginManifest = JSON.parse(manifestRaw);

      const modulePath = join(pluginDir, "index.ts");
      const module = await import(`file://${modulePath}`);

      const tools: ToolDefinition[] = [];

      for (const key of Object.keys(module)) {
        const exp = module[key];
        if (Array.isArray(exp)) {
          for (const item of exp) {
            if (item && typeof item === "object" && "name" in item && "handler" in item) {
              tools.push(item as ToolDefinition);
            }
          }
        } else if (exp && typeof exp === "object" && "name" in exp && "handler" in exp) {
          tools.push(exp as ToolDefinition);
        }
      }

      return tools;
    } catch (err) {
      console.error(`[PluginLoader] Failed to load tools from ${pluginName}:`, (err as Error).message);
      return [];
    }
  }

  async loadAll(): Promise<Plugin[]> {
    const names = await this.discover();
    const plugins: Plugin[] = [];

    for (const name of names) {
      const plugin = await this.load(name);
      if (plugin) plugins.push(plugin);
    }

    return plugins;
  }

  async loadAllTools(): Promise<ToolDefinition[]> {
    const names = await this.discover();
    const allTools: ToolDefinition[] = [];

    for (const name of names) {
      const tools = await this.loadTools(name);
      allTools.push(...tools);
    }

    return allTools;
  }
}
