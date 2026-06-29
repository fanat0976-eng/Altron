import { describe, it, expect, beforeEach } from "vitest";
import { SkillLoader } from "../src/skills/loader/index.js";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";

const TEST_SKILLS_DIR = join(process.cwd(), "test-skills");

describe("SkillLoader", () => {
  let loader: SkillLoader;

  beforeEach(() => {
    loader = new SkillLoader(TEST_SKILLS_DIR);

    // Clean and create test directory
    if (existsSync(TEST_SKILLS_DIR)) {
      rmSync(TEST_SKILLS_DIR, { recursive: true });
    }
    mkdirSync(TEST_SKILLS_DIR, { recursive: true });
  });

  it("should load a skill from markdown file", async () => {
    const skillContent = `# Test Skill

> A test skill for unit testing

\`\`\`yaml
name: test-skill
description: Test skill description
version: 0.1.0
author: Test Author
tags: test, unit
tools: read_file, write_file
\`\`\`

## System Prompt

You are a test assistant. Help with testing tasks.
`;

    writeFileSync(join(TEST_SKILLS_DIR, "test-skill.md"), skillContent, "utf-8");

    const skill = await loader.loadSkill(join(TEST_SKILLS_DIR, "test-skill.md"));

    expect(skill).not.toBeNull();
    expect(skill!.name).toBe("test-skill");
    expect(skill!.description).toBe("Test skill description");
    expect(skill!.metadata.version).toBe("0.1.0");
    expect(skill!.metadata.author).toBe("Test Author");
    expect(skill!.metadata.tags).toEqual(["test", "unit"]);
    expect(skill!.metadata.tools).toEqual(["read_file", "write_file"]);
    expect(skill!.metadata.systemPrompt).toContain("test assistant");
  });

  it("should load all skills from directory", async () => {
    const skill1 = `# Skill One

> First skill

\`\`\`yaml
name: skill-one
description: First test skill
\`\`\`
`;

    const skill2 = `# Skill Two

> Second skill

\`\`\`yaml
name: skill-two
description: Second test skill
\`\`\`
`;

    writeFileSync(join(TEST_SKILLS_DIR, "skill-one.md"), skill1, "utf-8");
    writeFileSync(join(TEST_SKILLS_DIR, "skill-two.md"), skill2, "utf-8");

    const skills = await loader.loadDirectory(TEST_SKILLS_DIR);
    expect(skills).toHaveLength(2);
  });

  it("should skip non-markdown files", async () => {
    writeFileSync(join(TEST_SKILLS_DIR, "readme.txt"), "Not a skill", "utf-8");
    writeFileSync(join(TEST_SKILLS_DIR, "config.json"), "{}", "utf-8");

    const skills = await loader.loadDirectory(TEST_SKILLS_DIR);
    expect(skills).toHaveLength(0);
  });

  it("should discover skills from builtin and custom directories", async () => {
    const builtinDir = join(TEST_SKILLS_DIR, "builtin");
    mkdirSync(builtinDir, { recursive: true });

    const builtinSkill = `# Builtin Skill

> Built-in skill

\`\`\`yaml
name: builtin-skill
description: Built-in test skill
\`\`\`
`;

    const customSkill = `# Custom Skill

> Custom skill

\`\`\`yaml
name: custom-skill
description: Custom test skill
\`\`\`
`;

    writeFileSync(join(builtinDir, "builtin-skill.md"), builtinSkill, "utf-8");
    writeFileSync(join(TEST_SKILLS_DIR, "custom-skill.md"), customSkill, "utf-8");

    const skills = await loader.discover();
    expect(skills.length).toBeGreaterThanOrEqual(2);

    const names = skills.map((s) => s.name);
    expect(names).toContain("builtin-skill");
    expect(names).toContain("custom-skill");
  });

  it("should handle skill without yaml frontmatter", async () => {
    const skillContent = `# SimpleSkill

> Simple description without yaml

Just plain markdown content.
`;

    writeFileSync(join(TEST_SKILLS_DIR, "simple.md"), skillContent, "utf-8");

    const skill = await loader.loadSkill(join(TEST_SKILLS_DIR, "simple.md"));
    expect(skill).not.toBeNull();
    expect(skill!.name).toBe("SimpleSkill");
    expect(skill!.description).toBe("Simple description without yaml");
  });

  it("should handle non-existent file", async () => {
    const skill = await loader.loadSkill("/nonexistent/skill.md");
    expect(skill).toBeNull();
  });

  it("should handle invalid markdown", async () => {
    const invalidContent = "This is just random text without skill structure";
    writeFileSync(join(TEST_SKILLS_DIR, "invalid.md"), invalidContent, "utf-8");

    const skill = await loader.loadSkill(join(TEST_SKILLS_DIR, "invalid.md"));
    expect(skill).not.toBeNull();
    expect(skill!.name).toBe("invalid");
  });
});
