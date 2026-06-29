import express from "express";
import cors from "cors";
import { loadConfig, getConfig } from "./config/index.js";
import { getDatabase, closeDatabase } from "./state/index.js";
import { SessionManager } from "./sessions/index.js";
import { LLMClient, type LLMMessage } from "./llm/index.js";
import { ToolRegistry } from "./tools/registry/index.js";
import { PluginLoader } from "./plugins/loader/index.js";
import { PluginRegistry } from "./plugins/registry/index.js";
import { Gateway } from "./gateway/index.js";
import { loadSettings, getSettings, saveSettings } from "./settings/index.js";
import { Agent } from "./agents/core/index.js";
import { fileTools } from "./extensions/file-tool/index.js";
import { bashTools } from "./extensions/system-tool/index.js";
import { browserTools } from "./extensions/browser-tool/index.js";
import { Retriever } from "./rag/retriever/index.js";
import { SkillRegistry } from "./skills/registry/index.js";
import { MCPServer } from "./mcp/server/index.js";
import { loadOrCreateToken, validateToken, getAuthInfo, generateQRBuffer, printQRToConsole, getServerUrl } from "./auth/index.js";

const sessionManager = new SessionManager();
const llm = new LLMClient();
const toolRegistry = new ToolRegistry();
const pluginLoader = new PluginLoader();
const pluginRegistry = new PluginRegistry();
const skillRegistry = new SkillRegistry();
let agent: Agent;
let retriever: Retriever;
let mcpServer: MCPServer;

type AsyncHandler = (req: express.Request, res: express.Response) => Promise<void | express.Response>;
function asyncHandler(fn: AsyncHandler) {
  return (req: express.Request, res: express.Response) => {
    fn(req, res).catch((err) => {
      console.error(`[HTTP] Error:`, err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || "Internal server error" });
      }
    });
  };
}

