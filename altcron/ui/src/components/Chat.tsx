import { useState, useEffect, useRef } from "react";
import { wsClient, type WSMessage } from "../lib/ws";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolName?: string;
  timestamp: Date;
  streaming?: boolean;
}

interface ChatProps {
  sessionId: string | null;
}

export function Chat({ sessionId }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [agentMode, setAgentMode] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!sessionId) return;

    fetch(`http://localhost:3000/api/sessions/${sessionId}/messages`)
      .then((r) => r.json())
      .then((msgs: any[]) => {
        setMessages(
          msgs.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: new Date(m.createdAt),
          }))
        );
      })
      .catch((e) => { console.error("[Chat] Failed to load messages:", e); });
  }, [sessionId]);

  useEffect(() => {
    const unsub = wsClient.onMessage((msg: WSMessage) => {
      switch (msg.type) {
        case "stream_start":
          setIsStreaming(true);
          setMessages((prev) => [
            ...prev,
            {
              id: `stream-${Date.now()}`,
              role: "assistant",
              content: "",
              streaming: true,
              timestamp: new Date(),
            },
          ]);
          break;

        case "stream_chunk":
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.streaming) {
              return [
                ...prev.slice(0, -1),
                { ...last, content: last.content + msg.content },
              ];
            }
            return prev;
          });
          break;

        case "stream_end":
          setIsStreaming(false);
          setMessages((prev) =>
            prev.map((m) => (m.streaming ? { ...m, streaming: false } : m))
          );
          break;

        case "agent_start":
          setIsStreaming(true);
          setMessages((prev) => [
            ...prev,
            {
              id: `agent-${Date.now()}`,
              role: "system",
              content: "Агент обрабатывает запрос...",
              timestamp: new Date(),
            },
          ]);
          break;

        case "agent_result":
          setIsStreaming(false);
          setMessages((prev) => {
            const filtered = prev.filter(
              (m) => m.role !== "system" || !m.content.includes("Агент обрабатывает")
            );
            return [
              ...filtered,
              {
                id: `result-${Date.now()}`,
                role: "assistant",
                content: msg.response,
                timestamp: new Date(),
              },
            ];
          });
          break;

        case "error":
          setIsStreaming(false);
          setMessages((prev) => [
            ...prev,
            {
              id: `error-${Date.now()}`,
              role: "system",
              content: `Ошибка: ${msg.message}`,
              timestamp: new Date(),
            },
          ]);
          break;
      }
    });
    return unsub;
  }, []);

  const sendMessage = () => {
    if (!input.trim() || isStreaming || !sessionId) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    const content = input.trim();
    setInput("");

    if (agentMode) {
      wsClient.send({
        type: "agent_chat",
        sessionId,
        content,
      });
    } else {
      wsClient.send({
        type: "chat",
        sessionId,
        content,
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  if (!sessionId) {
    return (
      <div className="chat-empty">
        <div className="chat-empty-icon">⚡</div>
        <h2>Альтрон</h2>
        <p>AI Gateway нового поколения</p>
        <p className="chat-empty-sub">Создайте сессию для начала работы</p>
      </div>
    );
  }

  return (
    <div className="chat">
      <div className="chat-header">
        <span className="chat-status-dot" />
        <span>Сессия: {sessionId.slice(0, 8)}...</span>
        <label className="chat-agent-toggle">
          <input
            type="checkbox"
            checked={agentMode}
            onChange={(e) => setAgentMode(e.target.checked)}
          />
          <span>Agent</span>
        </label>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-welcome">
            <p>Начните диалог с Альтроном</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-msg chat-msg--${msg.role}`}>
            <div className="chat-msg-role">
              {msg.role === "user" ? "Вы" : msg.role === "assistant" ? "Альтрон" : msg.role === "tool" ? msg.toolName || "Tool" : "Система"}
            </div>
            <div className="chat-msg-content">
              {msg.content}
              {msg.streaming && <span className="chat-cursor">|</span>}
            </div>
            <div className="chat-msg-time">{formatTime(msg.timestamp)}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <textarea
          ref={inputRef}
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isStreaming ? "Альтрон отвечает..." : "Введите сообщение..."}
          disabled={isStreaming}
          rows={1}
        />
        <button
          className="chat-send"
          onClick={sendMessage}
          disabled={isStreaming || !input.trim()}
        >
          {isStreaming ? "⏳" : "→"}
        </button>
      </div>
    </div>
  );
}
