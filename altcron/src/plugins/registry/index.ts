import type { Plugin } from "../sdk/index.js";

export class PluginRegistry {
  private plugins = new Map<string, Plugin>();

  register(plugin: Plugin): void {
    const name = plugin.manifest.name;
    if (this.plugins.has(name)) {
      console.warn(`[PluginRegistry] Plugin ${name} already registered, overriding`);
    }
    this.plugins.set(name, plugin);
    console.log(`[PluginRegistry] Registered: ${name} v${plugin.manifest.version}`);
  }

  unregister(name: string): boolean {
    return this.plugins.delete(name);
  }

  get(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  list(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  async activateAll(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      try {
        await plugin.activate();
        console.log(`[PluginRegistry] Activated: ${plugin.manifest.name}`);
      } catch (err) {
        console.error(`[PluginRegistry] Failed to activate ${plugin.manifest.name}:`, (err as Error).message);
      }
    }
  }

  async deactivateAll(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      try {
        await plugin.deactivate();
        console.log(`[PluginRegistry] Deactivated: ${plugin.manifest.name}`);
      } catch (err) {
        console.error(`[PluginRegistry] Failed to deactivate ${plugin.manifest.name}:`, (err as Error).message);
      }
    }
  }
}
