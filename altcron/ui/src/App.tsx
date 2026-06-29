import { useState, useEffect } from "react";
import { Chat } from "./components/Chat";
import { Sessions } from "./components/Sessions";
import { Settings } from "./components/Settings";
import { ToolsPanel } from "./components/ToolsPanel";
import { wsClient } from "./lib/ws";
import "./styles/app.css";

function App() {
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    wsClient.connect();

    const unsub = wsClient.onMessage((msg) => {
      if (msg.type === "connected") setConnected(true);
    });

    const checkConnection = setInterval(() => {
      setConnected(wsClient.connected);
    }, 2000);

    return () => {
      unsub();
      clearInterval(checkConnection);
      wsClient.disconnect();
    };
  }, []);

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-icon">⚡</span>
            <span className="logo-text">Альтрон</span>
          </div>
          <button
            className="settings-btn"
            onClick={() => setShowSettings(true)}
            title="Настройки"
          >
            ⚙
          </button>
        </div>

        <div className="sidebar-status">
          <span className={`status-dot ${connected ? "status-dot--ok" : "status-dot--err"}`} />
          <span>{connected ? "Подключён" : "Отключён"}</span>
        </div>

        <Sessions activeSessionId={activeSession} onSelect={setActiveSession} />
      </div>

      <div className="main">
        <Chat sessionId={activeSession} />
      </div>

      <ToolsPanel />

      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  );
}

export default App;
