import { readFile, writeFile, stat, mkdir, readdir, unlink, rename } from "fs/promises";
import { join, dirname } from "path";
import type { ToolDefinition, ToolResult, ToolContext } from "../../plugins/sdk/index.js";

export const readFileTool: ToolDefinition = {
  name: "read_file",
  description: "Read file contents. Use for reading code, configs, logs, etc.",
  parameters: {
    path: { type: "string", description: "File path (absolute or relative to workDir)", required: true },
    encoding: { type: "string", description: "File encoding (default: utf-8)" },
  },
  handler: async (params, context): Promise<ToolResult> => {
    const filePath = join(context.workDir, params.path as string);
    try {
      const content = await readFile(filePath, (params.encoding as BufferEncoding) || "utf-8");
      return { success: true, output: content };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};

export const writeFileTool: ToolDefinition = {
  name: "write_file",
  description: "Write content to a file. Creates parent directories if needed.",
  parameters: {
    path: { type: "string", description: "File path", required: true },
    content: { type: "string", description: "File content", required: true },
  },
  handler: async (params, context): Promise<ToolResult> => {
    const filePath = join(context.workDir, params.path as string);
    try {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, params.content as string, "utf-8");
      return { success: true, output: `Written ${filePath}` };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};

export const editFileTool: ToolDefinition = {
  name: "edit_file",
  description: "Replace text in a file (exact string match).",
  parameters: {
    path: { type: "string", description: "File path", required: true },
    old_text: { type: "string", description: "Text to find", required: true },
    new_text: { type: "string", description: "Replacement text", required: true },
  },
  handler: async (params, context): Promise<ToolResult> => {
    const filePath = join(context.workDir, params.path as string);
    try {
      const content = await readFile(filePath, "utf-8");
      const oldText = params.old_text as string;
      const newText = params.new_text as string;

      if (!content.includes(oldText)) {
        return { success: false, error: "old_text not found in file" };
      }

      const updated = content.replace(oldText, newText);
      await writeFile(filePath, updated, "utf-8");
      return { success: true, output: `Edited ${filePath}` };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};

export const listDirTool: ToolDefinition = {
  name: "list_dir",
  description: "List directory contents.",
  parameters: {
    path: { type: "string", description: "Directory path" },
  },
  handler: async (params, context): Promise<ToolResult> => {
    const dirPath = join(context.workDir, (params.path as string) || ".");
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      const result = entries.map((e) => ({
        name: e.name,
        type: e.isDirectory() ? "dir" : "file",
      }));
      return { success: true, output: JSON.stringify(result, null, 2) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};

export const deleteFileTool: ToolDefinition = {
  name: "delete_file",
  description: "Delete a file or empty directory.",
  parameters: {
    path: { type: "string", description: "File or directory path", required: true },
  },
  handler: async (params, context): Promise<ToolResult> => {
    const filePath = join(context.workDir, params.path as string);
    try {
      await unlink(filePath);
      return { success: true, output: `Deleted ${filePath}` };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};

export const moveFileTool: ToolDefinition = {
  name: "move_file",
  description: "Move or rename a file.",
  parameters: {
    source: { type: "string", description: "Source path", required: true },
    destination: { type: "string", description: "Destination path", required: true },
  },
  handler: async (params, context): Promise<ToolResult> => {
    const src = join(context.workDir, params.source as string);
    const dest = join(context.workDir, params.destination as string);
    try {
      await rename(src, dest);
      return { success: true, output: `Moved ${src} → ${dest}` };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};

export const fileInfoTool: ToolDefinition = {
  name: "file_info",
  description: "Get file/directory info (size, dates, type).",
  parameters: {
    path: { type: "string", description: "File or directory path", required: true },
  },
  handler: async (params, context): Promise<ToolResult> => {
    const filePath = join(context.workDir, params.path as string);
    try {
      const info = await stat(filePath);
      return {
        success: true,
        output: JSON.stringify(
          {
            type: info.isDirectory() ? "directory" : "file",
            size: info.size,
            created: info.birthtime.toISOString(),
            modified: info.mtime.toISOString(),
          },
          null,
          2
        ),
      };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};

export const fileTools: ToolDefinition[] = [
  readFileTool,
  writeFileTool,
  editFileTool,
  listDirTool,
  deleteFileTool,
  moveFileTool,
  fileInfoTool,
];
