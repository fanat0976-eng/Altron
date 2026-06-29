# Альтрон (Altchron)

AI-ассистент нового поколения с Gateway-архитектурой.

## Стек

- **Backend**: TypeScript + Node.js + Express
- **Frontend**: React + Vite + Tauri (Web + Desktop)
- **БД**: SQLite (Kysely)
- **LLM**: Ollama + OpenRouter + Gemini (умный fallback)
- **WebSocket**: Streaming ответов

## Быстрый старт

```bash
# Backend
npm install
npm run dev

# Frontend (Web) — отдельный терминал
cd ui
npm install
npm run dev

# Frontend (Desktop) — отдельный терминал
cd ui
npm run tauri:dev
```

## API

### HTTP Endpoints

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/health` | Проверка здоровья |
| GET | `/api/sessions` | Список сессий |
| POST | `/api/sessions` | Создать сессию |
| GET | `/api/sessions/:id` | Получить сессию |
| DELETE | `/api/sessions/:id` | Удалить сессию |
| GET | `/api/sessions/:id/messages` | Сообщения сессии |
| GET | `/api/models` | Список моделей Ollama |
| GET | `/api/tools` | Список инструментов |
| POST | `/api/tools/:name/call` | Вызвать инструмент |
| GET | `/api/plugins` | Список плагинов |
| POST | `/api/agent/chat` | Чат с агентом |
| POST | `/api/agent/plan` | Планирование задач |

### WebSocket

Подключение: `ws://localhost:3000/ws`

**Отправка сообщения:**
```json
{
  "type": "chat",
  "sessionId": "...",
  "content": "Привет!"
}
```

**Получение стриминга:**
```json
{
  "type": "stream_chunk",
  "content": "Привет",
  "done": false,
  "provider": "ollama",
  "model": "qwen2.5:14b"
}
```

## Конфигурация

`config.yaml` — основной конфиг.

`.env` — переменные окружения (API ключи).

## Структура

```
altcron/
├── src/
│   ├── gateway/        # HTTP/WS сервер
│   ├── sessions/       # Менеджер сессий
│   ├── llm/            # LLM абстракция
│   ├── agents/         # AI агент
│   ├── tools/          # Система инструментов
│   ├── plugins/        # Plugin SDK
│   ├── extensions/     # Встроенные плагины
│   └── config/         # Конфигурация
├── ui/                 # React + Tauri (Web + Desktop)
│   ├── src/
│   │   ├── components/ # Chat, Sessions, Settings
│   │   ├── lib/        # WebSocket, API
│   │   └── styles/     # CSS (dark theme)
│   ├── src-tauri/      # Tauri Rust backend
│   │   ├── src/lib.rs  # System tray, window management
│   │   ├── tauri.conf.json
│   │   └── icons/      # App icons
│   └── package.json
├── data/               # SQLite база данных
├── config.yaml         # Конфигурация сервера
└── package.json
```

## LLM Провайдеры

| Провайдер | Тип | Статус |
|-----------|-----|--------|
| Ollama | Офлайн | ✅ Работает |
| OpenRouter | Онлайн | ⚙️ Нужен API ключ |
| Gemini | Онлайн | ⚙️ Нужен API ключ |

**Fallback**: Ollama → OpenRouter → Gemini

## Инструменты

- **File**: read, write, edit, list, delete, move, info
- **System**: bash, process list, env
- **Browser**: open URL, fetch URL, web search

## Плагины

- `file-tool` — файловые операции
- `system-tool` — системные команды
- `browser-tool` — веб-операции

## Tauri Desktop

- Нативное окно (1200x800, resizable)
- System tray: при закрытии окно скрывается в трей
- Клик по иконке в трее восстанавливает окно
- Доступ к файловой системе через Tauri API

## Технические детали

- TypeScript strict mode
- ESM модули
- SQLite WAL mode
- WebSocket streaming
- Zod для валидации конфига
- Tauri v1 (Rust + WebView)
- System tray (скрытие в трей при закрытии)

---

*Создано: 2026-06-28*
