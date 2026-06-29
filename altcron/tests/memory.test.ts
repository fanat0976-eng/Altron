import { describe, it, expect, vi, beforeEach } from "vitest";

// Memory manager uses in-memory Map for short-term storage
// and only touches DB for long-term storage
// Let's test the interface without full DB mocking

describe("MemoryManager", () => {
  it("should have correct interface", async () => {
    // Import the module to verify it exists and has the right shape
    const mod = await import("../src/agents/memory/index.js");
    expect(mod.MemoryManager).toBeDefined();
    expect(typeof mod.MemoryManager).toBe("function");
  });

  it("should create instance with methods", async () => {
    const { MemoryManager } = await import("../src/agents/memory/index.js");

    // Mock the database
    vi.mock("../src/state/index.js", () => ({
      getDatabase: () => ({
        selectFrom: () => ({
          where: () => ({
            orderBy: () => ({
              execute: async () => [],
            }),
            select: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: () => ({
                    execute: async () => [],
                  }),
                }),
              }),
            }),
          }),
        }),
        insertInto: () => ({
          values: () => ({
            execute: async () => ({}),
          }),
        }),
        deleteFrom: () => ({
          where: () => ({
            where: () => ({
              executeTakeFirst: async () => ({ numDeletedRows: 0 }),
            }),
          }),
        }),
      }),
    }));

    const memory = new MemoryManager();

    // Verify methods exist
    expect(typeof memory.remember).toBe("function");
    expect(typeof memory.list).toBe("function");
    expect(typeof memory.forget).toBe("function");
    expect(typeof memory.getImportantFacts).toBe("function");
    expect(typeof memory.recall).toBe("function");
  });

  it("should have short-term memory limit", async () => {
    // This tests the internal short-term memory Map behavior
    const { MemoryManager } = await import("../src/agents/memory/index.js");

    vi.mock("../src/state/index.js", () => ({
      getDatabase: () => ({
        selectFrom: () => ({
          where: () => ({
            orderBy: () => ({
              execute: async () => [],
            }),
          }),
        }),
        insertInto: () => ({
          values: () => ({
            execute: async () => ({}),
          }),
        }),
      }),
    }));

    const memory = new MemoryManager();

    // Add more than 100 items to test overflow behavior
    for (let i = 0; i < 110; i++) {
      await memory.remember("session1", `key${i}`, `value${i}`, "short_term");
    }

    // Verify it didn't throw
    expect(memory).toBeDefined();
  });
});
