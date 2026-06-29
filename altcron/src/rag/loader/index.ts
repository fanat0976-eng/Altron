import { readFile, stat, readdir } from "fs/promises";
import { join, extname, relative } from "path";

export interface Document {
  id: string;
  path: string;
  content: string;
  metadata: Record<string, unknown>;
}

export interface LoaderOptions {
  workDir: string;
  extensions?: string[];
  maxFileSize?: number;
  chunkSize?: number;
  chunkOverlap?: number;
}

const DEFAULT_EXTENSIONS = [".txt", ".md", ".json", ".csv", ".ts", ".js", ".py", ".rs", ".yaml", ".yml", ".toml"];
const DEFAULT_MAX_FILE_SIZE = 1024 * 1024;
const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_CHUNK_OVERLAP = 200;

export class DocumentLoader {
  private workDir: string;
  private extensions: Set<string>;
  private maxFileSize: number;
  private chunkSize: number;
  private chunkOverlap: number;

  constructor(options: LoaderOptions) {
    this.workDir = options.workDir;
    this.extensions = new Set(options.extensions || DEFAULT_EXTENSIONS);
    this.maxFileSize = options.maxFileSize || DEFAULT_MAX_FILE_SIZE;
    this.chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE;
    this.chunkOverlap = options.chunkOverlap || DEFAULT_CHUNK_OVERLAP;
  }

  async loadFile(filePath: string): Promise<Document[]> {
    const ext = extname(filePath).toLowerCase();
    if (!this.extensions.has(ext)) return [];

    try {
      const info = await stat(filePath);
      if (info.size > this.maxFileSize) return [];
      if (!info.isFile()) return [];

      const content = await readFile(filePath, "utf-8");
      if (!content.trim()) return [];

      const relPath = relative(this.workDir, filePath);
      const chunks = this.chunkText(content);

      return chunks.map((chunk, i) => ({
        id: `${relPath}#${i}`,
        path: relPath,
        content: chunk,
        metadata: {
          fileName: extname(filePath) ? relPath.split(/[/\\]/).pop() : relPath,
          extension: ext,
          size: info.size,
          modified: info.mtime.toISOString(),
          chunkIndex: i,
          totalChunks: chunks.length,
        },
      }));
    } catch {
      return [];
    }
  }

  async loadDirectory(dirPath: string, maxDepth = 5): Promise<Document[]> {
    if (maxDepth <= 0) return [];

    const docs: Document[] = [];

    try {
      const entries = await readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name.startsWith(".") || entry.name === "node_modules") continue;

        const fullPath = join(dirPath, entry.name);

        if (entry.isFile()) {
          const fileDocs = await this.loadFile(fullPath);
          docs.push(...fileDocs);
        } else if (entry.isDirectory()) {
          const subDocs = await this.loadDirectory(fullPath, maxDepth - 1);
          docs.push(...subDocs);
        }
      }
    } catch {}

    return docs;
  }

  async load(path: string): Promise<Document[]> {
    try {
      const info = await stat(path);
      if (info.isFile()) return this.loadFile(path);
      if (info.isDirectory()) return this.loadDirectory(path);
    } catch {}
    return [];
  }

  private chunkText(text: string): string[] {
    if (text.length <= this.chunkSize) return [text];

    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      let end = start + this.chunkSize;

      if (end < text.length) {
        const lastNewline = text.lastIndexOf("\n", end);
        const lastSpace = text.lastIndexOf(" ", end);
        const breakPoint = Math.max(lastNewline, lastSpace);
        if (breakPoint > start + this.chunkSize * 0.5) {
          end = breakPoint;
        }
      }

      chunks.push(text.slice(start, end).trim());
      start = end - this.chunkOverlap;
    }

    return chunks.filter((c) => c.length > 0);
  }
}