function setupRoutes(app: express.Application): void {
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", version: "0.1.0", uptime: process.uptime() });
  });

  app.get("/api/auth/info", (_req, res) => {
    const port = getConfig().server.port;
    res.json(getAuthInfo(port));
  });

  app.get("/api/auth/qr", asyncHandler(async (_req, res) => {
    const port = getConfig().server.port;
    const url = `${getServerUrl(port)}?token=${getAuthToken()}`;
    const buf = await generateQRBuffer(url);
    res.setHeader("Content-Type", "image/png");
    res.send(buf);
  }));

  app.use("/api", (req, res, next) => {
    if (req.path.startsWith("/auth")) return next();
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
    if (!validateToken(token)) {
      return res.status(401).json({ error: "Unauthorized. Provide Authorization: Bearer <token>" });
    }
    next();
  });

  app.get("/api/sessions", asyncHandler(async (_req, res) => {
    const sessions = await sessionManager.list();
    res.json(sessions);
  }));

  app.post("/api/sessions", asyncHandler(async (req, res) => {
    const { name, model, systemPrompt } = req.body;
    const session = await sessionManager.create(name, model, systemPrompt);
    res.json(session);
  }));

  app.get("/api/sessions/:id", asyncHandler(async (req, res) => {
    const session = await sessionManager.get(req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found" });
    res.json(session);
  }));

  app.delete("/api/sessions/:id", asyncHandler(async (req, res) => {
    await sessionManager.delete(req.params.id);
    res.json({ ok: true });
  }));

  app.get("/api/sessions/:id/messages", asyncHandler(async (req, res) => {
    const messages = await sessionManager.getMessages(req.params.id);
    res.json(messages);
  }));

  app.get("/api/models", asyncHandler(async (_req, res) => {
    const models = await llm.listOllamaModels();
    res.json({ ollama: models });
  }));

  app.get("/api/tools", (_req, res) => {
    const tools = toolRegistry.toFunctionDefinitions();
    res.json(tools);
  });

  app.post("/api/tools/:name/call", asyncHandler(async (req, res) => {
    const { name } = req.params;
    const { params: toolParams, sessionId } = req.body;

    const context = {
      sessionId: sessionId || "api-call",
      workDir: process.cwd(),
      env: Object.fromEntries(Object.entries(process.env).filter(([_, v]) => v !== undefined) as [string, string][]),
    };

    const result = await toolRegistry.call(name, toolParams || {}, context);
    res.json(result);
  }));

  app.get("/api/plugins", (_req, res) => {
    const plugins = pluginRegistry.list().map((p) => ({
      name: p.manifest.name,
      version: p.manifest.version,
      description: p.manifest.description,
    }));
    res.json(plugins);
  });

  app.post("/api/agent/chat", asyncHandler(async (req, res) => {
    const { sessionId, message, model, provider } = req.body;
    if (!sessionId || !message) {
      return res.status(400).json({ error: "sessionId and message required" });
    }

    let session = await sessionManager.get(sessionId);
    if (!session) {
      session = await sessionManager.create("Agent Chat", model);
    }
    const sid = session.id;

    await sessionManager.addMessage(sid, "user", message);

    const history = await sessionManager.getMessageHistory(sid);
    const messages: LLMMessage[] = history.map((m) => ({
      role: m.role as LLMMessage["role"],
      content: m.content,
    }));

    const result = await agent.run(sid, message, messages);

    await sessionManager.addMessage(sid, "assistant", result.response);

    res.json(result);
  }));

  app.post("/api/agent/plan", asyncHandler(async (req, res) => {
    const { sessionId, goal } = req.body;
    if (!sessionId || !goal) {
      return res.status(400).json({ error: "sessionId and goal required" });
    }

    const result = await agent.planAndExecute(sessionId, goal);
    res.json(result);
  }));

  app.get("/api/agent/memory/:sessionId", asyncHandler(async (req, res) => {
    const memories = await agent.getMemory().list(req.params.sessionId);
    res.json(memories);
  }));

  app.post("/api/agent/memory/:sessionId", asyncHandler(async (req, res) => {
    const { key, value, type } = req.body;
    const entry = await agent.getMemory().remember(req.params.sessionId, key, value, type);
    res.json(entry);
  }));

  app.delete("/api/agent/memory/:sessionId", asyncHandler(async (req, res) => {
    const { key } = req.body;
    const deleted = await agent.getMemory().forget(req.params.sessionId, key);
    res.json({ deleted });
  }));

  app.post("/api/rag/index", asyncHandler(async (req, res) => {
    const { path } = req.body;
    if (!path) return res.status(400).json({ error: "path required" });
    const result = await retriever.index(path);
    res.json(result);
  }));

  app.post("/api/rag/query", asyncHandler(async (req, res) => {
    const { query, topK, path } = req.body;
    if (!query) return res.status(400).json({ error: "query required" });
    const results = await retriever.query(query, { topK, path });
    res.json(results);
  }));

  app.get("/api/rag/context/:query", asyncHandler(async (req, res) => {
    const context = await retriever.getContext(req.params.query);
    res.json({ context });
  }));

  app.get("/api/rag/stats", asyncHandler(async (_req, res) => {
    const stats = await retriever.getStats();
    res.json(stats);
  }));

  app.get("/api/skills", (_req, res) => {
    const skills = skillRegistry.list().map((s) => ({
      name: s.name,
      description: s.description,
      path: s.path,
      active: skillRegistry.listActive().some((a) => a.name === s.name),
    }));
    res.json(skills);
  });

  app.post("/api/skills/:name/activate", (req, res) => {
    const activated = skillRegistry.activate(req.params.name);
    res.json({ activated });
  });

  app.post("/api/skills/:name/deactivate", (req, res) => {
    const deactivated = skillRegistry.deactivate(req.params.name);
    res.json({ deactivated });
  });

  app.get("/api/mcp/tools", (_req, res) => {
    const tools = toolRegistry.listEnabled().map((t) => ({
      name: t.definition.name,
      description: t.definition.description,
      source: t.source,
    }));
    res.json(tools);
  });

  app.post("/api/mcp/call", asyncHandler(async (req, res) => {
    const { name, arguments: args } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    const context = {
      sessionId: "mcp-call",
      workDir: process.cwd(),
      env: Object.fromEntries(Object.entries(process.env).filter(([_, v]) => v !== undefined) as [string, string][]),
    };
    const result = await toolRegistry.call(name, args || {}, context);
    res.json(result);
  }));

  app.get("/api/settings", (_req, res) => {
    res.json(getSettings());
  });

  app.put("/api/settings", asyncHandler(async (req, res) => {
    const updated = saveSettings(req.body);
    res.json(updated);
  }));

  app.get("/api/providers", (_req, res) => {
    const s = getSettings();
    const providers = [
      { id: "ollama", name: "Ollama (Local)", hasApiKey: false, configured: true },
      { id: "openrouter", name: "OpenRouter (Cloud)", hasApiKey: !!s.providers.openrouter.apiKey, configured: !!s.providers.openrouter.apiKey },
      { id: "gemini", name: "Gemini (Google)", hasApiKey: !!s.providers.gemini.apiKey, configured: !!s.providers.gemini.apiKey },
    ];
    res.json(providers);
  });

  app.get("/api/providers/:id/models", asyncHandler(async (req, res) => {
    const providerId = req.params.id;
    if (providerId === "ollama") {
      const models = await llm.listOllamaModels();
      res.json(models);
    } else if (providerId === "openrouter") {
      const s = getSettings();
      if (!s.providers.openrouter.apiKey) return res.json([]);
      try {
        const r = await fetch(`${s.providers.openrouter.baseUrl}/models`, {
          headers: { Authorization: `Bearer ${s.providers.openrouter.apiKey}` },
        });
        const data: any = await r.json();
        const models = (data.data || []).map((m: any) => ({ id: m.id, name: m.id }));
        res.json(models);
      } catch { res.json([]); }
    } else if (providerId === "gemini") {
      res.json([
        { id: "gemini-pro", name: "Gemini Pro" },
        { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash" },
        { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro" },
      ]);
    } else {
      res.json([]);
    }
  }));
}

async function handleWSMessage(clientId: string, msg: any, gateway: Gateway): Promise<void> {
  switch (msg.type) {
    case "chat": {
      const { sessionId, content, provider, model } = msg;
      if (!sessionId || !content) {
        gateway.sendToClient(clientId, { type: "error", message: "sessionId and content required" });
        return;
      }

      let session = await sessionManager.get(sessionId);
      if (!session) {
        session = await sessionManager.create("Quick Chat", model);
        gateway.sendToClient(clientId, { type: "session_created", session });
      }
      const chatSid = session.id;

      await sessionManager.addMessage(chatSid, "user", content);

      const history = await sessionManager.getMessageHistory(chatSid);
      const messages: LLMMessage[] = [
        ...(session.systemPrompt ? [{ role: "system" as const, content: session.systemPrompt }] : []),
        ...history.map((m) => ({ role: m.role as LLMMessage["role"], content: m.content })),
      ];

      gateway.sendToClient(clientId, { type: "stream_start", sessionId: chatSid });

      let fullContent = "";
      try {
        for await (const chunk of llm.stream(messages, { provider, model: model || session.model })) {
          fullContent += chunk.content;
          gateway.sendToClient(clientId, {
            type: "stream_chunk",
            content: chunk.content,
            done: chunk.done,
            provider: chunk.provider,
            model: chunk.model,
          });
        }
      } catch (err) {
        gateway.sendToClient(clientId, { type: "error", message: (err as Error).message });
        gateway.sendToClient(clientId, { type: "stream_end", sessionId: chatSid });
        return;
      }

      await sessionManager.addMessage(chatSid, "assistant", fullContent);

      gateway.sendToClient(clientId, { type: "stream_end", sessionId: chatSid });
      break;
    }

    case "ping": {
      gateway.sendToClient(clientId, { type: "pong" });
      break;
    }

    case "tool_call": {
      const { toolName, params: toolParams, sessionId: toolSessionId } = msg;
      if (!toolName) {
        gateway.sendToClient(clientId, { type: "error", message: "toolName required" });
        return;
      }

      const context = {
        sessionId: toolSessionId || "ws-call",
        workDir: process.cwd(),
        env: Object.fromEntries(Object.entries(process.env).filter(([_, v]) => v !== undefined) as [string, string][]),
      };

      const result = await toolRegistry.call(toolName, toolParams || {}, context);
      gateway.sendToClient(clientId, { type: "tool_result", toolName, result });
      break;
    }

    case "tools_list": {
      const tools = toolRegistry.toFunctionDefinitions();
      gateway.sendToClient(clientId, { type: "tools_list", tools });
      break;
    }

    case "agent_chat": {
      const { sessionId: agentSessionId, content: agentContent, model: agentModel, provider: agentProvider } = msg;
      if (!agentSessionId || !agentContent) {
        gateway.sendToClient(clientId, { type: "error", message: "sessionId and content required" });
        return;
      }

      let agentSession = await sessionManager.get(agentSessionId);
      if (!agentSession) {
        agentSession = await sessionManager.create("Agent Chat", agentModel);
        gateway.sendToClient(clientId, { type: "session_created", session: agentSession });
      }
      const agentSid = agentSession.id;

      await sessionManager.addMessage(agentSid, "user", agentContent);

      const agentHistory = await sessionManager.getMessageHistory(agentSid);
      const agentMessages: LLMMessage[] = agentHistory.map((m) => ({
        role: m.role as LLMMessage["role"],
        content: m.content,
      }));

      gateway.sendToClient(clientId, { type: "agent_start", sessionId: agentSid });

      try {
        const agentResult = await agent.run(agentSid, agentContent, agentMessages);

        await sessionManager.addMessage(agentSid, "assistant", agentResult.response);

        gateway.sendToClient(clientId, {
          type: "agent_result",
          sessionId: agentSid,
          response: agentResult.response,
          steps: agentResult.steps.map((s) => ({
            type: s.type,
            content: s.content,
            toolName: s.toolName,
            toolResult: s.toolResult,
          })),
        });
      } catch (err) {
        gateway.sendToClient(clientId, { type: "error", message: (err as Error).message });
      }
      break;
    }

    case "agent_plan": {
      const { sessionId: planSessionId, goal } = msg;
      if (!planSessionId || !goal) {
        gateway.sendToClient(clientId, { type: "error", message: "sessionId and goal required" });
        return;
      }

      gateway.sendToClient(clientId, { type: "agent_start", sessionId: planSessionId });

      try {
        const planResult = await agent.planAndExecute(planSessionId, goal);
        gateway.sendToClient(clientId, {
          type: "agent_result",
          sessionId: planSessionId,
          response: planResult.response,
          plan: planResult.plan,
          steps: planResult.steps.map((s) => ({
            type: s.type,
            content: s.content,
            toolName: s.toolName,
            toolResult: s.toolResult,
          })),
        });
      } catch (err) {
        gateway.sendToClient(clientId, { type: "error", message: (err as Error).message });
      }
      break;
    }

    case "agent_memory": {
      const { sessionId: memSessionId, action, key, value, type: memType } = msg;
      if (!memSessionId) {
        gateway.sendToClient(clientId, { type: "error", message: "sessionId required" });
        return;
      }

      try {
        switch (action) {
          case "remember": {
            const entry = await agent.getMemory().remember(memSessionId, key, value, memType);
            gateway.sendToClient(clientId, { type: "agent_memory_result", action: "remember", entry });
            break;
          }
          case "recall": {
            const entries = await agent.getMemory().recall(memSessionId, key || "");
            gateway.sendToClient(clientId, { type: "agent_memory_result", action: "recall", entries });
            break;
          }
          case "forget": {
            const deleted = await agent.getMemory().forget(memSessionId, key);
            gateway.sendToClient(clientId, { type: "agent_memory_result", action: "forget", deleted });
            break;
          }
          case "list": {
            const entries = await agent.getMemory().list(memSessionId, memType);
            gateway.sendToClient(clientId, { type: "agent_memory_result", action: "list", entries });
            break;
          }
          default:
            gateway.sendToClient(clientId, { type: "error", message: `Unknown memory action: ${action}` });
            break;
        }
      } catch (err) {
        gateway.sendToClient(clientId, { type: "error", message: (err as Error).message });
      }
      break;
    }

    case "rag_index": {
      const { path: ragPath } = msg;
      if (!ragPath) {
        gateway.sendToClient(clientId, { type: "error", message: "path required" });
        return;
      }
      try {
        const result = await retriever.index(ragPath);
        gateway.sendToClient(clientId, { type: "rag_index_result", ...result });
      } catch (err) {
        gateway.sendToClient(clientId, { type: "error", message: (err as Error).message });
      }
      break;
    }

    case "rag_query": {
      const { query, topK, path: filterPath } = msg;
      if (!query) {
        gateway.sendToClient(clientId, { type: "error", message: "query required" });
        return;
      }
      try {
        const results = await retriever.query(query, { topK, path: filterPath });
        gateway.sendToClient(clientId, { type: "rag_query_result", results });
      } catch (err) {
        gateway.sendToClient(clientId, { type: "error", message: (err as Error).message });
      }
      break;
    }

    case "skills_list": {
      const skills = skillRegistry.list().map((s) => ({
        name: s.name,
        description: s.description,
        active: skillRegistry.listActive().some((a) => a.name === s.name),
      }));
      gateway.sendToClient(clientId, { type: "skills_list", skills });
      break;
    }

    case "skills_activate": {
      const { name } = msg;
      const activated = skillRegistry.activate(name);
      gateway.sendToClient(clientId, { type: "skills_result", name, activated });
      break;
    }

    case "skills_deactivate": {
      const { name } = msg;
      const deactivated = skillRegistry.deactivate(name);
      gateway.sendToClient(clientId, { type: "skills_result", name, deactivated });
      break;
    }

    default:
      gateway.sendToClient(clientId, { type: "error", message: `Unknown message type: ${msg.type}` });
      break;
  }
}

async function main(): Promise<void> {
  loadConfig();
  loadSettings();
  loadOrCreateToken();
  const config = getConfig();

  getDatabase();
  console.log(`[DB] SQLite connected: ${config.database.path}`);

  for (const tool of [...fileTools, ...bashTools, ...browserTools]) {
    toolRegistry.register(tool);
  }
  console.log(`[Tools] Registered ${toolRegistry.list().length} builtin tools`);

  const discoveredPlugins = await pluginLoader.discover();
  console.log(`[Plugins] Discovered ${discoveredPlugins.length} plugins`);

  for (const pluginName of discoveredPlugins) {
    const plugin = await pluginLoader.load(pluginName);
    if (plugin) {
      pluginRegistry.register(plugin);
      const tools = await pluginLoader.loadTools(pluginName);
      for (const tool of tools) {
        toolRegistry.register(tool, `plugin:${pluginName}`);
      }
    }
  }

  await pluginRegistry.activateAll();
  console.log(`[Plugins] Active: ${pluginRegistry.list().length}`);

  retriever = new Retriever(process.cwd());
  await retriever.initialize();
  console.log(`[RAG] Vector store initialized`);

  await skillRegistry.discover();
  console.log(`[Skills] Discovered ${skillRegistry.list().length} skills`);

  mcpServer = new MCPServer(toolRegistry);
  console.log(`[MCP] Server initialized with ${toolRegistry.listEnabled().length} tools`);

  const toolDefs = toolRegistry.toFunctionDefinitions()
    .map((t) => {
      const params = Object.entries(t.parameters)
        .map(([k, v]: [string, any]) => `    "${k}": ${v.description || ""}${v.required ? " (required)" : ""}`)
        .join("\n");
      return `- ${t.name}: ${t.description}\n  Parameters:\n${params}`;
    })
    .join("\n\n");

  agent = new Agent(llm, toolRegistry, {
    systemPrompt: `You are Altron, an AI assistant with access to tools. You can read/write files, execute commands, search the web, and more.

Available tools:
${toolDefs}

When you need to use a tool, respond with a JSON block:
\`\`\`json
{"name": "tool_name", "params": {"param1": "value1"}}
\`\`\`

After receiving tool results, continue reasoning and either use another tool or provide your final answer.

Always explain your reasoning before taking actions.`,
  });
  console.log(`[Agent] Initialized with ${toolRegistry.listEnabled().length} available tools`);

  const app = express();
  setupRoutes(app);

  let gateway: Gateway;
  gateway = new Gateway(
    { app, host: config.server.host, port: config.server.port },
    (clientId, msg) => handleWSMessage(clientId, msg, gateway)
  );

  process.on("unhandledRejection", (err) => {
    console.error("[Altchron] Unhandled rejection:", err);
  });

  await gateway.listen(config.server.port, config.server.host);

  const authInfo = getAuthInfo(config.server.port);
  console.log(`
╔══════════════════════════════════════════════════╗
║             АЛЬТРОН v0.1.0                       ║
║   AI Gateway • WebSocket • HTTP API • Tools      ║
╠══════════════════════════════════════════════════╣
║  HTTP:    http://${config.server.host}:${config.server.port}             ║
║  WS:      ws://${config.server.host}:${config.server.port}/ws           ║
║  DB:      ${config.database.path.padEnd(37)}║
║  Tools:   ${String(toolRegistry.list().length).padEnd(37)}║
║  Plugins: ${String(pluginRegistry.list().length).padEnd(37)}║
║  Auth:    ${authInfo.token.slice(0, 8)}...${authInfo.token.slice(-4).padEnd(29)}║
╚══════════════════════════════════════════════════╝
  `);

  await printQRToConsole(authInfo.connectUrl);

  process.on("SIGINT", async () => {
    console.log("\n[Altchron] Shutting down...");
    await pluginRegistry.deactivateAll();
    closeDatabase();
    await gateway.close();
    process.exit(0);
  });
}

main().catch(console.error);
