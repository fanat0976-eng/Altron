import { describe, it, expect, beforeEach } from "vitest";
import { DocumentLoader } from "../src/rag/loader/index.js";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";

const TEST_DIR = join(process.cwd(), "test-rag-docs");

describe("DocumentLoader", () => {
  let loader: DocumentLoader;

  beforeEach(() => {
    loader = new DocumentLoader({
      workDir: TEST_DIR,
      extensions: [".txt", ".md", ".json"],
      maxFileSize: 1024 * 1024,
      chunkSize: 100,
      chunkOverlap: 20,
    });

    // Clean and create test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  it("should load a single text file", async () => {
    const filePath = join(TEST_DIR, "test.txt");
    writeFileSync(filePath, "Hello world content", "utf-8");

    const docs = await loader.loadFile(filePath);
    expect(docs).toHaveLength(1);
    expect(docs[0].content).toBe("Hello world content");
    expect(docs[0].path).toBe("test.txt");
    expect(docs[0].metadata.extension).toBe(".txt");
  });

  it("should chunk large files", async () => {
    const filePath = join(TEST_DIR, "large.txt");
    const content = "A".repeat(250);
    writeFileSync(filePath, content, "utf-8");

    const docs = await loader.loadFile(filePath);
    expect(docs.length).toBeGreaterThan(1);
    expect(docs[0].metadata.chunkIndex).toBe(0);
  });

  it("should skip files with unsupported extensions", async () => {
    const filePath = join(TEST_DIR, "binary.exe");
    writeFileSync(filePath, "binary content", "utf-8");

    const docs = await loader.loadFile(filePath);
    expect(docs).toHaveLength(0);
  });

  it("should skip empty files", async () => {
    const filePath = join(TEST_DIR, "empty.txt");
    writeFileSync(filePath, "", "utf-8");

    const docs = await loader.loadFile(filePath);
    expect(docs).toHaveLength(0);
  });

  it("should load markdown files", async () => {
    const filePath = join(TEST_DIR, "readme.md");
    writeFileSync(filePath, "# Title\n\nContent here", "utf-8");

    const docs = await loader.loadFile(filePath);
    expect(docs).toHaveLength(1);
    expect(docs[0].content).toContain("# Title");
  });

  it("should load JSON files", async () => {
    const filePath = join(TEST_DIR, "data.json");
    writeFileSync(filePath, '{"key": "value"}', "utf-8");

    const docs = await loader.loadFile(filePath);
    expect(docs).toHaveLength(1);
    expect(docs[0].content).toContain("key");
  });

  it("should load directory recursively", async () => {
    const subDir = join(TEST_DIR, "subdir");
    mkdirSync(subDir, { recursive: true });

    writeFileSync(join(TEST_DIR, "file1.txt"), "File 1 content", "utf-8");
    writeFileSync(join(subDir, "file2.txt"), "File 2 content", "utf-8");

    const docs = await loader.loadDirectory(TEST_DIR);
    expect(docs.length).toBeGreaterThanOrEqual(2);
  });

  it("should skip node_modules directories", async () => {
    const nodeModules = join(TEST_DIR, "node_modules");
    mkdirSync(nodeModules, { recursive: true });

    writeFileSync(join(TEST_DIR, "file.txt"), "File content", "utf-8");
    writeFileSync(join(nodeModules, "dep.txt"), "Dependency", "utf-8");

    const docs = await loader.loadDirectory(TEST_DIR);
    const hasNodeModules = docs.some((d) => d.path.includes("node_modules"));
    expect(hasNodeModules).toBe(false);
  });

  it("should skip hidden directories", async () => {
    const hiddenDir = join(TEST_DIR, ".git");
    mkdirSync(hiddenDir, { recursive: true });

    writeFileSync(join(TEST_DIR, "file.txt"), "File content", "utf-8");
    writeFileSync(join(hiddenDir, "config"), "Git config", "utf-8");

    const docs = await loader.loadDirectory(TEST_DIR);
    const hasHidden = docs.some((d) => d.path.startsWith("."));
    expect(hasHidden).toBe(false);
  });

  it("should handle non-existent path gracefully", async () => {
    const docs = await loader.load("/nonexistent/path");
    expect(docs).toHaveLength(0);
  });
});
