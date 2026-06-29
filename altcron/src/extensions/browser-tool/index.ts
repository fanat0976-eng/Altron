import type { ToolDefinition, ToolResult, ToolContext } from "../../plugins/sdk/index.js";

export const openUrlTool: ToolDefinition = {
  name: "open_url",
  description: "Open a URL in the default browser.",
  parameters: {
    url: { type: "string", description: "URL to open", required: true },
  },
  handler: async (params): Promise<ToolResult> => {
    const url = params.url as string;
    try {
      const { exec } = await import("child_process");
      const platform = process.platform;
      const cmd = platform === "win32" ? `start "" "${url}"` : platform === "darwin" ? `open "${url}"` : `xdg-open "${url}"`;
      exec(cmd);
      return { success: true, output: `Opened: ${url}` };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};

export const fetchUrlTool: ToolDefinition = {
  name: "fetch_url",
  description: "Fetch content from a URL. Returns response text.",
  parameters: {
    url: { type: "string", description: "URL to fetch", required: true },
    method: { type: "string", description: "HTTP method (GET, POST, etc.)" },
    body: { type: "string", description: "Request body (for POST)" },
    headers: { type: "string", description: "JSON headers string" },
  },
  handler: async (params): Promise<ToolResult> => {
    const url = params.url as string;
    const method = (params.method as string) || "GET";

    try {
      const init: RequestInit = { method };

      if (params.headers) {
        init.headers = JSON.parse(params.headers as string);
      }
      if (params.body) {
        init.body = params.body as string;
        if (!init.headers) init.headers = { "Content-Type": "application/json" };
      }

      const res = await fetch(url, init);
      const text = await res.text();

      return {
        success: res.ok,
        output: text.slice(0, 10000),
        metadata: { status: res.status, contentType: res.headers.get("content-type") },
      };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};

export const searchWebTool: ToolDefinition = {
  name: "search_web",
  description: "Search the web using DuckDuckGo HTML (no API key needed).",
  parameters: {
    query: { type: "string", description: "Search query", required: true },
  },
  handler: async (params): Promise<ToolResult> => {
    const query = params.query as string;
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      });
      const html = await res.text();

      const results: string[] = [];
      const regex = /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      let match;
      while ((match = regex.exec(html)) !== null && results.length < 5) {
        const href = match[1];
        const title = match[2].replace(/<[^>]*>/g, "").trim();
        results.push(`${title}\n${href}`);
      }

      return {
        success: results.length > 0,
        output: results.length > 0 ? results.join("\n\n") : "No results found",
      };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};

export const browserTools: ToolDefinition[] = [openUrlTool, fetchUrlTool, searchWebTool];
