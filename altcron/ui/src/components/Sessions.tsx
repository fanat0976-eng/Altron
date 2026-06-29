import { useState, useEffect } from "react";
import { api, type Session } from "../lib/api";

interface SessionsProps {
  activeSessionId: string | null;
  onSelect: (id: string | null) => void;
}

export function Sessions({ activeSessionId, onSelect }: SessionsProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const loadSessions = async () => {
    try {
      const list = await api.sessions.list();
      setSessions(list);
    } catch (e) {
      console.error("[Sessions] Failed to load:", e);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const createSession = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const session = await api.sessions.create(newName.trim());
      setNewName("");
      await loadSessions();
      onSelect(session.id);
    } catch (e) {
      console.error("[Sessions] Failed to create:", e);
    }
    setCreating(false);
  };

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Удалить сессию?")) return;
    try {
      await api.sessions.delete(id);
      if (activeSessionId === id) onSelect(null as any);
      await loadSessions();
    } catch (e) {
      console.error("[Sessions] Failed to delete:", e);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 3600000) return `${Math.floor(diff / 60000)}м назад`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}ч назад`;
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  };

  return (
    <div className="sessions">
      <div className="sessions-header">
        <h3>Сессии</h3>
      </div>

      <div className="sessions-new">
        <input
          className="sessions-new-input"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Название сессии..."
          onKeyDown={(e) => e.key === "Enter" && createSession()}
          disabled={creating}
        />
        <button className="sessions-new-btn" onClick={createSession} disabled={creating}>
          +
        </button>
      </div>

      <div className="sessions-list">
        {sessions.length === 0 && (
          <div className="sessions-empty">Нет сессий</div>
        )}
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`sessions-item ${s.id === activeSessionId ? "sessions-item--active" : ""}`}
            onClick={() => onSelect(s.id)}
          >
            <div className="sessions-item-info">
              <div className="sessions-item-name">{s.name}</div>
              <div className="sessions-item-meta">
                <span className="sessions-item-model">{s.model}</span>
                <span className="sessions-item-date">{formatDate(s.updatedAt)}</span>
              </div>
            </div>
            <button
              className="sessions-item-delete"
              onClick={(e) => deleteSession(s.id, e)}
              title="Удалить"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
