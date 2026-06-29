import { describe, it, expect, beforeEach } from "vitest";
import { SkillRegistry } from "../src/skills/registry/index.js";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";

const TEST_SKILLS_DIR = join(process.cwd(), "test-skills-registry");

describe("SkillRegistry", () => {
  let registry: SkillRegistry;

  beforeEach(() => {
    registry = new SkillRegistry(TEST_SKILLS_DIR);

    // Clean and create test directory
    if (existsSync(TEST_SKILLS_DIR)) {
      rmSync(TEST_SKILLS_DIR, { recursive: true });
    }
    mkdirSync(TEST_SKILLS_DIR, { recursive: true });
  });

  it("should discover and register skills", async () => {
    const skillContent = `# Test Skill

> Test description

\`\`\`yaml
name: test-skill
description: A test skill
tools: read_file, write_file
\`\`\`
`;

    writeFileSync(join(TEST_SKILLS_DIR, "test-skill.md"), skillContent, "utf-8");

    await registry.discover();

    const skills = registry.list();
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("test-skill");
  });

  it("should activate and deactivate skills", async () => {
    const skillContent = `# Test Skill

> Test description

\`\`\`yaml
name: test-skill
description: A test skill
\`\`\`
`;

    writeFileSync(join(TEST_SKILLS_DIR, "test-skill.md"), skillContent, "utf-8");
    await registry.discover();

    expect(registry.activate("test-skill")).toBe(true);
    expect(registry.listActive()).toHaveLength(1);

    expect(registry.deactivate("test-skill")).toBe(true);
    expect(registry.listActive()).toHaveLength(0);
  });

  it("should return false for unknown skill activation", async () => {
    expect(registry.activate("nonexistent")).toBe(false);
  });

  it("should generate system prompt from active skills", async () => {
    const skillContent = `# Test Skill

> Test description

\`\`\`yaml
name: test-skill
description: A test skill
\`\`\`

## System Prompt

You are a helpful test assistant.
`;

    writeFileSync(join(TEST_SKILLS_DIR, "test-skill.md"), skillContent, "utf-8");
    await registry.discover();
    registry.activate("test-skill");

    const prompt = registry.getSystemPrompt();
    expect(prompt).toContain("test-skill");
    expect(prompt).toContain("helpful test assistant");
  });

  it("should return empty prompt for no active skills", async () => {
    const prompt = registry.getSystemPrompt();
    expect(prompt).toBe("");
  });

  it("should list available tools from active skills", async () => {
    const skillContent = `# Test Skill

> Test description

\`\`\`yaml
name: test-skill
description: A test skill
tools: read_file, write_file, bash
\`\`\`
`;

    writeFileSync(join(TEST_SKILLS_DIR, "test-skill.md"), skillContent, "utf-8");
    await registry.discover();
    registry.activate("test-skill");

    const tools = registry.getAvailableTools();
    expect(tools).toContain("read_file");
    expect(tools).toContain("write_file");
    expect(tools).toContain("bash");
    expect(tools).toHaveLength(3);
  });

  it("should load individual skill by path", async () => {
    const skillContent = `# Manual Skill

> Manually loaded

\`\`\`yaml
name: manual-skill
description: Manually loaded skill
\`\`\`
`;

    const skillPath = join(TEST_SKILLS_DIR, "manual-skill.md");
    writeFileSync(skillPath, skillContent, "utf-8");

    const skill = await registry.loadSkill(skillPath);
    expect(skill).not.toBeNull();
    expect(skill!.name).toBe("manual-skill");

    const skills = registry.list();
    expect(skills).toHaveLength(1);
  });

  it("should not duplicate skills when discovered twice", async () => {
    const skillContent = `# Test Skill

> Test description

\`\`\`yaml
name: test-skill
description: A test skill
\`\`\`
`;

    writeFileSync(join(TEST_SKILLS_DIR, "test-skill.md"), skillContent, "utf-8");

    await registry.discover();
    await registry.discover();

    const skills = registry.list();
    expect(skills).toHaveLength(1);
  });
});
