import { v4 as uuid } from "uuid";
import { getDatabase } from "../state/index.js";

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
  toolCallId?: string;
  toolName?: string;
  createdAt: string;
}

export class SessionManager {
  async create(name: string, model?: string, systemPrompt?: string): Promise<Session> {
    const db = getDatabase();
    const id = uuid();
    const now = new Date().toISOString();

    await db
      .insertInto("sessions")
      .values({
        id,
        name,
        model: model || "qwen2.5:14b",
        systemPrompt,
        createdAt: now,
        updatedAt: now,
      })
      .execute();

    return { id, name, model: model || "qwen2.5:14b", systemPrompt, createdAt: now, updatedAt: now };
  }

  async get(id: string): Promise<Session | undefined> {
    const db = getDatabase();
    const result = await db.selectFrom("sessions").selectAll().where("id", "=", id).executeTakeFirst();
    return result as Session | undefined;
  }

  async list(): Promise<Session[]> {
    const db = getDatabase();
    const results = await db.selectFrom("sessions").selectAll().orderBy("updatedAt", "desc").execute();
    return results as Session[];
  }

  async update(id: string, data: Partial<Pick<Session, "name" | "model" | "systemPrompt">>): Promise<void> {
    const db = getDatabase();
    await db
      .updateTable("sessions")
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where("id", "=", id)
      .execute();
  }

  async delete(id: string): Promise<void> {
    const db = getDatabase();
    await db.deleteFrom("sessions").where("id", "=", id).execute();
  }

  async addMessage(sessionId: string, role: Message["role"], content: string, toolCallId?: string, toolName?: string): Promise<Message> {
    const db = getDatabase();
    const id = uuid();
    const now = new Date().toISOString();

    await db
      .insertInto("messages")
      .values({ id, sessionId, role, content, toolCallId, toolName, createdAt: now })
      .execute();

    await db.updateTable("sessions").set({ updatedAt: now }).where("id", "=", sessionId).execute();

    return { id, sessionId, role, content, toolCallId, toolName, createdAt: now };
  }

  async getMessages(sessionId: string, limit = 100): Promise<Message[]> {
    const db = getDatabase();
    const results = await db
      .selectFrom("messages")
      .selectAll()
      .where("sessionId", "=", sessionId)
      .orderBy("createdAt", "asc")
      .limit(limit)
      .execute();
    return results as Message[];
  }

  async getMessageHistory(sessionId: string): Promise<{ role: string; content: string }[]> {
    const messages = await this.getMessages(sessionId);
    return messages.map((m) => ({ role: m.role, content: m.content }));
  }
}
