import { useState, useEffect } from "react";
import { api } from "../lib/api";

interface SettingsProps {
  onClose: () => void;
}

interface ServerHealth {
  status: string;
  version: string;
  uptime: number;
}

interface AppSettings {
  providers: {
    ollama: { baseUrl: string; defaultModel: string };
    openrouter: { apiKey: string; baseUrl: string; defaultModel: string };
    gemini: { apiKey: string; model: string };
  };
  defaultProvider: string;
  fallback: string[];
}

interface ProviderInfo {
  id: string;
  name: string;
  hasApiKey: boolean;
  configured: boolean;
}

export function Settings({ onClose }: SettingsProps) {
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [tab, setTab] = useState<"general" | "providers" | "tools" | "plugins">("general");
  const [saved, setSaved] = useState(false);
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [defaultProvider, setDefaultProvider] = useState("ollama");

  useEffect(() => {
    api.health().then(setHealth).catch(() => {});
    api.settings.get().then((s) => {
      setSettings(s);
      setOpenrouterKey(s.providers.openrouter.apiKey);
      setGeminiKey(s.providers.gemini.apiKey);
      setDefaultProvider(s.defaultProvider);
    }).catch(() => {});
    api.settings.providers().then(setProviders).catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    const updated: AppSettings = {
      ...settings,
      defaultProvider,
      providers: {
        ...settings.providers,
        openrouter: { ...settings.providers.openrouter, apiKey: openrouterKey },
        gemini: { ...settings.providers.gemini, apiKey: geminiKey },
      },
    };
    await api.settings.update(updated);
    setSettings(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}ч ${m}м`;
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Настройки</h2>
          <button className="settings-close" onClick={onClose}>×</button>
        </div>

        <div className="settings-tabs">
          {(["general", "providers", "tools", "plugins"] as const).map((t) => (
            <button
              key={t}
              className={`settings-tab ${tab === t ? "settings-tab--active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "general" ? "Общие" : t === "providers" ? "Провайдеры" : t === "tools" ? "Инструменты" : "Плагины"}
            </button>
          ))}
        </div>

        <div className="settings-content">
          {tab === "general" && (
            <div className="settings-section">
              <h3>Сервер</h3>
              {health ? (
                <div className="settings-info">
                  <div className="settings-info-row">
                    <span>Статус</span>
                    <span className="settings-status-ok">{health.status}</span>
                  </div>
                  <div className="settings-info-row">
                    <span>Версия</span>
                    <span>{health.version}</span>
                  </div>
                  <div className="settings-info-row">
                    <span>Аптайм</span>
                    <span>{formatUptime(health.uptime)}</span>
                  </div>
                </div>
              ) : (
                <div className="settings-loading">Загрузка...</div>
              )}
            </div>
          )}

          {tab === "providers" && (
            <div className="settings-section">
              <h3>API Провайдеры</h3>

              <div className="settings-provider">
                <div className="settings-provider-header">
                  <span className={`settings-provider-dot ${defaultProvider === "ollama" ? "on" : ""}`} />
                  <span className="settings-provider-name">Ollama (Local)</span>
                  <span className="settings-provider-badge ok">Всегда доступен</span>
                </div>
                <div className="settings-provider-desc">Локальный LLM сервер. Работает без API ключа.</div>
              </div>

              <div className="settings-provider">
                <div className="settings-provider-header">
                  <span className={`settings-provider-dot ${openrouterKey ? "on" : ""}`} />
                  <span className="settings-provider-name">OpenRouter (Cloud)</span>
                  {openrouterKey ? <span className="settings-provider-badge ok">Настроен</span> : <span className="settings-provider-badge">Требует ключ</span>}
                </div>
                <div className="settings-provider-desc">22+ моделей (Claude, GPT-4, Llama). Есть бесплатные модели.</div>
                <input
                  type="password"
                  className="settings-input"
                  placeholder="sk-or-v1-..."
                  value={openrouterKey}
                  onChange={(e) => setOpenrouterKey(e.target.value)}
                />
                <div className="settings-provider-hint">Получить ключ: <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">openrouter.ai/keys</a></div>
              </div>

              <div className="settings-provider">
                <div className="settings-provider-header">
                  <span className={`settings-provider-dot ${geminiKey ? "on" : ""}`} />
                  <span className="settings-provider-name">Gemini (Google)</span>
                  {geminiKey ? <span className="settings-provider-badge ok">Настроен</span> : <span className="settings-provider-badge">Требует ключ</span>}
                </div>
                <div className="settings-provider-desc">Google Gemini. Длинный контекст.</div>
                <input
                  type="password"
                  className="settings-input"
                  placeholder="AIza..."
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                />
                <div className="settings-provider-hint">Получить ключ: <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a></div>
              </div>

              <div className="settings-provider">
                <div className="settings-provider-header">
                  <span className="settings-provider-name">Провайдер по умолчанию</span>
                </div>
                <select
                  className="settings-select"
                  value={defaultProvider}
                  onChange={(e) => setDefaultProvider(e.target.value)}
                >
                  <option value="ollama">Ollama (Local)</option>
                  <option value="openrouter" disabled={!openrouterKey}>OpenRouter</option>
                  <option value="gemini" disabled={!geminiKey}>Gemini</option>
                </select>
              </div>

              <button className="settings-save-btn" onClick={handleSave}>
                {saved ? "✓ Сохранено" : "Сохранить"}
              </button>
            </div>
          )}

          {tab === "tools" && (
            <div className="settings-section">
              <h3>Инструменты</h3>
              <div className="settings-loading">Загружается...</div>
            </div>
          )}

          {tab === "plugins" && (
            <div className="settings-section">
              <h3>Плагины</h3>
              <div className="settings-loading">Загружается...</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
