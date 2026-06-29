import { SkillLoader, type Skill } from "../loader/index.js";

export class SkillRegistry {
  private skills = new Map<string, Skill>();
  private loader: SkillLoader;
  private activeSkills = new Set<string>();

  constructor(skillsDir?: string) {
    this.loader = new SkillLoader(skillsDir);
  }

  async discover(skillsDir?: string): Promise<void> {
    const skills = await this.loader.discover(skillsDir);
    for (const skill of skills) {
      this.skills.set(skill.name, skill);
    }
  }

  async loadSkill(path: string): Promise<Skill | null> {
    const skill = await this.loader.loadSkill(path);
    if (skill) {
      this.skills.set(skill.name, skill);
    }
    return skill;
  }

  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  list(): Skill[] {
    return Array.from(this.skills.values());
  }

  listActive(): Skill[] {
    return this.list().filter((s) => this.activeSkills.has(s.name));
  }

  activate(name: string): boolean {
    if (!this.skills.has(name)) return false;
    this.activeSkills.add(name);
    return true;
  }

  deactivate(name: string): boolean {
    return this.activeSkills.delete(name);
  }

  getSystemPrompt(): string {
    const active = this.listActive();
    if (active.length === 0) return "";

    const prompts = active
      .filter((s) => s.metadata.systemPrompt)
      .map((s) => `### ${s.name}\n${s.metadata.systemPrompt}`);

    return prompts.join("\n\n");
  }

  getAvailableTools(): string[] {
    const tools = new Set<string>();
    for (const skill of this.listActive()) {
      const skillTools = skill.metadata.tools;
      if (Array.isArray(skillTools)) {
        for (const tool of skillTools) {
          tools.add(tool);
        }
      }
    }
    return Array.from(tools);
  }
}
