# Альтрон — Дорожная карта

> AI-ассистент нового поколения. Inspiration: OpenClaw (381k ⭐)

## Стек

| Компонент | Технология |
|-----------|------------|
| Backend | TypeScript + Node.js |
| API | Gateway (WebSocket + HTTP) |
| UI | Tauri (Rust + React/Vue) |
| LLM | Ollama + MiMo + OpenRouter + Gemini (умный fallback) |
| БД | SQLite (Kysely) |
| Плагины | npm packages |
| Скиллы | Markdown (SKILL.md) |
| MCP | Model Context Protocol |
| Деплой | Гибрид (локальный + cloud) |

---

## LLM провайдеры

| Провайдер | Тип | Модели |
|-----------|-----|--------|
| **Ollama** | Офлайн | qwen2.5:14b, gpt-oss:20b, gemma-4-12B-coder |
| **MiMo** | Онлайн | MiMoCode API (coding, быстрые ответы) |
| **OpenRouter** | Онлайн | Claude, GPT-4, Llama (22+ моделей) |
| **Gemini** | Онлайн | Google Gemini (длинный контекст) |

**Умный fallback**: Ollama → MiMo → OpenRouter → Gemini

**Локальные модели (уже скачаны):**
- `qwen2.5:14b` — основная (9 GB, tools)
- `gpt-oss:20b` — продвинутая (13 GB, tools+thinking)
- `gemma-4-12B-coder` — код (7.4 GB)
- `qwen2.5:7b` — быстрая (4.7 GB)
- `nomic-embed-text` — embeddings (274 MB)

---

## Архитектура

```
┌─────────────────────────────────────┐
│         Tauri (Rust + Web)          │
│      UI Dashboard + Controls        │
└──────────────┬──────────────────────┘
               │ WebSocket
┌──────────────▼──────────────────────┐
│         GATEWAY SERVER              │
│      (TypeScript + Node.js)         │
│                                     │
│  Sessions │ Routing │ Auth          │
│  Agents   │ Tools   │ MCP           │
│  Plugins  │ Memory  │ Skills        │
│  Channels │ Cron    │ State         │
└──────┬────────────────┬─────────────┘
       │                │
    SQLite          LLM APIs
                    (Ollama, OpenRouter, Gemini)
```

---

## Фазы разработки

### Фаза 1: Ядро (День 1-2)

**Цель**: Рабочий Gateway с WebSocket

- [ ] **Project setup**: TypeScript + Node.js + package.json
- [ ] **Gateway core**: HTTP + WebSocket сервер
- [ ] **Session manager**: создание, хранение, переключение сессий
- [ ] **State storage**: SQLite через Kysely
- [ ] **LLM client**: Ollama + OpenRouter + auto-fallback
- [ ] **Streaming**: SSE/WS для потоковых ответов
- [ ] **Config**: YAML/JSON конфигурация

**Директории**:
```
altcron/
├── src/
│   ├── gateway/        # HTTP/WS сервер
│   ├── sessions/       # Менеджер сессий
│   ├── llm/            # LLM абстракция
│   ├── state/          # SQLite + Kysely
│   └── config/         # Конфигурация
├── package.json
└── tsconfig.json
```

---

### Фаза 2: Плагины и инструменты (День 3-4)

**Цель**: Plugin SDK + базовые инструменты

- [ ] **Plugin SDK**: контракты для плагинов
- [ ] **Plugin loader**: обнаружение и загрузка плагинов
- [ ] **Tool system**: регистрация, вызов, policies
- [ ] **Builtin tools**: read, write, edit, bash, process
- [ ] **File tool**: чтение/запись файлов
- [ ] **Browser tool**: открытие URL, поиск
- [ ] **System info**: OS, CPU, RAM, disk

**Директории**:
```
src/
├── plugins/
│   ├── sdk/            # Plugin SDK (контракты)
│   ├── loader/         # Загрузчик плагинов
│   └── registry/       # Реестр плагинов
├── tools/
│   ├── builtin/        # Встроенные инструменты
│   ├── registry/       # Реестр инструментов
│   └── policy/         # Разрешения
└── extensions/         # Плагины
    ├── file-tool/
    ├── browser-tool/
    └── system-tool/
```

---

### Фаза 3: Агент (День 5-6)

**Цель**: AI-агент с планированием

- [ ] **Agent core**: цикл восприятия → мышление → действие
- [ ] **Tool calling**: LLM вызывает инструменты
- [ ] **Multi-step planning**: планировщик задач
- [ ] **Memory**: краткосрочная + долгосрочная память
- [ ] **Context window**: управление контекстом
- [ ] **Error recovery**: обработка ошибок в инструментах

**Директории**:
```
src/
├── agents/
│   ├── core/           # Agent loop
│   ├── planning/       # Планировщик
│   ├── memory/         # Память агента
│   ├── context/        # Управление контекстом
│   └── tools/          # Интеграция с tool system
└── skills/
    ├── coding-agent/
    ├── file-manager/
    └── web-research/
```

---

### Фаза 4: UI (День 7)

