import { useState, useEffect } from "react";
import { api } from "../lib/api";

interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
}

export function ToolsPanel() {
  const [tools, setTools] = useState<ToolDef[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    api.tools.list().then(setTools).catch(() => {});
  }, []);

  const copyCommand = (tool: ToolDef) => {
    const example: Record<string, any> = {};
    for (const [k, v] of Object.entries(tool.parameters)) {
      example[k] = v.type === "string" ? `<${k}>` : v.type === "number" ? 0 : true;
    }
    const cmd = JSON.stringify({ name: tool.name, params: example }, null, 2);
    navigator.clipboard.writeText(cmd).then(() => {
      setCopied(tool.name);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const copyPrompt = (tool: ToolDef) => {
    const example: Record<string, any> = {};
    for (const [k, v] of Object.entries(tool.parameters)) {
      example[k] = v.type === "string" ? `<${k}>` : v.type === "number" ? 0 : true;
    }
    const prompt = `\`\`\`json\n${JSON.stringify({ name: tool.name, params: example }, null, 2)}\n\`\`\``;
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(tool.name);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  return (
    <div className="tools-panel">
      <div className="tools-panel-header">
        <h3>Инструменты</h3>
        <span className="tools-panel-count">{tools.length}</span>
      </div>

      <div className="tools-panel-list">
        {tools.map((tool) => (
          <div
            key={tool.name}
            className={`tools-panel-item ${expanded === tool.name ? "tools-panel-item--open" : ""}`}
          >
            <div
              className="tools-panel-item-header"
              onClick={() => setExpanded(expanded === tool.name ? null : tool.name)}
            >
              <span className="tools-panel-item-icon">⚙</span>
              <span className="tools-panel-item-name">{tool.name}</span>
              <span className="tools-panel-item-arrow">{expanded === tool.name ? "▼" : "▶"}</span>
            </div>

            {expanded === tool.name && (
              <div className="tools-panel-item-body">
                <p className="tools-panel-item-desc">{tool.description}</p>

                {Object.keys(tool.parameters).length > 0 && (
                  <div className="tools-panel-item-params">
                    <span className="tools-panel-item-params-title">Параметры:</span>
                    {Object.entries(tool.parameters).map(([k, v]) => (
                      <div key={k} className="tools-panel-item-param">
                        <span className="tools-panel-item-param-name">{k}</span>
                        {v.required && <span className="tools-panel-item-param-req">*</span>}
                        <span className="tools-panel-item-param-type">{v.type}</span>
                        <span className="tools-panel-item-param-desc">{v.description}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="tools-panel-item-actions">
                  <button className="tools-panel-btn" onClick={() => copyCommand(tool)}>
                    {copied === tool.name ? "✓ Скопировано" : "📋 Копировать JSON"}
                  </button>
                  <button className="tools-panel-btn tools-panel-btn--secondary" onClick={() => copyPrompt(tool)}>
                    💬 Копировать промпт
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
