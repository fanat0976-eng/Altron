import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/state/index.js", () => {
  const mockDb = {
    insertInto: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
    selectFrom: vi.fn().mockReturnThis(),
    selectAll: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn().mockResolvedValue(null),
    updateTable: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    deleteFrom: vi.fn().mockReturnThis(),
  };
  return {
    getDatabase: vi.fn().mockReturnValue(mockDb),
    closeDatabase: vi.fn(),
    __mockDb: mockDb,
  };
});

import { SessionManager } from "../src/sessions/index.js";

describe("SessionManager", () => {
  let manager: SessionManager;
  let mockDb: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const state = await import("../src/state/index.js");
    mockDb = (state as any).__mockDb;
    mockDb.insertInto.mockReturnValue(mockDb);
    mockDb.values.mockReturnValue(mockDb);
    mockDb.execute.mockResolvedValue([]);
    mockDb.selectFrom.mockReturnValue(mockDb);
    mockDb.selectAll.mockReturnValue(mockDb);
    mockDb.where.mockReturnValue(mockDb);
    mockDb.orderBy.mockReturnValue(mockDb);
    mockDb.limit.mockReturnValue(mockDb);
    mockDb.updateTable.mockReturnValue(mockDb);
    mockDb.set.mockReturnValue(mockDb);
    mockDb.deleteFrom.mockReturnValue(mockDb);
    manager = new SessionManager();
  });

  it("should create a session", async () => {
    const session = await manager.create("Test Session", "qwen2.5:14b");

    expect(session.id).toBeDefined();
    expect(session.name).toBe("Test Session");
    expect(session.model).toBe("qwen2.5:14b");
    expect(session.createdAt).toBeDefined();
    expect(mockDb.execute).toHaveBeenCalled();
  });

  it("should use default model when not specified", async () => {
    const session = await manager.create("Test");

    expect(session.model).toBe("qwen2.5:14b");
  });

  it("should get session by ID", async () => {
    const mockSession = {
      id: "test-id",
      name: "Test",
      model: "qwen2.5:14b",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockDb.executeTakeFirst.mockResolvedValueOnce(mockSession);

    const session = await manager.get("test-id");

    expect(session).toEqual(mockSession);
    expect(mockDb.where).toHaveBeenCalledWith("id", "=", "test-id");
  });

  it("should return undefined for non-existent session", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(undefined);

    const session = await manager.get("nonexistent");

    expect(session).toBeUndefined();
  });

  it("should list sessions ordered by updatedAt desc", async () => {
    const sessions = [
      { id: "1", name: "Session 1", updatedAt: "2026-01-02" },
      { id: "2", name: "Session 2", updatedAt: "2026-01-01" },
    ];

    mockDb.execute.mockResolvedValueOnce(sessions);

    const result = await manager.list();

    expect(result).toEqual(sessions);
    expect(mockDb.orderBy).toHaveBeenCalledWith("updatedAt", "desc");
  });

  it("should update session", async () => {
    await manager.update("test-id", { name: "Updated Name" });

    expect(mockDb.updateTable).toHaveBeenCalledWith("sessions");
    expect(mockDb.set).toHaveBeenCalled();
    expect(mockDb.where).toHaveBeenCalledWith("id", "=", "test-id");
  });

  it("should delete session", async () => {
    await manager.delete("test-id");

    expect(mockDb.deleteFrom).toHaveBeenCalledWith("sessions");
    expect(mockDb.where).toHaveBeenCalledWith("id", "=", "test-id");
  });

  it("should add message to session", async () => {
    const message = await manager.addMessage("session-1", "user", "Hello");

    expect(message.id).toBeDefined();
    expect(message.sessionId).toBe("session-1");
    expect(message.role).toBe("user");
    expect(message.content).toBe("Hello");
    expect(message.createdAt).toBeDefined();
    expect(mockDb.execute).toHaveBeenCalled();
  });

  it("should add message with tool info", async () => {
    const message = await manager.addMessage(
      "session-1",
      "tool",
      "File read successfully",
      "call-123",
      "read_file"
    );

    expect(message.toolCallId).toBe("call-123");
    expect(message.toolName).toBe("read_file");
  });

  it("should get messages for session", async () => {
    const messages = [
      { id: "1", role: "user", content: "Hi" },
      { id: "2", role: "assistant", content: "Hello!" },
    ];

    mockDb.execute.mockResolvedValueOnce(messages);

    const result = await manager.getMessages("session-1");

    expect(result).toEqual(messages);
    expect(mockDb.orderBy).toHaveBeenCalledWith("createdAt", "asc");
  });

  it("should get message history as role/content pairs", async () => {
    const messages = [
      { id: "1", role: "user", content: "Hi" },
      { id: "2", role: "assistant", content: "Hello!" },
    ];

    mockDb.execute.mockResolvedValueOnce(messages);

    const history = await manager.getMessageHistory("session-1");

    expect(history).toEqual([
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello!" },
    ]);
  });

  it("should update session updatedAt when adding message", async () => {
    await manager.addMessage("session-1", "user", "Test");

    expect(mockDb.updateTable).toHaveBeenCalledWith("sessions");
  });
});