**Цель**: Tauri интерфейс

- [x] **Project setup**: React + Vite + TypeScript
- [x] **WebSocket client**: подключение к Gateway
- [x] **Chat UI**: ввод сообщений, streaming ответов
- [x] **Session panel**: создание, переключение, удаление сессий
- [x] **Settings**: информация о сервере, моделях, инструментах, плагинах
- [x] **Dark theme**: cyberpunk стиль
- [x] **Tauri**: Rust backend + System tray (скрытие в трей при закрытии)

**Директории**:
```
ui/
├── src/
│   ├── components/    # Chat, Settings, Sessions
│   ├── lib/           # WebSocket client, API
│   ├── styles/        # CSS (dark theme)
│   ├── App.tsx        # Main app
│   └── main.tsx       # Entry point
├── src-tauri/         # Tauri Rust backend
│   ├── src/lib.rs     # System tray, window management
│   ├── tauri.conf.json
│   ├── Cargo.toml
│   └── icons/         # App icons (PNG, ICO, ICNS)
├── index.html
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

### Фаза 5: RAG + Skills (День 8-9)

**Цель**: Память и декларативные скиллы

- [x] **RAG pipeline**: индексация → embedding → поиск
- [x] **Document loader**: TXT, MD, JSON, CSV, TS, JS, PY, RS, YAML
- [x] **Vector store**: SQLite + cosine similarity
- [x] **Embedder**: Ollama nomic-embed-text
- [x] **Retriever**: контекстный поиск с фильтрацией
- [x] **Skill system**: SKILL.md загрузка и инжект
- [x] **Skill registry**: activate/deactivate скиллов
- [x] **Builtin skills**: coding-agent, file-manager, web-research
- [x] **API endpoints**: RAG и Skills REST + WebSocket
- [x] **Config**: rag и skills секции в config.yaml

**Директории**:
```
src/
├── rag/
│   ├── loader/        # Загрузчики документов
│   ├── embedder/      # Ollama embeddings
│   ├── store/         # Векторное хранилище
│   └── retriever/     # Поиск
├── skills/
│   ├── loader/        # Загрузчик SKILL.md
│   ├── registry/      # Реестр скиллов
│   └── builtin/       # Встроенные скиллы
```

---

### Фаза 6: MCP + Деплой (День 10)

**Цель**: MCP интеграция + релиз

- [x] **MCP server**: экспорт инструментов (stdio + HTTP)
- [x] **MCP client**: подключение внешних серверов
- [x] **API endpoints**: /api/mcp/tools, /api/mcp/call
- [x] **Docker**: Dockerfile + docker-compose.yml
- [x] **Installer**: scripts/install.ps1 + start.bat
- [x] **Docs**: README обновлён

---

## Ключевые паттерны (из OpenClaw)

### 1. Gateway-centric
Gateway — единственный процесс, управляет всем. UI и плагины подключаются через него.

### 2. Plugin SDK boundary
Плагины ТОЛЬКО через SDK, никогда в core. Чистая изоляция.

### 3. SKILL.md декларативно
Скиллы — это markdown файлы с инструкциями. Просто, расширяемо, понятно.

### 4. SQLite-only
Всё состояние в SQLite. Нет JSON/JSONL файлов.

### 5. Agent isolation
Каждый агент — изолированный контекст со своей БД и сессиями.

### 6. Tool policies
Настраиваемые разрешения на инструменты. Безопасность через изоляцию.

---

## Сравнение с OpenClaw

| Компонент | OpenClaw | Альтрон |
|-----------|----------|---------|
| Язык | TypeScript | TypeScript |
| Runtime | Node 24 | Node.js |
| UI | Web (Vite) | Tauri (Rust + Web) |
| LLM | Multi-provider | Ollama + MiMo + OpenRouter + Gemini |
| БД | SQLite + Kysely | SQLite + Kysely |
| Плагины | npm packages | npm packages |
| Скиллы | SKILL.md | SKILL.md |
| MCP | Встроенный | Встроенный |
| Деплой | Docker/Fly.io | Docker + Installer |

---

## Timeline

| День | Фаза | Результат |
|------|------|-----------|
| 1-2 | Ядро | Рабочий Gateway + WebSocket |
| 3-4 | Плагины | Plugin SDK + инструменты |
| 5-6 | Агент | AI-агент с планированием |
| 7 | UI | Tauri интерфейс |
| 8-9 | RAG | Память + скиллы |
| 10 | MCP | MCP + деплой |

---

## Success Criteria

**MVP v1.0 считается готовым когда:**
1. ✅ Gateway запускается и принимает WS подключения
2. ✅ LLM отвечает через Ollama/OpenRouter
3. ✅ Агент вызывает инструменты (file, bash, browser)
4. ✅ UI показывает чат и настройки
5. ✅ RAG ищет по документам
6. ✅ Скиллы загружаются из SKILL.md
7. ✅ MCP экспортирует инструменты

---

*Создано: 2026-06-27*
*Inspiration: OpenClaw (381k ⭐)*
