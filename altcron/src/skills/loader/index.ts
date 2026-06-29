import { readFile, readdir, stat } from "fs/promises";
import { join, extname } from "path";

export interface Skill {
  name: string;
  description: string;
  content: string;
  path: string;
  metadata: Record<string, unknown>;
}

export interface SkillManifest {
  name: string;
  description: string;
  version?: string;
  author?: string;
  tags?: string[];
  tools?: string[];
  systemPrompt?: string;
}

export class SkillLoader {
  private skillsDir: string;

  constructor(skillsDir = "./skills") {
    this.skillsDir = skillsDir;
  }

  async loadSkill(skillPath: string): Promise<Skill | null> {
    try {
      const info = await stat(skillPath);
      if (!info.isFile()) return null;

      const content = await readFile(skillPath, "utf-8");
      const parsed = this.parseSkillMarkdown(content);

      return {
        name: parsed.name || skillPath.split(/[/\\]/).pop()?.replace(/\.\w+$/, "") || "unknown",
        description: parsed.description || "",
        content,
        path: skillPath,
        metadata: parsed,
      };
    } catch {
      return null;
    }
  }

  async loadDirectory(dirPath: string): Promise<Skill[]> {
    const skills: Skill[] = [];

    try {
      const entries = await readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile() && extname(entry.name) === ".md") {
          const skill = await this.loadSkill(join(dirPath, entry.name));
          if (skill) skills.push(skill);
        }
      }
    } catch {}

    return skills;
  }

  async discover(skillsDir?: string): Promise<Skill[]> {
    const dir = skillsDir || this.skillsDir;
    const skills: Skill[] = [];

    const builtin = await this.loadDirectory(join(dir, "builtin"));
    skills.push(...builtin);

    const custom = await this.loadDirectory(dir);
    for (const skill of custom) {
      if (!skills.find((s) => s.name === skill.name)) {
        skills.push(skill);
      }
    }

    return skills;
  }

  private parseSkillMarkdown(content: string): Partial<SkillManifest> {
    const result: Partial<SkillManifest> = {};

    const nameMatch = content.match(/^#\s+(.+)$/m);
    if (nameMatch) result.name = nameMatch[1].trim();

    const descMatch = content.match(/^>\s*(.+)$/m);
    if (descMatch) result.description = descMatch[1].trim();

    const metaMatch = content.match(/```yaml\s*\n([\s\S]*?)\n```/);
    if (metaMatch) {
      const lines = metaMatch[1].split("\n");
      for (const line of lines) {
        const [key, ...valueParts] = line.split(":");
        if (key && valueParts.length) {
          const value = valueParts.join(":").trim();
          switch (key.trim()) {
            case "name": result.name = value; break;
            case "description": result.description = value; break;
            case "version": result.version = value; break;
            case "author": result.author = value; break;
            case "tags": result.tags = value.split(",").map((t) => t.trim()); break;
            case "tools": result.tools = value.split(",").map((t) => t.trim()); break;
          }
        }
      }
    }

    const promptMatch = content.match(/## System Prompt\s*\n([\s\S]*?)(?=\n##|\n$|$)/);
    if (promptMatch) result.systemPrompt = promptMatch[1].trim();

    return result;
  }
}
