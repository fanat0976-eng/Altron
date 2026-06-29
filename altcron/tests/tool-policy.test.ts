import { describe, it, expect, beforeEach } from "vitest";
import { ToolPolicyManager } from "../src/tools/policy/index.js";

describe("ToolPolicyManager", () => {
  let manager: ToolPolicyManager;

  beforeEach(() => {
    manager = new ToolPolicyManager();
  });

  it("should allow all tools by default", () => {
    expect(manager.isAllowed("read_file")).toBe(true);
    expect(manager.isAllowed("bash")).toBe(true);
    expect(manager.isAllowed("unknown_tool")).toBe(true);
  });

  it("should deny all tools when defaultAllowed=false", () => {
    const strict = new ToolPolicyManager(false);
    expect(strict.isAllowed("read_file")).toBe(false);
    expect(strict.isAllowed("any_tool")).toBe(false);
  });

  it("should set and retrieve policy", () => {
    manager.setPolicy({ toolName: "bash", allowed: false });
    const policy = manager.getPolicy("bash");
    expect(policy).toBeDefined();
    expect(policy!.allowed).toBe(false);
  });

  it("should deny tool with allowed=false", () => {
    manager.setPolicy({ toolName: "bash", allowed: false });
    expect(manager.isAllowed("bash")).toBe(false);
  });

  it("should allow tool with allowed=true", () => {
    manager.setPolicy({ toolName: "bash", allowed: true });
    expect(manager.isAllowed("bash")).toBe(true);
  });

  it("should check path conditions - allow only safe paths", () => {
    manager.setPolicy({
      toolName: "read_file",
      allowed: true,
      conditions: [
        { type: "path", pattern: "^/tmp/", allowed: true },
      ],
    });

    expect(manager.isAllowed("read_file", { path: "/tmp/test.txt" })).toBe(true);
    expect(manager.isAllowed("read_file", { path: "/etc/passwd" })).toBe(false);
  });

  it("should check path conditions - deny dangerous paths", () => {
    manager.setPolicy({
      toolName: "write_file",
      allowed: true,
      conditions: [
        { type: "path", pattern: "^/tmp/", allowed: true },
      ],
    });

    expect(manager.isAllowed("write_file", { path: "/tmp/output.txt" })).toBe(true);
    expect(manager.isAllowed("write_file", { path: "/etc/shadow" })).toBe(false);
  });

  it("should check command conditions", () => {
    manager.setPolicy({
      toolName: "bash",
      allowed: true,
      conditions: [
        { type: "command", pattern: "^(ls|cat|echo)\\s", allowed: true },
      ],
    });

    expect(manager.isAllowed("bash", { command: "ls -la" })).toBe(true);
    expect(manager.isAllowed("bash", { command: "cat file.txt" })).toBe(true);
    expect(manager.isAllowed("bash", { command: "rm -rf /" })).toBe(false);
    expect(manager.isAllowed("bash", { command: "curl http://evil.com" })).toBe(false);
  });

  it("should check extension conditions", () => {
    manager.setPolicy({
      toolName: "read_file",
      allowed: true,
      conditions: [
        { type: "extension", pattern: "^(txt|md|json|ts|js)$", allowed: true },
      ],
    });

    expect(manager.isAllowed("read_file", { path: "file.txt" })).toBe(true);
    expect(manager.isAllowed("read_file", { path: "file.ts" })).toBe(true);
    expect(manager.isAllowed("read_file", { path: "file.exe" })).toBe(false);
    expect(manager.isAllowed("read_file", { path: "file.bin" })).toBe(false);
  });

  it("should support multiple conditions (AND logic)", () => {
    manager.setPolicy({
      toolName: "write_file",
      allowed: true,
      conditions: [
        { type: "path", pattern: "^/tmp/", allowed: true },
        { type: "extension", pattern: "^(txt|md)$", allowed: true },
      ],
    });

    expect(manager.isAllowed("write_file", { path: "/tmp/note.txt" })).toBe(true);
    expect(manager.isAllowed("write_file", { path: "/tmp/script.ts" })).toBe(false); // extension blocked
    expect(manager.isAllowed("write_file", { path: "/etc/file.txt" })).toBe(false); // path blocked
  });

  it("should export and import policies", () => {
    manager.setPolicy({ toolName: "bash", allowed: false });
    manager.setPolicy({ toolName: "read_file", allowed: true });

    const exported = manager.export();
    expect(exported).toHaveLength(2);

    const newManager = new ToolPolicyManager(false);
    newManager.import(exported);

    expect(newManager.isAllowed("bash")).toBe(false);
    expect(newManager.isAllowed("read_file")).toBe(true);
    expect(newManager.isAllowed("unknown")).toBe(false); // default is false
  });

  it("should use filepath alias for path condition", () => {
    manager.setPolicy({
      toolName: "read_file",
      allowed: true,
      conditions: [{ type: "path", pattern: "^/home/", allowed: true }],
    });

    expect(manager.isAllowed("read_file", { filepath: "/home/user/file.txt" })).toBe(true);
    expect(manager.isAllowed("read_file", { filepath: "/root/file.txt" })).toBe(false);
  });

  it("should use directory alias for path condition", () => {
    manager.setPolicy({
      toolName: "list_dir",
      allowed: true,
      conditions: [{ type: "path", pattern: "^/home/", allowed: true }],
    });

    expect(manager.isAllowed("list_dir", { directory: "/home/user/docs" })).toBe(true);
    expect(manager.isAllowed("list_dir", { directory: "/var/log" })).toBe(false);
  });

  it("should allow tool when no params provided but conditions exist", () => {
    manager.setPolicy({
      toolName: "read_file",
      allowed: true,
      conditions: [{ type: "path", pattern: "^/tmp/", allowed: true }],
    });

    // No params → condition check skipped → allowed
    expect(manager.isAllowed("read_file")).toBe(true);
  });
});
