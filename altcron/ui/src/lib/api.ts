const API_BASE = "http://localhost:3000";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export interface Session {
  id: string;
  name: string;
  model: string;
  systemPrompt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  createdAt: string;
}

export const api = {
  health: () => apiFetch<{ status: string; version: string; uptime: number }>("/health"),

  sessions: {
    list: () => apiFetch<Session[]>("/api/sessions"),
    create: (name: string, model?: string, systemPrompt?: string) =>
      apiFetch<Session>("/api/sessions", {
        method: "POST",
        body: JSON.stringify({ name, model, systemPrompt }),
      }),
    get: (id: string) => apiFetch<Session>(`/api/sessions/${id}`),
    delete: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/sessions/${id}`, { method: "DELETE" }),
    messages: (id: string) => apiFetch<Message[]>(`/api/sessions/${id}/messages`),
  },

  models: () => apiFetch<{ ollama: string[] }>("/api/models"),

  tools: {
    list: () => apiFetch<any[]>("/api/tools"),
    call: (name: string, params: Record<string, unknown>, sessionId?: string) =>
      apiFetch<any>(`/api/tools/${name}/call`, {
        method: "POST",
        body: JSON.stringify({ params, sessionId }),
      }),
  },

  plugins: () => apiFetch<{ name: string; version: string; description: string }[]>("/api/plugins"),

  settings: {
    get: () => apiFetch<any>("/api/settings"),
    update: (settings: any) =>
      apiFetch<any>("/api/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      }),
    providers: () => apiFetch<any[]>("/api/providers"),
    models: (providerId: string) => apiFetch<any[]>(`/api/providers/${providerId}/models`),
  },
};
