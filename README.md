# A.L.T.R.O.N — AI-ассистент нового поколения

> Gateway-архитектура, Plugin SDK, Remote Access, MCP, RAG + Skills

---

## Содержание

1. [Обзор](#обзор)
2. [Быстрый старт](#быстрый-старт)
3. [Установка](#установка)
4. [Docker](#docker)
5. [Архитектура](#архитектура)
6. [Плагины и инструменты](#плагины-и-инструменты)
7. [Агент](#агент)
8. [RAG + Skills](#rag--skills)
9. [MCP](#mcp)
10. [API Reference](#api-reference)
11. [Клиенты](#клиенты)
12. [Конфигурация](#конфигурация)
13. [Тесты](#тесты)
14. [Структура проекта](#структура-проекта)
15. [Roadmap](#roadmap)
16. [Лицензия](#лицензия)

---

## Обзор

**Altron** — AI-ассистент нового поколения с Gateway-архитектурой, вдохновлённый [OpenClaw](https://github.com/openclaw/openclaw) (381k ⭐).

### Ключевые особенности

| Возможность | Описание |
|-------------|----------|
| **Gateway-centric** | Единый сервер управляет всем: сессии, плагины, агенты |
| **Plugin SDK** | Изолированные плагины с контрактами |
| **13 инструментов** | File (7), System (3), Browser (3) |
| **Agent loop** | perceive → think → act (tool calling, memory, planning) |
| **RAG** | Документы → embeddings → семантический поиск |
| **Skills** | SKILL.md файлы для инструкций агенту |
| **MCP** | Model Context Protocol — подключение внешних серверов |
| **Remote Access** | Auth tokens + QR codes для удалённого подключения |
| **Multi-provider** | Ollama, OpenRouter, Gemini, MiMo |
| **Tauri UI** | Cyberpunk dark theme, system tray |
| **Android** | Kotlin + Compose клиент |

---

## Быстрый старт

### 1. Установить зависимости

```bash
cd altcron
npm install
```

### 2. Установить Ollama

```bash
# Установить Ollama: https://ollama.ai
ollama pull qwen2.5:14b
```

### 3. Запустить сервер

```bash
npm run dev
```

Сервер запустится на `http://localhost:3000`

### 4. Открыть UI

```
http://localhost:3000
```

---

## Установка

### Требования

- Node.js 18+
- Ollama (для LLM)
- npm или yarn

### Полная установка

```bash
# Клонировать
git clone https://github.com/fanat0976-eng/Altron.git
cd Altron

# Зависимости
npm install

# Ollama модели
ollama pull qwen2.5:14b

# Запуск
npm run dev
```

### Установка Android клиента

```bash
cd android
./gradlew assembleDebug

# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Docker

### Запуск через Docker Compose

```bash
docker compose up -d

# Проверить
docker compose ps

# Логи
docker compose logs -f

# Остановить
docker compose down
```

### Dockerfile

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

## Архитектура

```
┌─────────────────────────────────────────────────┐
│              GATEWAY SERVER (Node.js)            │
│              (src/gateway/index.ts)              │
├─────────────────────────────────────────────────┤
│  Sessions │ Streaming │ Auth │ WebSocket         │
├─────────────────────────────────────────────────┤
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  PLUGINS │  │  AGENT   │  │   RAG    │       │
│  │ SDK      │  │ loop     │  │ embeds   │       │
│  │ 13 tools │  │ memory   │  │ search   │       │
│  │ policies │  │ planning │  │ vector   │       │
│  └──────────┘  └──────────┘  └──────────┘       │
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  SKILLS  │  │   MCP    │  │  CONFIG  │       │
│  │ SKILL.md │  │ server   │  │ YAML     │       │
│  │ builtin  │  │ client   │  │ .env     │       │
│  └──────────┘  └──────────┘  └──────────┘       │
│                                                   │
│  ┌──────────────────────────────────────┐        │
│  │          REMOTE ACCESS               │        │
│  │   Auth tokens │ QR codes │ Android   │        │
│  └──────────────────────────────────────┘        │
└─────────────────────────────────────────────────┘
         │                    │
    WebSocket              HTTP/RPC
         │                    │
┌────────┴───────┐  ┌────────┴──────┐
│   Tauri UI     │  │ Android       │
│   React+Vite   │  │ Kotlin+Compose│
└────────────────┘  └───────────────┘
```

---

## Плагины и инструменты

### File Tools (7)

| Инструмент | Описание |
|------------|----------|
| `read` | Чтение файла |
| `write` | Запись в файл |
| `edit` | Редактирование файла |
| `list` | Список файлов |
| `delete` | Удаление файла |
| `move` | Перемещение файла |
| `info` | Информация о файле |

### System Tools (3)

| Инструмент | Описание |
|------------|----------|
| `bash` | Выполнение команд |
| `process_list` | Список процессов |
| `env` | Переменные окружения |

### Browser Tools (3)

| Инструмент | Описание |
|------------|----------|
| `open_url` | Открытие URL |
| `fetch_url` | Получение контента URL |
| `web_search` | Поиск в интернете |

### Tool Policies

Каждый инструмент имеет политику доступа:
- `allow` — разрешено без вопросов
- `ask` — требует подтверждения
- `deny` — запрещено

---

## Агент

### Agent Loop

```
perceive → think → act → observe → repeat
```

Максимум 10 итераций за запрос.

### Tool Calling

LLM вызывает инструменты через JSON блоки:

```json
{
  "tool": "bash",
  "args": { "command": "ls -la" }
}
```

### Memory

- **Краткосрочная**: in-memory (текущая сессия)
- **Долгосрочная**: SQLite (между сессиями)

### Planning

Multi-step планирование с зависимостями между задачами.

---

## RAG + Skills

### RAG Pipeline

```
Документ → Loader → Embedder (Ollama) → VectorStore (SQLite) → Retriever
```

### Document Loader

Поддерживаемые форматы: TXT, MD, JSON, CSV, TS, JS, PY, RS, YAML

### Skills

SKILL.md файлы с инструкциями для агента:

```
skills/
├── coding-agent/
│   └── SKILL.md
├── file-manager/
│   └── SKILL.md
└── web-research/
    └── SKILL.md
```

---

## MCP

### Model Context Protocol

Altron подключается к внешним MCP-серверам как клиент:

```yaml
mcp:
  servers:
    - name: filesystem
      command: npx
      args: ["-y", "@modelcontextprotocol/server-filesystem"]
```

### MCP Server

Altron выставляет свои инструменты через MCP:

```bash
curl http://localhost:3000/api/mcp/tools
```

---

## API Reference

### Gateway

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/api/health` | Проверка здоровья |
| `GET` | `/api/sessions` | Список сессий |
| `POST` | `/api/chat` | Отправить сообщение |
| `WS` | `/ws` | WebSocket для streaming |

### Tools

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/api/tools` | Список инструментов |
| `POST` | `/api/tools/call` | Вызов инструмента |

### RAG

| Метод | Путь | Описание |
|-------|------|----------|
| `POST` | `/api/rag/search` | Поиск по документам |
| `POST` | `/api/rag/index` | Индексация документа |

### Skills

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/api/skills` | Список скиллов |
| `POST` | `/api/skills/activate` | Активировать скилл |

### Auth

| Метод | Путь | Описание |
|-------|------|----------|
| `POST` | `/api/auth/token` | Получить токен |
| `GET` | `/api/auth/qr` | QR код для подключения |

---

## Клиенты

### Web UI (Tauri)

- React + Vite + TypeScript
- Dark cyberpunk theme
- System tray (сворачивается в трей)
- WebSocket streaming

### Android

- Kotlin + Jetpack Compose
- Material Design 3
- Remote access через QR код
- Debug APK: `Altron-v0.1.0-debug.apk` (16MB)

---

## Конфигурация

### config.yaml

```yaml
server:
  host: "0.0.0.0"
  port: 3000

llm:
  provider: "ollama"
  model: "qwen2.5:14b"
  base_url: "http://localhost:11434"

rag:
  enabled: true
  embedder: "ollama"

skills:
  enabled: true
  directory: "./skills"

mcp:
  enabled: true
```

### .env

```env
OPENROUTER_API_KEY=your_key
GEMINI_API_KEY=your_key
```

---

## Тесты

```bash
# Все тесты (159/159)
npm test

# Только unit тесты
npm run test:unit

# Интеграционные
npm run test:integration
```

### Покрытие

| Модуль | Тестов |
|--------|--------|
| ToolRegistry | 14 |
| Agent | 10 |
| MCP | 8 |
| Context | 11 |
| Planner | 16 |
| Sessions | 12 |
| Settings | 6 |
| LLM Fallback | 9 |
| Auth | 11 |
| **Итого** | **159** |

---

## Структура проекта

```
Altron/
├── altcron/                # Серверная часть
│   └── src/
│       ├── gateway/        # Gateway server
│       ├── agent/          # Agent loop, tool calling
│       ├── tools/          # 13 builtin tools
│       ├── plugins/        # Plugin SDK + loader
│       ├── rag/            # RAG pipeline
│       ├── skills/         # Skill system
│       ├── mcp/            # MCP server/client
│       ├── auth/           # Auth + QR codes
│       ├── sessions/       # Session manager
│       ├── config/         # Configuration
│       └── llm/            # LLM client (Ollama, OpenRouter)
├── altcron/web/            # React + Vite UI
├── android/                # Kotlin + Compose клиент
├── tests/                  # 159 тестов
├── ROADMAP.md              # Дорожная карта
├── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## Roadmap

| Фаза | Статус | Описание |
|------|--------|----------|
| Phase 1: Ядро | ✅ | Gateway, Sessions, LLM, SQLite, WebSocket |
| Phase 2: Плагины | ✅ | Plugin SDK, 13 tools, policies |
| Phase 3: Агент | ✅ | Agent loop, memory, planning |
| Phase 4: UI | ✅ | React + Tauri, cyberpunk theme |
| Phase 5: RAG + Skills | ✅ | Document loader, embedder, vector store |
| Phase 6: MCP + Deploy | ✅ | MCP server/client, Docker |
| Android клиент | ✅ | Kotlin + Compose, remote access |
| Remote Access | ✅ | Auth tokens, QR codes |

---

## Вдохновение

- [OpenClaw](https://github.com/openclaw/openclaw) — 381k ⭐, Gateway-архитектура
- [Jarvis V3.1](https://github.com/fanat0976-eng/JarvisV3.1) — Brain, Memory, RAG, Agents

---

## Лицензия

MIT License

---

## Контакты

- GitHub Issues: для багов и фич
